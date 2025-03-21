import { getDeviceId, getUncompletedTasks } from './utils/api.js';

let deviceId = null;

// 扩展图标点击事件
chrome.action.onClicked.addListener(async () => {
  try {
    await chrome.action.setPopup({ popup: 'popup/popup.html' });
  } catch (error) {
    console.error('Failed to init', error);
  }
});

// 消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateConfig') {
    const config = message.config || {};
    if (config.host && config.port) {
      chrome.storage.sync.set({
        host: config.host,
        port: config.port,
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
      getDeviceId().then(
        (id) => {
          deviceId = id;
          getUncompletedTasks(deviceId).then(
            (tasks) => {
              sendResponse(tasks);
            }
          )
        }
      )
      return true;
    } catch (error) {
      console.error('Failed to get tasks:', error);
      sendResponse([]);
    }
  }

  if (message.type === 'submitTask') {
    try {
      const task = message.task;
      if (task && task.magnetic_link) {
        const response = await chrome.runtime.sendMessage({
          type: 'submitTask',
          task: {
            magnetic_link: task.magnetic_link
          }
        });
        sendResponse(response);
      } else {
        sendResponse({ error: '无效任务' });
      }
    }
  }
  
});

// 监听配置更新
chrome.storage.onChanged.addListener(() => {
  console.log('配置已更新，重置 ApiClient');
});
