import {
  getDeviceId as getLocalDeviceId,
  getUncompletedTasks as getLocalUncompletedTasks,
  extractFileList as getLocalExtractFileList,
  createFolder as localCreateFolder,
  submitTask as localSubmitTask,
  getCompletedTasks as getLocalCompletedTasks,
  getParentFolderId as getLocalParentFolderId
} from './utils/api.js';
import { parseDeviceId } from './utils/util.js';
import { clearAuthCache } from './utils/request.js';
import { xlCloud } from './utils/xlCloud.js';
import { MODE_LOCAL, MODE_REMOTE } from './utils/constants.js';

let localDeviceId = null;
let localParentFolderId = null;
let lastUncompletedTaskIds = new Set(); // 存储上次检查时未完成的任务ID
let lastUncompletedTaskMap = new Map(); // 存储上次检查时未完成的任务

/**
 * 获取当前生效的模式 ('remote' | 'local')
 */
async function getEffectiveMode() {
  const syncConfig = await chrome.storage.sync.get(['mode', 'host', 'port']);
  if (syncConfig.mode) {
    return syncConfig.mode;
  }
  const creds = await xlCloud.getCredentials();
  if (creds.xl_access_token) {
    return MODE_REMOTE;
  }
  if (syncConfig.host && syncConfig.port) {
    return MODE_LOCAL;
  }
  return MODE_REMOTE;
}

// -------------------------------------------------------------
// 本地模式 Device ID 初始化
// -------------------------------------------------------------

async function initLocalDeviceId() {
  try {
    const cachedDevice = await chrome.storage.local.get(['deviceId']);
    if (cachedDevice.deviceId) {
      localDeviceId = cachedDevice.deviceId;
      return;
    }

    const deviceResponse = await getLocalDeviceId();
    const id = parseDeviceId(deviceResponse);
    if (id) {
      localDeviceId = id;
      await chrome.storage.local.set({ deviceId: id });
    }
  } catch (error) {
    console.error('初始化本地 deviceId 失败:', error);
  }
}

async function ensureLocalDeviceIdInitialized() {
  if (!localDeviceId) {
    console.log('localDeviceId 为空，正在初始化...');
    await initLocalDeviceId();
  }
  if (!localDeviceId) {
    throw new Error('无法连接本地迅雷服务，请检查网络或配置。');
  }
}

// -------------------------------------------------------------
// 下载完成后台通知
// -------------------------------------------------------------

async function checkTasksCompletion() {
  try {
    const mode = await getEffectiveMode();
    let uncompletedTasks = [];

    if (mode === MODE_REMOTE) {
      const creds = await xlCloud.getCredentials();
      if (!creds.xl_access_token || !creds.xl_selected_target) return;
      const resp = await xlCloud.getUncompletedTasks();
      uncompletedTasks = resp?.tasks || [];
    } else {
      if (!localDeviceId) return;
      const uncompletedTasksResponse = await getLocalUncompletedTasks(localDeviceId);
      uncompletedTasks = uncompletedTasksResponse?.tasks || [];
    }

    const uncompletedTaskIds = new Set(uncompletedTasks.map(task => task.id));
    const newCompletedTaskIds = new Set([...lastUncompletedTaskIds].filter(id => !uncompletedTaskIds.has(id)));

    // 检查是否有新完成的任务
    for (const taskId of newCompletedTaskIds) {
      const task = lastUncompletedTaskMap.get(taskId);
      if (task) {
        chrome.notifications.create(taskId, {
          type: 'basic',
          iconUrl: 'assets/icon128.png',
          title: '迅雷下载任务完成',
          message: `任务「${task.name}」已下载完成`,
          priority: 2
        });
      }
      lastUncompletedTaskMap.delete(taskId);
    }

    // 更新未完成任务状态字典
    for (const task of uncompletedTasks) {
      lastUncompletedTaskMap.set(task.id, task);
    }
    lastUncompletedTaskIds = uncompletedTaskIds;
  } catch (error) {
    console.error('检查任务完成状态失败:', error);
  }
}

function startTaskCompletionCheck() {
  checkTasksCompletion();
  setInterval(checkTasksCompletion, 30000);
}

// -------------------------------------------------------------
// 扩展生命周期初始化
// -------------------------------------------------------------

async function initExtension() {
  try {
    const mode = await getEffectiveMode();
    if (mode === MODE_LOCAL) {
      const config = await chrome.storage.sync.get(['host', 'port']);
      if (config.host && config.port) {
        await initLocalDeviceId();
      }
    }
    startTaskCompletionCheck();
  } catch (error) {
    console.error('扩展初始化失败:', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  initExtension();
});

chrome.runtime.onStartup.addListener(() => {
  initExtension();
});

// 点击扩展图标
chrome.action.onClicked.addListener(async () => {
  try {
    const mode = await getEffectiveMode();
    if (mode === MODE_LOCAL) {
      await initLocalDeviceId();
    }
    await chrome.action.setPopup({ popup: 'popup/popup.html' });
  } catch (error) {
    console.error('初始化失败:', error);
    await chrome.action.setPopup({ popup: 'popup/popup.html' });
  }
});

// -------------------------------------------------------------
// 消息监听与路由调度
// -------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. 配置更新
  if (message.type === 'updateConfig') {
    const config = message.config || {};
    const mode = config.mode || MODE_LOCAL;

    const toSync = {
      mode,
      defaultDownloadDir: config.defaultDownloadDir !== undefined ? config.defaultDownloadDir : '',
      defaultFileType: config.defaultFileType || ''
    };

    if (mode === MODE_LOCAL) {
      toSync.host = config.host || '';
      toSync.port = config.port || '';
      toSync.ssl = config.ssl || false;
      toSync.platform = config.platform || 'docker';
    }

    chrome.storage.sync.set(toSync, async () => {
      try {
        if (mode === MODE_LOCAL) {
          await clearAuthCache();
          await chrome.storage.local.remove('deviceId');
          localDeviceId = null;
          localParentFolderId = null;
          if (toSync.host && toSync.port) {
            await initLocalDeviceId();
          }
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('更新配置状态异常:', error);
        sendResponse({ success: true });
      }
    });
    return true;
  }

  // 2. 任务列表查询 (未完成 / 已完成)
  if (message.type === 'getUncompletedTasks' || message.type === 'getCompletedTasks') {
    (async () => {
      try {
        const mode = await getEffectiveMode();
        let tasks = [];

        if (mode === MODE_REMOTE) {
          const resp = message.type === 'getUncompletedTasks'
            ? await xlCloud.getUncompletedTasks()
            : await xlCloud.getCompletedTasks();
          tasks = resp?.tasks || [];
        } else {
          await ensureLocalDeviceIdInitialized();
          const taskPromise = message.type === 'getUncompletedTasks'
            ? getLocalUncompletedTasks(localDeviceId)
            : getLocalCompletedTasks(localDeviceId);
          const resp = await taskPromise;
          tasks = resp?.tasks || [];
        }

        const res = tasks.map(task => ({
          file_name: task.name,
          name: task.name,
          file_size: parseInt(task.file_size || 0, 10),
          updated_time: task.updated_time,
          progress: task.progress || 0,
          real_path: task.params?.real_path || '',
          speed: parseInt(task.params?.speed || 0, 10),
          created_time: task.created_time,
          origin: task
        }));
        sendResponse(res);
      } catch (error) {
        console.error('获取任务列表失败:', error);
        sendResponse({ error: error.message, tasks: [] });
      }
    })();
    return true;
  }

  // 3. 解析磁力链接资源树
  if (message.type === 'getFileTree') {
    (async () => {
      try {
        if (!message.magnetic_link) {
          throw new Error('缺少磁力链接');
        }

        const mode = await getEffectiveMode();
        let extractRes;
        if (mode === MODE_REMOTE) {
          extractRes = await xlCloud.extractFileList(message.magnetic_link);
        } else {
          extractRes = await getLocalExtractFileList(message.magnetic_link);
        }

        const resources = extractRes?.list?.resources || [];

        function parseResources(resList) {
          return resList.map(resource => ({
            name: resource.name,
            isDirectory: resource.is_dir,
            children: resource.is_dir ? parseResources(resource.dir?.resources || []) : [],
            file_index: resource.file_index || 0,
            file_size: resource.file_size || 0
          }));
        }

        const files = parseResources(resources);
        sendResponse(files);
      } catch (error) {
        console.error('Failed to get file tree:', error);
        sendResponse([]);
      }
    })();
    return true;
  }

  // 4. 提交下载任务
  if (message.type === 'submitTask') {
    const handleSubmitTask = async () => {
      try {
        const mode = await getEffectiveMode();
        const task = message.task;
        if (!task || !task.magnetic_link || !task.selected_files) {
          throw new Error('无效任务参数');
        }

        // 自动检查并补齐默认下载目录
        const finalTaskFiles = task.selected_files;
        let taskName = task.task_name || finalTaskFiles[0]?.file_name || '下载任务';
        let downloadDir = (task.download_dir || '').trim();

        if (!downloadDir && !taskName.startsWith('/')) {
          const syncConfig = await chrome.storage.sync.get(['defaultDownloadDir']);
          downloadDir = (syncConfig.defaultDownloadDir || '').trim();
        }

        if (downloadDir) {
          if (!downloadDir.startsWith('/')) downloadDir = '/' + downloadDir;
          if (!downloadDir.endsWith('/')) downloadDir = downloadDir + '/';
          if (!taskName.startsWith(downloadDir)) {
            taskName = `${downloadDir}${taskName.replace(/^\/+/, '')}`;
          }
        }

        task.task_name = taskName;
        task.download_dir = downloadDir;

        // 远程模式下发
        if (mode === MODE_REMOTE) {
          const res = await xlCloud.submitTask(task);
          return res;
        }

        // 本地模式下发
        await ensureLocalDeviceIdInitialized();
        const taskFileCount = finalTaskFiles.length;

        if (!localParentFolderId) {
          const res = await getLocalParentFolderId(localDeviceId);
          localParentFolderId = res?.files?.[0]?.parent_id;
        }

        const submitBody = {
          type: "user#download-url",
          name: taskName,
          file_name: taskName,
          file_size: finalTaskFiles.reduce((sum, f) => sum + (f.file_size || 0), 0).toString(),
          space: localDeviceId,
          params: {
            target: localDeviceId,
            url: task.magnetic_link,
            total_file_count: taskFileCount.toString(),
            parent_folder_id: localParentFolderId,
            sub_file_index: finalTaskFiles.map(f => f.index.toString()).join(','),
            file_id: ""
          }
        };

        const res = await localSubmitTask(submitBody);
        if (res?.HttpStatus !== 0 && res?.HttpStatus !== undefined) {
          return { success: false, error: res?.error_description || '提交失败' };
        }

        return { success: true };
      } catch (error) {
        console.error('Failed to submit task:', error);
        return { success: false, error: error.message };
      }
    };

    handleSubmitTask().then(res => {
      sendResponse(res);
    });
    return true;
  }

  // 5. 迅雷远程通道：登录
  if (message.type === 'xlRemoteLogin') {
    xlCloud.login(message.username, message.password)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  // 6. 迅雷远程通道：发送短信验证码
  if (message.type === 'xlRemoteSendSms') {
    xlCloud.reviewSendSms()
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  // 7. 迅雷远程通道：校验短信验证码并自动重新登录
  if (message.type === 'xlRemoteCheckSms') {
    xlCloud.reviewCheckSms(message.smsCode, message.username, message.password)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  // 8. 迅雷远程通道：获取绑定的远程设备列表
  if (message.type === 'xlRemoteGetDevices') {
    xlCloud.getDeviceTargets()
      .then(devices => sendResponse({ success: true, devices }))
      .catch(err => sendResponse({ error: err.message, devices: [] }));
    return true;
  }

  // 9. 迅雷远程通道：切换目标设备
  if (message.type === 'xlRemoteSelectDevice') {
    xlCloud.saveCredentials({
      xl_selected_target: message.target,
      xl_selected_target_name: message.name,
      xl_parent_folder_id: '',
      xl_parent_folder_path: ''
    }).then(() => sendResponse({ success: true }));
    return true;
  }

  // 10. 迅雷远程通道：退出登录
  if (message.type === 'xlRemoteLogout') {
    xlCloud.clearCredentials()
      .then(() => sendResponse({ success: true }));
    return true;
  }

  // 11. 迅雷远程通道：获取当前账号和设备状态
  if (message.type === 'xlRemoteGetStatus') {
    (async () => {
      try {
        const creds = await xlCloud.getCredentials();
        const isLoggedIn = !!creds.xl_access_token;
        let devices = [];
        if (isLoggedIn) {
          try {
            devices = await xlCloud.getDeviceTargets();
          } catch (e) {
            console.warn('获取设备列表失败:', e);
          }
        }
        sendResponse({
          isLoggedIn,
          username: creds.xl_login_name || '',
          selectedTarget: creds.xl_selected_target || '',
          selectedTargetName: creds.xl_selected_target_name || '',
          devices,
          needVerify: !!creds.xl_review_url,
          reviewUrl: creds.xl_review_url || ''
        });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }
});
