import ApiClient from './src/utils/api.js'; // 静态导入

let apiClient = null;
let deviceId = null;

// 初始化
init().catch(console.error);

async function init() {
  await tryInitApiClient();
}

// 初始化 apiClient 单例
async function tryInitApiClient() {
  if (apiClient) return apiClient;
  const config = await chrome.storage.sync.get(['host', 'port', 'ssl']);
  if (!config.host || !config.port) {
    return null; // 配置不完整
  }
  apiClient = new ApiClient(config.host, config.port, config.ssl);
  return apiClient;
}

// 扩展图标点击事件
chrome.action.onClicked.addListener(async () => {
  try {
    const client = await tryInitApiClient();
    // 获取 deviceId
    deviceId = await client.getDeviceId();

    // 保存 deviceId
    await chrome.storage.sync.set({ deviceId });

    // 设置 popup 页
    await chrome.action.setPopup({ popup: 'popup/popup.html' });

  } catch (error) {
    console.error('Failed to get device ID:', error);
    chrome.notifications.create({
      type: 'basic',
      title: '获取设备ID失败',
      message: error.message || '未知错误'
    });
  }
});

// 消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateConfig') {
    const config = message.config || {};
    if (config.dockerHost && config.dockerPort) {
      chrome.storage.sync.set({
        host: config.dockerHost,
        port: config.dockerPort,
        ssl: config.ssl || false
      }, () => {
        sendResponse({ success: true });
      });
      return true;
    } else {
      sendResponse({ success: false, error: '无效配置' });
    }
  }

  if (message.type === 'getTasks') {
    try {
      apiClient.uncompleted_tasks(sendResponse, deviceId);
      return true;
    } catch (error) {
      console.error('Failed to get tasks:', error);
      sendResponse([]);
    }
  }
  
});

// 监听配置更新
chrome.storage.onChanged.addListener(() => {
  console.log('配置已更新，重置 ApiClient');
  apiClient = null;
  deviceId = null;
});
