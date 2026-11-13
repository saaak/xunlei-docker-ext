import {
  CLIENT_ID,
  CLIENT_SECRET,
  CLIENT_VERSION,
  PACKAGE_NAME,
  APP_ID,
  APP_KEY,
  SIGN_PROVIDER,
  REDIRECT_URI,
  md5Hex,
  getDeviceSign,
  getCaptchaSign
} from './xlCrypto.js';

const XLUSER_BASE = "https://xluser-ssl.xunlei.com";
const XLUSER_API = XLUSER_BASE + "/v1";
const DRIVE_API = "https://api-pan.xunlei.com/drive/v1";

const TOKEN_ERROR_CODES = new Set([4122, 4121, 10, 16]);
const CAPTCHA_ERROR_CODE = 9;

class XunleiCloud {
  constructor() {
    this._cachedDeviceApis = new Map();
  }

  // -------------------------------------------------------------
  // 基础存储与设备 ID
  // -------------------------------------------------------------

  async getDeviceId() {
    const data = await chrome.storage.local.get(['xl_device_id']);
    if (data.xl_device_id && data.xl_device_id.length === 32) {
      return data.xl_device_id;
    }
    const newId = md5Hex(`${Date.now()}-${Math.random()}-${CLIENT_ID}`);
    await chrome.storage.local.set({ xl_device_id: newId });
    return newId;
  }

  async getCredentials() {
    return await chrome.storage.local.get([
      'xl_access_token',
      'xl_refresh_token',
      'xl_token_type',
      'xl_user_id',
      'xl_captcha_token',
      'xl_login_name',
      'xl_creditkey',
      'xl_review_url',
      'xl_review_token',
      'xl_review_key',
      'xl_selected_target',
      'xl_selected_target_name',
      'xl_parent_folder_id',
      'xl_parent_folder_path'
    ]);
  }

  async saveCredentials(obj) {
    await chrome.storage.local.set(obj);
  }

  async clearCredentials() {
    await chrome.storage.local.remove([
      'xl_access_token',
      'xl_refresh_token',
      'xl_token_type',
      'xl_user_id',
      'xl_captcha_token',
      'xl_login_name',
      'xl_creditkey',
      'xl_review_url',
      'xl_review_token',
      'xl_review_key',
      'xl_selected_target',
      'xl_selected_target_name',
      'xl_parent_folder_id',
      'xl_parent_folder_path'
    ]);
  }

  // -------------------------------------------------------------
  // 基础请求头
  // -------------------------------------------------------------

  async getBaseHeaders() {
    const deviceId = await this.getDeviceId();
    return {
      "Accept": "application/json;charset=UTF-8",
      "Content-Type": "application/json",
      "x-device-id": deviceId,
      "x-client-id": CLIENT_ID,
      "x-client-version": CLIENT_VERSION
    };
  }

  async getAuthHeaders() {
    const headers = await this.getBaseHeaders();
    const creds = await this.getCredentials();
    if (creds.xl_access_token) {
      headers["Authorization"] = `${creds.xl_token_type || 'Bearer'} ${creds.xl_access_token}`;
    }
    if (creds.xl_captcha_token) {
      headers["x-captcha-token"] = creds.xl_captcha_token;
    }
    return headers;
  }

  // -------------------------------------------------------------
  // 登录流程与风控短信验证
  // -------------------------------------------------------------

  /**
   * 登录第一步：V3 核心登录
   */
  async _coreLogin(username, password) {
    const deviceId = await this.getDeviceId();
    const deviceSign = await getDeviceSign(deviceId);
    const creds = await this.getCredentials();

    const body = {
      protocolVersion: "301",
      sequenceNo: "1000012",
      platformVersion: "10",
      isCompressed: "0",
      appid: APP_ID,
      clientVersion: CLIENT_VERSION,
      peerID: "0".repeat(32),
      appName: PACKAGE_NAME,
      sdkVersion: "512000",
      devicesign: deviceSign,
      netWorkType: "WIFI",
      providerName: "NONE",
      deviceModel: "M2004J7AC",
      deviceName: "Xiaomi_M2004j7ac",
      OSVersion: "12",
      creditkey: creds.xl_creditkey || "",
      hl: "zh-CN",
      userName: username,
      passWord: password,
      verifyKey: "",
      verifyCode: "",
      isMd5Pwd: "0"
    };

    const headers = await this.getBaseHeaders();
    const resp = await fetch(`${XLUSER_BASE}/xluser.core.login/v3/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    return data;
  }

  /**
   * 人机令牌初始化 (captcha/init)
   */
  async _initCaptcha(action, meta) {
    const deviceId = await this.getDeviceId();
    const creds = await this.getCredentials();
    const body = {
      action,
      captcha_token: creds.xl_captcha_token || "",
      client_id: CLIENT_ID,
      device_id: deviceId,
      meta,
      redirect_uri: REDIRECT_URI
    };

    const headers = await this.getBaseHeaders();
    const resp = await fetch(`${XLUSER_API}/shield/captcha/init`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (data.url) {
      throw new Error(`需要人工网页验证：请在浏览器中打开 ${data.url} 完成验证`);
    }
    if (!data.captcha_token) {
      throw new Error(`获取人机令牌失败: ${data.error_description || data.error || '未知错误'}`);
    }

    await this.saveCredentials({ xl_captcha_token: data.captcha_token });
    return data.captcha_token;
  }

  /**
   * 登录态下的云盘接口人机令牌刷新
   */
  async refreshDriveCaptcha(action = 'POST:/drive/v1/task') {
    const deviceId = await this.getDeviceId();
    const creds = await this.getCredentials();
    const { timestamp, sign } = getCaptchaSign(deviceId);
    const meta = {
      client_version: CLIENT_VERSION,
      package_name: PACKAGE_NAME,
      user_id: creds.xl_user_id || "",
      timestamp,
      captcha_sign: sign
    };
    return await this._initCaptcha(action, meta);
  }

  /**
   * 完整登录链路
   */
  async login(username, password) {
    if (!username || !password) {
      throw new Error("请输入迅雷账号和密码");
    }

    const loginData = await this._coreLogin(username, password);

    // 检查风控 review_panel
    if ((loginData.error || '').trim() === 'review_panel') {
      const reviewUrl = loginData.reviewurl || '';
      const creditKey = loginData.creditkey || '';
      
      let mobile = '';
      if (reviewUrl) {
        try {
          const u = new URL(reviewUrl);
          mobile = u.searchParams.get('mobile') || '';
        } catch (e) {}
      }

      await this.saveCredentials({
        xl_review_url: reviewUrl,
        xl_creditkey: creditKey,
        xl_login_name: username
      });

      return {
        needVerify: true,
        mobile,
        reviewUrl,
        message: '本次登录触发迅雷安全验证，需要短信验证'
      };
    }

    // 检查其他登录错误
    if (loginData.error && loginData.error !== 'success') {
      const msg = loginData.errorDesc || loginData.error_description || loginData.error;
      throw new Error(`迅雷登录失败：${msg}`);
    }

    const sessionId = loginData.sessionID;
    if (!sessionId) {
      throw new Error("登录失败：未返回 sessionID");
    }

    const userId = loginData.userID || loginData.userid || loginData.user_id || "";

    // 登录人机令牌刷新
    let meta;
    if (username.includes('@')) {
      meta = { email: username };
    } else if (username.length >= 11 && /^\d+$/.test(username)) {
      meta = { phone_number: username };
    } else {
      meta = { username: username };
    }

    await this._initCaptcha("POST:/v1/auth/signin/token", meta);

    // 换取 OAuth 令牌
    const deviceId = await this.getDeviceId();
    const headers = await this.getBaseHeaders();
    const tokenResp = await fetch(`${XLUSER_API}/auth/signin/token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        provider: SIGN_PROVIDER,
        signin_token: sessionId
      })
    });

    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      const err = tokenData.errorDesc || tokenData.error_description || tokenData.error || '换取令牌失败';
      throw new Error(`换取令牌失败: ${err}`);
    }

    await this.saveCredentials({
      xl_access_token: tokenData.access_token,
      xl_refresh_token: tokenData.refresh_token || '',
      xl_token_type: tokenData.token_type || 'Bearer',
      xl_user_id: tokenData.user_id || tokenData.sub || userId,
      xl_login_name: username,
      xl_creditkey: '',
      xl_review_url: '',
      xl_review_token: '',
      xl_review_key: ''
    });

    // 刷新一次用于 drive/v1 的人机令牌
    try {
      await this.refreshDriveCaptcha();
    } catch (e) {
      console.warn("预刷新 drive captcha 异常:", e);
    }

    return { needVerify: false, success: true, userId: tokenData.user_id };
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken() {
    const creds = await this.getCredentials();
    const refresh = creds.xl_refresh_token;
    if (!refresh) {
      throw new Error("缺少 refresh_token，请重新登录");
    }

    const headers = await this.getBaseHeaders();
    const resp = await fetch(`${XLUSER_API}/auth/token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });

    const data = await resp.json();
    if (!data.access_token) {
      throw new Error(`刷新访问令牌失败: ${data.error_description || data.error || '未知错误'}`);
    }

    await this.saveCredentials({
      xl_access_token: data.access_token,
      xl_refresh_token: data.refresh_token || refresh,
      xl_token_type: data.token_type || 'Bearer'
    });

    return data.access_token;
  }

  // -------------------------------------------------------------
  // 短信验证码相关 (Review Panel 流程)
  // -------------------------------------------------------------

  async _getReviewPayload() {
    const creds = await this.getCredentials();
    const reviewUrl = creds.xl_review_url || '';
    const deviceId = await this.getDeviceId();
    const deviceSign = await getDeviceSign(deviceId);

    const params = {
      provideNname: "NONE",
      netWorkType: "NONE",
      providerName: "NONE",
      protocolVersion: "301",
      devicesign: deviceSign,
      platformVersion: "1",
      fromPlatformVersion: "1",
      timestamp: Date.now().toString(),
      sdkVersion: "1.0",
      deviceModel: "M2004J7AC",
      deviceName: "Xiaomi_M2004j7ac",
      OSVersion: "12",
      smsEvent: "34",
      creditkey: creds.xl_review_key || creds.xl_creditkey || ""
    };

    if (reviewUrl) {
      try {
        const u = new URL(reviewUrl);
        u.searchParams.forEach((val, key) => {
          params[key] = val;
        });
      } catch (e) {}
    }

    if (params.deviceid) {
      params.devicesign = params.deviceid;
      delete params.deviceid;
    }

    return params;
  }

  /**
   * 发送短信验证码
   */
  async reviewSendSms() {
    const creds = await this.getCredentials();
    if (!creds.xl_review_url) {
      throw new Error("当前没有处于待短信验证状态");
    }

    const payload = await this._getReviewPayload();
    const deviceId = await this.getDeviceId();
    payload.csrf_token = md5Hex(deviceId);

    let host = XLUSER_BASE;
    try {
      const u = new URL(creds.xl_review_url);
      const mainHost = u.searchParams.get('mainHost');
      if (mainHost) {
        host = `https://${mainHost.split(',')[0].replace(/^https?:\/\//, '').trim()}`;
      }
    } catch (e) {}

    const queryStr = new URLSearchParams(payload).toString();
    const resp = await fetch(`${host}/xluser.core.login/v3/sendsms?${queryStr}`, {
      method: 'GET'
    });

    const data = await resp.json();
    const code = String(data.errorCode || data.error_code || '0');
    if (code !== '0') {
      throw new Error(`获取验证码失败：${data.errorDesc || data.error_description || data.error || code}`);
    }

    const token = data.token || '';
    if (!token) {
      throw new Error("获取验证码失败：未返回 token");
    }

    const newCreditKey = data.creditkey || creds.xl_creditkey || '';
    await this.saveCredentials({
      xl_review_token: token,
      xl_review_key: newCreditKey,
      xl_creditkey: newCreditKey
    });

    return { ok: true, mobile: payload.mobile };
  }

  /**
   * 提交短信验证码并自动重登换取正式令牌
   */
  async reviewCheckSms(smsCode, username, password) {
    const creds = await this.getCredentials();
    const token = creds.xl_review_token;
    if (!token) {
      throw new Error("请先点击获取验证码");
    }
    if (!/^\d{6}$/.test(smsCode.trim())) {
      throw new Error("请输入 6 位数字验证码");
    }

    const payload = await this._getReviewPayload();
    payload.token = token;
    payload.smsCode = smsCode.trim();

    let host = XLUSER_BASE;
    try {
      const u = new URL(creds.xl_review_url);
      const mainHost = u.searchParams.get('mainHost');
      if (mainHost) {
        host = `https://${mainHost.split(',')[0].replace(/^https?:\/\//, '').trim()}`;
      }
    } catch (e) {}

    const formData = new FormData();
    for (const [k, v] of Object.entries(payload)) {
      formData.append(k, String(v));
    }

    const resp = await fetch(`${host}/xluser.core.login/v3/checksms`, {
      method: 'POST',
      body: formData
    });

    const data = await resp.json();
    if (String(data.blogresult || '') !== '0') {
      throw new Error(`验证码校验失败：${data.errorDesc || data.error_description || data.error || '验证码错误'}`);
    }

    // 校验成功，上报信用获取续期 creditkey
    let renewedCreditKey = data.creditkey || '';
    try {
      const deviceId = await this.getDeviceId();
      const reportParams = new URLSearchParams({
        type: "sms",
        scene: "34",
        userid: payload.userID || "",
        data: data.securitytoken || "",
        result: data.blogresult || "",
        appid: payload.appid || "",
        deviceid: deviceId,
        creditkey: creds.xl_review_key || creds.xl_creditkey || ""
      });
      const repResp = await fetch(`${host}/credit/v1/report?${reportParams.toString()}`);
      const repData = await repResp.json();
      if (String(repData.code) === '200' && repData.creditkey) {
        renewedCreditKey = repData.creditkey;
      }
    } catch (e) {
      console.warn("上报信用续期异常:", e);
    }

    await this.saveCredentials({
      xl_creditkey: renewedCreditKey || creds.xl_review_key || creds.xl_creditkey,
      xl_review_url: '',
      xl_review_token: '',
      xl_review_key: ''
    });

    // 验证成功后，使用续期信用密钥重新登录
    return await this.login(username || creds.xl_login_name, password);
  }

  // -------------------------------------------------------------
  // 云盘 API 请求调度封装 (自动处理 Token/Captcha 续期)
  // -------------------------------------------------------------

  async cloudRequest(method, url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${DRIVE_API}${url}`;
    const actionPath = new URL(fullUrl).pathname;
    const action = `${method.toUpperCase()}:${actionPath}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const headers = await this.getAuthHeaders();
      const fetchOpts = {
        method,
        headers: {
          ...headers,
          ...(options.headers || {})
        }
      };

      if (options.body) {
        fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }

      let resp;
      try {
        resp = await fetch(fullUrl, fetchOpts);
      } catch (err) {
        throw new Error(`网络连接失败：${err.message}`);
      }

      let data;
      try {
        data = await resp.json();
      } catch (err) {
        if (!resp.ok) {
          throw new Error(`迅雷云端响应异常 (HTTP ${resp.status})`);
        }
        return {};
      }

      // 判断业务错误码
      const errCode = parseInt(data.error_code || data.errorCode || 0, 10);
      const errText = data.errorDesc || data.error_description || data.error || '';

      if (data.error === 'success' || (!errCode && !errText)) {
        return data;
      }

      // 令牌过期自动刷新重试
      if (attempt < 2 && TOKEN_ERROR_CODES.has(errCode)) {
        console.log(`令牌过期 (code=${errCode})，正在自动刷新 Access Token...`);
        await this.refreshAccessToken();
        continue;
      }

      // 人机令牌失效自动刷新重试
      if (attempt < 2 && errCode === CAPTCHA_ERROR_CODE) {
        console.log(`人机令牌失效 (code=${errCode})，正在刷新 Drive Captcha Token...`);
        await this.refreshDriveCaptcha(action);
        continue;
      }

      // 其他不可自愈的错误
      throw new Error(`迅雷云端错误：${errText || '请求失败'} (error_code=${errCode})`);
    }

    throw new Error("迅雷云端请求重试超限");
  }

  // -------------------------------------------------------------
  // 远程设备与目录发现
  // -------------------------------------------------------------

  /**
   * 获取账号下绑定的远程设备列表
   */
  async getDeviceTargets() {
    const data = await this.cloudRequest('GET', '/tasks?type=user%23runner');
    const tasks = data.tasks || [];
    const devices = [];

    for (const t of tasks) {
      const params = t.params || {};
      const target = params.target || t.id;
      if (target) {
        devices.push({
          target,
          name: t.name || params.device_name || `设备 ${target.substring(0, 8)}`,
          online: params.online === 'true' || params.online === true,
          type: t.type || 'user#runner',
          raw: t
        });
      }
    }

    return devices;
  }

  /**
   * 自动确认或更新当前选中的远程目标设备
   */
  async getSelectedTarget() {
    const creds = await this.getCredentials();
    if (creds.xl_selected_target) {
      return {
        target: creds.xl_selected_target,
        name: creds.xl_selected_target_name || creds.xl_selected_target
      };
    }

    const devices = await this.getDeviceTargets();
    if (!devices || devices.length === 0) {
      throw new Error("当前迅雷账号下未发现绑定的远程设备，请先在迅雷 App 或 NAS 迅雷中完成设备绑定");
    }

    const selected = devices.find(d => d.online) || devices[0];
    await this.saveCredentials({
      xl_selected_target: selected.target,
      xl_selected_target_name: selected.name
    });

    return selected;
  }

  /**
   * 设备中继专属 API 发现 (INNER_API)
   */
  async _getRelayApi(space) {
    if (this._cachedDeviceApis.has(space)) {
      const cached = this._cachedDeviceApis.get(space);
      if (Date.now() - cached.at < 300 * 1000) {
        return cached;
      }
    }

    const data = await this.cloudRequest('GET', `/apps/INNER_API?space=${encodeURIComponent(space)}`);
    let url = data.link || (data.links && data.links[0]?.url) || '';
    if (!url) {
      return null;
    }

    const parsed = new URL(url);
    const base = `${parsed.origin}${parsed.pathname.endsWith('/') ? parsed.pathname : parsed.pathname + '/'}`;
    const ent = {
      base,
      plugin_app_id: parsed.searchParams.get('plugin_app_id') || '',
      plugin_app_token: parsed.searchParams.get('plugin_app_token') || '',
      at: Date.now()
    };
    this._cachedDeviceApis.set(space, ent);
    return ent;
  }

  /**
   * 从历史任务反查真实 parent_folder_id / parent_folder_path
   */
  async _harvestRootFromTasks(space) {
    try {
      const data = await this.cloudRequest('GET', `/tasks?space=${encodeURIComponent(space)}&limit=20&filters=%7B%22type%22%3A%7B%22in%22%3A%22user%23download-url%2Cuser%23download%22%7D%7D`);
      const tasks = data.tasks || [];
      for (const t of tasks) {
        const p = t.params || {};
        const pid = String(p.parent_folder_id || '').trim();
        const ppath = String(p.parent_folder_path || '').trim();
        if (pid) {
          return { id: pid, path: ppath };
        }
      }
    } catch (e) {
      console.warn("历史任务反查根目录失败:", e);
    }
    return null;
  }

  /**
   * 解析远程设备的下载目标文件夹
   */
  async resolveDestFolder(space) {
    const creds = await this.getCredentials();
    if (creds.xl_parent_folder_id) {
      return {
        id: creds.xl_parent_folder_id,
        path: creds.xl_parent_folder_path || ''
      };
    }

    // 1. 尝试从历史任务反查
    const harvested = await this._harvestRootFromTasks(space);
    if (harvested && harvested.id) {
      await this.saveCredentials({
        xl_parent_folder_id: harvested.id,
        xl_parent_folder_path: harvested.path
      });
      return harvested;
    }

    // 2. 尝试从中继 API 查目录表
    try {
      const relay = await this._getRelayApi(space);
      if (relay) {
        const query = new URLSearchParams({
          space,
          device_space: "",
          limit: "200",
          filters: JSON.stringify({ kind: { eq: "drive#folder" } })
        });
        if (relay.plugin_app_id) query.set("plugin_app_id", relay.plugin_app_id);
        if (relay.plugin_app_token) query.set("plugin_app_token", relay.plugin_app_token);

        const filesData = await this.cloudRequest('GET', `${relay.base}drive/v1/files?${query.toString()}`);
        const folders = filesData.files || [];
        if (folders.length > 0) {
          const fid = folders[0].id || '';
          const fpath = folders[0].params?.RealPath || '';
          if (fid) {
            await this.saveCredentials({
              xl_parent_folder_id: fid,
              xl_parent_folder_path: fpath
            });
            return { id: fid, path: fpath };
          }
        }
      }
    } catch (e) {
      console.warn("通过中继获取目录表失败:", e);
    }

    // 兜底返回空字符串
    return { id: '', path: '' };
  }

  // -------------------------------------------------------------
  // 业务接口：资源解析、任务提交与列表管理
  // -------------------------------------------------------------

  /**
   * 解析磁力链接或下载链接的文件列表
   */
  async extractFileList(url) {
    const data = await this.cloudRequest('POST', '/resource/list', {
      body: {
        urls: url,
        page_size: 2000
      }
    });
    return data;
  }

  /**
   * 提交远程下载任务
   */
  async submitTask(task) {
    const device = await this.getSelectedTarget();
    const space = device.target;

    const folder = await this.resolveDestFolder(space);
    const selectedFiles = task.selected_files || [];
    const taskName = task.task_name || selectedFiles[0]?.file_name || '远程下载任务';
    const totalSize = selectedFiles.reduce((sum, f) => sum + (f.file_size || 0), 0);

    const subIndex = selectedFiles.length > 0
      ? selectedFiles.map(f => String(f.index)).join(',')
      : '--1,';

    const submitBody = {
      type: "user#download-url",
      name: taskName,
      file_name: taskName,
      file_size: String(totalSize),
      space: space,
      params: {
        target: space,
        url: task.magnetic_link,
        total_file_count: String(selectedFiles.length || 1),
        parent_folder_id: folder.id || '',
        parent_folder_path: folder.path || '',
        sub_file_index: subIndex,
        file_id: ""
      }
    };

    const res = await this.cloudRequest('POST', '/task', {
      body: submitBody
    });

    return {
      success: true,
      taskId: res.task?.id || res.id,
      data: res
    };
  }

  /**
   * 获取未完成任务
   */
  async getUncompletedTasks(target) {
    const space = target || (await this.getSelectedTarget()).target;
    const filter = encodeURIComponent(JSON.stringify({
      phase: { in: "PHASE_TYPE_PENDING,PHASE_TYPE_RUNNING,PHASE_TYPE_PAUSED,PHASE_TYPE_ERROR" },
      type: { in: "user#download-url,user#download" }
    }));
    return await this.cloudRequest('GET', `/tasks?space=${encodeURIComponent(space)}&page_token=&filters=${filter}&limit=200&device_space=`);
  }

  /**
   * 获取已完成任务
   */
  async getCompletedTasks(target) {
    const space = target || (await this.getSelectedTarget()).target;
    const filter = encodeURIComponent(JSON.stringify({
      phase: { in: "PHASE_TYPE_COMPLETE" },
      type: { in: "user#download-url,user#download" }
    }));
    return await this.cloudRequest('GET', `/tasks?space=${encodeURIComponent(space)}&page_token=&filters=${filter}&limit=200&device_space=`);
  }
}

export const xlCloud = new XunleiCloud();
