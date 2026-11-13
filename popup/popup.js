// DOM 元素获取
const configPage = document.getElementById('configPage');
const taskPage = document.getElementById('taskPage');
const currentModeBadge = document.getElementById('currentModeBadge');
const configButton = document.getElementById('configButton');
const configStatusMessage = document.getElementById('configStatusMessage');

// 模式切换
const modeRemoteTab = document.getElementById('modeRemoteTab');
const modeLocalTab = document.getElementById('modeLocalTab');
const remoteConfigSection = document.getElementById('remoteConfigSection');
const localConfigSection = document.getElementById('localConfigSection');

// 远程模式元素
const remoteLoginForm = document.getElementById('remoteLoginForm');
const remoteLoggedInView = document.getElementById('remoteLoggedInView');
const remoteUsernameInput = document.getElementById('remoteUsername');
const remotePasswordInput = document.getElementById('remotePassword');
const remoteDefaultDownloadDir = document.getElementById('remoteDefaultDownloadDir');
const remoteDefaultFileType = document.getElementById('remoteDefaultFileType');
const remoteLoginBtn = document.getElementById('remoteLoginBtn');

// 短信验证元素
const remoteSmsSection = document.getElementById('remoteSmsSection');
const remoteSmsDesc = document.getElementById('remoteSmsDesc');
const remoteSmsCode = document.getElementById('remoteSmsCode');
const remoteSendSmsBtn = document.getElementById('remoteSendSmsBtn');
const remoteCheckSmsBtn = document.getElementById('remoteCheckSmsBtn');

// 远程已登录元素
const remoteUserDisplay = document.getElementById('remoteUserDisplay');
const remoteLogoutBtn = document.getElementById('remoteLogoutBtn');
const remoteDeviceSelect = document.getElementById('remoteDeviceSelect');
const remoteLoggedInDefaultDownloadDir = document.getElementById('remoteLoggedInDefaultDownloadDir');
const remoteLoggedInFileType = document.getElementById('remoteLoggedInFileType');
const remoteSaveBtn = document.getElementById('remoteSaveBtn');

// 本地模式元素
const localConfigForm = document.getElementById('localConfigForm');
const platformSelect = document.getElementById('platform');
const dockerHostInput = document.getElementById('dockerHost');
const portGroup = document.getElementById('portGroup');
const dockerPortInput = document.getElementById('dockerPort');
const localDefaultDownloadDir = document.getElementById('localDefaultDownloadDir');
const defaultFileTypeInput = document.getElementById('defaultFileType');

// 任务页面元素
const uncompletedTab = document.getElementById('uncompletedTab');
const completedTab = document.getElementById('completedTab');
const taskList = document.getElementById('taskList');

let currentMode = 'remote'; // 'remote' | 'local'
let currentTab = 'uncompleted'; // 'uncompleted' | 'completed'
let refreshTimer = null;
let smsCountdownTimer = null;

// -------------------------------------------------------------
// 页面初始化
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  const syncConfig = await chrome.storage.sync.get(['mode', 'host', 'port', 'platform', 'defaultFileType', 'defaultDownloadDir']);
  const remoteStatus = await sendMessageAsync({ type: 'xlRemoteGetStatus' });

  // 决定初始模式
  if (syncConfig.mode) {
    currentMode = syncConfig.mode;
  } else if (remoteStatus && remoteStatus.isLoggedIn) {
    currentMode = 'remote';
  } else if (syncConfig.host && syncConfig.port) {
    currentMode = 'local';
  } else {
    currentMode = 'remote';
  }

  updateModeUI(currentMode);

  // 检查是否具备直接进入任务页的条件
  const isRemoteReady = currentMode === 'remote' && remoteStatus && remoteStatus.isLoggedIn && remoteStatus.selectedTarget;
  const isLocalReady = currentMode === 'local' && syncConfig.host && syncConfig.port;

  if (isRemoteReady || isLocalReady) {
    showTaskPage(remoteStatus, syncConfig);
  } else {
    showConfigPage(remoteStatus, syncConfig);
  }

  // 绑定事件
  bindEvents();
});

function bindEvents() {
  modeRemoteTab.addEventListener('click', () => {
    currentMode = 'remote';
    updateModeUI('remote');
  });

  modeLocalTab.addEventListener('click', () => {
    currentMode = 'local';
    updateModeUI('local');
  });

  platformSelect.addEventListener('change', updatePortVisibility);

  configButton.addEventListener('click', async () => {
    const syncConfig = await chrome.storage.sync.get(['mode', 'host', 'port', 'platform', 'defaultFileType', 'defaultDownloadDir']);
    const remoteStatus = await sendMessageAsync({ type: 'xlRemoteGetStatus' });
    showConfigPage(remoteStatus, syncConfig);
  });

  // 任务标签切换
  uncompletedTab.addEventListener('click', () => {
    if (currentTab !== 'uncompleted') {
      currentTab = 'uncompleted';
      uncompletedTab.classList.add('active');
      completedTab.classList.remove('active');
      refreshTaskList();
    }
  });

  completedTab.addEventListener('click', () => {
    if (currentTab !== 'completed') {
      currentTab = 'completed';
      completedTab.classList.add('active');
      uncompletedTab.classList.remove('active');
      refreshTaskList();
    }
  });

  // 远程登录
  remoteLoginBtn.addEventListener('click', handleRemoteLogin);
  remoteSendSmsBtn.addEventListener('click', handleSendSms);
  remoteCheckSmsBtn.addEventListener('click', handleCheckSms);
  remoteLogoutBtn.addEventListener('click', handleRemoteLogout);
  remoteSaveBtn.addEventListener('click', handleRemoteSave);

  // 本地表单提交
  localConfigForm.addEventListener('submit', handleLocalSubmit);
}

// -------------------------------------------------------------
// UI 显示与切换
// -------------------------------------------------------------

function showStatus(text, type = 'info') {
  configStatusMessage.textContent = text;
  configStatusMessage.className = `status-msg ${type}`;
  configStatusMessage.style.display = 'block';
}

function clearStatus() {
  configStatusMessage.style.display = 'none';
  configStatusMessage.textContent = '';
}

function updateModeUI(mode) {
  clearStatus();
  if (mode === 'remote') {
    modeRemoteTab.classList.add('active');
    modeLocalTab.classList.remove('active');
    remoteConfigSection.style.display = 'block';
    localConfigSection.style.display = 'none';
  } else {
    modeLocalTab.classList.add('active');
    modeRemoteTab.classList.remove('active');
    remoteConfigSection.style.display = 'none';
    localConfigSection.style.display = 'block';
    updatePortVisibility();
  }
}

function updatePortVisibility() {
  if (platformSelect.value === 'fnos') {
    portGroup.style.display = 'none';
    dockerPortInput.value = '5666';
  } else {
    portGroup.style.display = 'block';
    if (!dockerPortInput.value || dockerPortInput.value === '5666') {
      dockerPortInput.value = '2345';
    }
  }
}

async function showConfigPage(remoteStatus, syncConfig) {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  configPage.style.display = 'block';
  taskPage.style.display = 'none';

  const defaultDir = syncConfig?.defaultDownloadDir || '';

  // 回填本地配置
  platformSelect.value = syncConfig?.platform || 'docker';
  dockerHostInput.value = syncConfig?.host || '';
  dockerPortInput.value = syncConfig?.port || '';
  localDefaultDownloadDir.value = defaultDir;
  defaultFileTypeInput.value = syncConfig?.defaultFileType || '';
  updatePortVisibility();

  // 回填远程配置
  if (remoteStatus && remoteStatus.isLoggedIn) {
    remoteLoginForm.style.display = 'none';
    remoteLoggedInView.style.display = 'block';
    remoteUserDisplay.textContent = `已登录: ${remoteStatus.username || '迅雷账号'}`;
    remoteLoggedInDefaultDownloadDir.value = defaultDir;
    remoteLoggedInFileType.value = syncConfig?.defaultFileType || '';

    // 填充设备下拉框
    populateDeviceSelect(remoteStatus.devices || [], remoteStatus.selectedTarget);
  } else {
    remoteLoginForm.style.display = 'block';
    remoteLoggedInView.style.display = 'none';
    remoteDefaultDownloadDir.value = defaultDir;
    remoteDefaultFileType.value = syncConfig?.defaultFileType || '';
    if (remoteStatus && remoteStatus.username) {
      remoteUsernameInput.value = remoteStatus.username;
    }
    if (remoteStatus && remoteStatus.needVerify) {
      remoteSmsSection.style.display = 'block';
      remoteSmsDesc.textContent = '此账号曾触发风控，需要输入短信验证码：';
    } else {
      remoteSmsSection.style.display = 'none';
    }
  }
}

function populateDeviceSelect(devices, selectedTarget) {
  remoteDeviceSelect.innerHTML = '';
  if (!devices || devices.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '未发现绑定设备，请在迅雷中完成绑定';
    remoteDeviceSelect.appendChild(opt);
    return;
  }

  devices.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.target;
    opt.textContent = `${d.name} (${d.online ? '🟢在线' : '⚪离线'})`;
    if (d.target === selectedTarget || (!selectedTarget && d.online)) {
      opt.selected = true;
    }
    remoteDeviceSelect.appendChild(opt);
  });
}

function showTaskPage(remoteStatus, syncConfig) {
  configPage.style.display = 'none';
  taskPage.style.display = 'block';

  // 徽标更新
  if (currentMode === 'remote') {
    const targetName = remoteStatus?.selectedTargetName || '远程设备';
    currentModeBadge.textContent = `迅雷远程: ${targetName}`;
    currentModeBadge.style.background = '#e1f5fe';
    currentModeBadge.style.color = '#0288d1';
  } else {
    const host = syncConfig?.host || '127.0.0.1';
    currentModeBadge.textContent = `本地: ${host}`;
    currentModeBadge.style.background = '#e8f5e9';
    currentModeBadge.style.color = '#2e7d32';
  }

  refreshTaskList();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshTaskList, 5000);
}

// -------------------------------------------------------------
// 远程登录处理逻辑
// -------------------------------------------------------------

async function handleRemoteLogin() {
  const username = remoteUsernameInput.value.trim();
  const password = remotePasswordInput.value;
  const downloadDir = remoteDefaultDownloadDir.value.trim();
  const fileType = remoteDefaultFileType.value.trim();

  if (!username || !password) {
    showStatus('请输入迅雷账号和密码', 'error');
    return;
  }

  remoteLoginBtn.disabled = true;
  remoteLoginBtn.textContent = '正在登录迅雷...';
  clearStatus();

  try {
    const res = await sendMessageAsync({
      type: 'xlRemoteLogin',
      username,
      password
    });

    if (res.error) {
      showStatus(res.error, 'error');
      remoteLoginBtn.disabled = false;
      remoteLoginBtn.textContent = '登录并绑定设备';
      return;
    }

    if (res.needVerify) {
      showStatus('本次登录触发迅雷安全验证，请获取并填写短信验证码', 'info');
      remoteSmsSection.style.display = 'block';
      if (res.mobile) {
        remoteSmsDesc.textContent = `已向手机尾号 ${res.mobile.slice(-4)} 发送验证码：`;
      }
      remoteLoginBtn.disabled = false;
      remoteLoginBtn.textContent = '登录并绑定设备';
      return;
    }

    // 登录成功
    showStatus('登录成功，正在加载设备列表...', 'success');
    const syncUpdates = {};
    if (downloadDir) syncUpdates.defaultDownloadDir = downloadDir;
    if (fileType) syncUpdates.defaultFileType = fileType;
    if (Object.keys(syncUpdates).length > 0) {
      await chrome.storage.sync.set(syncUpdates);
    }

    await onRemoteLoginSuccess();
  } catch (err) {
    showStatus(`登录异常: ${err.message}`, 'error');
    remoteLoginBtn.disabled = false;
    remoteLoginBtn.textContent = '登录并绑定设备';
  }
}

async function handleSendSms() {
  remoteSendSmsBtn.disabled = true;
  remoteSendSmsBtn.textContent = '正在发送...';
  clearStatus();

  try {
    const res = await sendMessageAsync({ type: 'xlRemoteSendSms' });
    if (res.error) {
      showStatus(res.error, 'error');
      remoteSendSmsBtn.disabled = false;
      remoteSendSmsBtn.textContent = '获取验证码';
      return;
    }

    showStatus('验证码已发送，请注意查收短信', 'success');
    let countdown = 60;
    remoteSendSmsBtn.textContent = `${countdown}s 后重新获取`;
    if (smsCountdownTimer) clearInterval(smsCountdownTimer);
    smsCountdownTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(smsCountdownTimer);
        smsCountdownTimer = null;
        remoteSendSmsBtn.disabled = false;
        remoteSendSmsBtn.textContent = '获取验证码';
      } else {
        remoteSendSmsBtn.textContent = `${countdown}s 后重新获取`;
      }
    }, 1000);
  } catch (err) {
    showStatus(`发送异常: ${err.message}`, 'error');
    remoteSendSmsBtn.disabled = false;
    remoteSendSmsBtn.textContent = '获取验证码';
  }
}

async function handleCheckSms() {
  const smsCode = remoteSmsCode.value.trim();
  const username = remoteUsernameInput.value.trim();
  const password = remotePasswordInput.value;

  if (!/^\d{6}$/.test(smsCode)) {
    showStatus('请输入 6 位数字短信验证码', 'error');
    return;
  }

  remoteCheckSmsBtn.disabled = true;
  remoteCheckSmsBtn.textContent = '正在验证...';
  clearStatus();

  try {
    const res = await sendMessageAsync({
      type: 'xlRemoteCheckSms',
      smsCode,
      username,
      password
    });

    if (res.error) {
      showStatus(res.error, 'error');
      remoteCheckSmsBtn.disabled = false;
      remoteCheckSmsBtn.textContent = '验证并完成登录';
      return;
    }

    showStatus('验证成功，登录就绪！', 'success');
    await onRemoteLoginSuccess();
  } catch (err) {
    showStatus(`验证异常: ${err.message}`, 'error');
    remoteCheckSmsBtn.disabled = false;
    remoteCheckSmsBtn.textContent = '验证并完成登录';
  }
}

async function onRemoteLoginSuccess() {
  const status = await sendMessageAsync({ type: 'xlRemoteGetStatus' });
  const syncConfig = await chrome.storage.sync.get(['defaultFileType', 'defaultDownloadDir']);
  showConfigPage(status, syncConfig);
}

async function handleRemoteLogout() {
  await sendMessageAsync({ type: 'xlRemoteLogout' });
  remotePasswordInput.value = '';
  remoteSmsCode.value = '';
  remoteSmsSection.style.display = 'none';
  const status = await sendMessageAsync({ type: 'xlRemoteGetStatus' });
  const syncConfig = await chrome.storage.sync.get(['defaultFileType', 'defaultDownloadDir']);
  showConfigPage(status, syncConfig);
}

async function handleRemoteSave() {
  const target = remoteDeviceSelect.value;
  const selectedOption = remoteDeviceSelect.selectedOptions[0];
  const targetName = selectedOption ? selectedOption.textContent.replace(/\s*\([^)]*\)/, '') : '';
  const defaultDownloadDir = remoteLoggedInDefaultDownloadDir.value.trim();
  const defaultFileType = remoteLoggedInFileType.value.trim();

  if (!target) {
    showStatus('请选择有效的下载目标设备', 'error');
    return;
  }

  await chrome.storage.sync.set({
    mode: 'remote',
    defaultDownloadDir,
    defaultFileType
  });

  await sendMessageAsync({
    type: 'xlRemoteSelectDevice',
    target,
    name: targetName
  });

  const remoteStatus = await sendMessageAsync({ type: 'xlRemoteGetStatus' });
  showTaskPage(remoteStatus, { mode: 'remote' });
}

// -------------------------------------------------------------
// 本地模式处理逻辑
// -------------------------------------------------------------

async function handleLocalSubmit(e) {
  e.preventDefault();
  const config = {
    mode: 'local',
    platform: platformSelect.value,
    host: dockerHostInput.value.trim(),
    port: dockerPortInput.value.trim(),
    defaultDownloadDir: localDefaultDownloadDir.value.trim(),
    defaultFileType: defaultFileTypeInput.value.trim()
  };

  chrome.runtime.sendMessage({ type: 'updateConfig', config }, (res) => {
    if (res && res.success) {
      showTaskPage(null, config);
    } else {
      showStatus(res?.error || '配置保存失败', 'error');
    }
  });
}

// -------------------------------------------------------------
// 任务列表拉取与渲染
// -------------------------------------------------------------

async function refreshTaskList() {
  try {
    const messageType = currentTab === 'uncompleted' ? 'getUncompletedTasks' : 'getCompletedTasks';
    chrome.runtime.sendMessage({ type: messageType }, (tasks) => {
      if (!tasks || tasks.error) {
        taskList.innerHTML = `<div class="empty-tasks">获取任务失败: ${tasks?.error || '请检查配置或连接'}</div>`;
        return;
      }

      if (!Array.isArray(tasks) || tasks.length === 0) {
        taskList.innerHTML = `<div class="empty-tasks">暂无${currentTab === 'uncompleted' ? '进行中' : '已完成'}的下载任务</div>`;
        return;
      }

      taskList.innerHTML = tasks.map(task => {
        const speedMb = (task.speed / 1024 / 1024).toFixed(2);
        const progress = Math.min(100, Math.max(0, task.progress || 0));
        const sizeMb = (task.file_size / 1024 / 1024).toFixed(1);

        return `
          <div class="task-item">
            <div class="task-title" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</div>
            <div class="task-meta">
              ${currentTab === 'uncompleted' ? `
                <span class="task-speed">${speedMb > 0 ? `${speedMb} MB/s` : '排队中'} · ${progress}%</span>
                <span>${sizeMb} MB</span>
              ` : `
                <span>已完成</span>
                <span>${task.created_time ? new Date(task.created_time).toLocaleDateString() : ''}</span>
              `}
            </div>
          </div>
        `;
      }).join('');
    });
  } catch (error) {
    console.error('Failed to get tasks:', error);
    taskList.innerHTML = `<div class="empty-tasks">${error.message}</div>`;
  }
}

// -------------------------------------------------------------
// 工具函数
// -------------------------------------------------------------

function sendMessageAsync(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      resolve(response || {});
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
