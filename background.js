import { ApiClient } from './src/utils/api.js';

let apiClient = null;
let deviceId = null;

// 监听扩展图标点击
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!apiClient) {
      // 从storage中获取配置
      const config = await chrome.storage.sync.get(['host', 'port', 'ssl']);
      if (!config.host || !config.port) {
        // 打开配置页面
        chrome.tabs.create({ url: 'popup/popup.html' });
        return;
      }
      
      apiClient = new ApiClient(config.host, config.port, config.ssl);
    }

    // 获取deviceId
    deviceId = await apiClient.getDeviceId();
    
    // 保存deviceId
    await chrome.storage.sync.set({ deviceId });

    // 打开popup页面
    chrome.action.setPopup({ popup: 'popup/popup.html' });
    
  } catch (error) {
    console.error('Failed to get device ID:', error);
    // 显示错误提示
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '获取设备ID失败',
      message: error.message
    });
  }
});

// 监听配置更新
chrome.storage.onChanged.addListener((changes) => {
  if (changes.host || changes.port || changes.ssl) {
    // 配置更新时重置apiClient
    apiClient = null;
    deviceId = null;
  }
});