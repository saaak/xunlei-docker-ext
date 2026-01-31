import {
  getDeviceId,
  getUncompletedTasks,
  extractFileList,
  createFolder,
  submitTask,
  getCompletedTasks,
  getParentFolderId
} from './utils/api.js';
import { parseDeviceId } from './utils/util.js';
import { clearAuthCache } from './utils/request.js';
let deviceId = null;
let parentFolderId = null;
let lastUncompletedTaskIds = new Set(); // 存储上次检查时未完成的任务ID
let lastUncompletedTaskMap = new Map(); // 存储上次检查时未完成的任务

// 检查任务完成状态并发送通知
async function checkTasksCompletion() {
  try {
    if (!deviceId) return;

    // 获取未完成的任务
    const uncompletedTasksResponse = await getUncompletedTasks(deviceId);
    const uncompletedTasks = uncompletedTasksResponse?.tasks || [];
    const uncompletedTaskIds = new Set(uncompletedTasks.map(task => task.id));
    const newCompletedTaskIds = new Set([...lastUncompletedTaskIds].filter(id => !uncompletedTaskIds.has(id)));

    // 检查是否有新完成的任务
    for (const taskId of newCompletedTaskIds) {
      const task = lastUncompletedTaskMap.get(taskId);
      // 发送通知
      chrome.notifications.create(taskId, {
        type: 'basic',
        iconUrl: 'assets/icon128.png',
        title: '下载任务完成',
        message: `任务「${task.name}」已下载完成`,
        priority: 2
      });
      // 移除已完成的任务
      lastUncompletedTaskMap.delete(taskId);

    }
    // 存储新完成的任务
    for (const task of uncompletedTasks) {
      lastUncompletedTaskMap.set(task.id, task);
    }
    // 更新未完成任务ID记录
    lastUncompletedTaskIds = uncompletedTaskIds;
    
  } catch (error) {
    console.error('检查任务完成状态失败:', error);
  }
}

// 初始化deviceId
async function initDeviceId() {
  try {
    const cachedDevice = await chrome.storage.local.get(['deviceId']);
    if (cachedDevice.deviceId) {
      deviceId = cachedDevice.deviceId;
      return;
    }

    const deviceResponse = await getDeviceId();
    const id = parseDeviceId(deviceResponse);
    if (id) {
      deviceId = id;
      await chrome.storage.local.set({ deviceId: id });
    }
  } catch (error) {
    console.error('初始化deviceId失败:', error);
  }
}

async function ensureDeviceIdInitialized() {
  if (!deviceId) {
    console.log('deviceId is null, attempting to initialize...');
    await initDeviceId();
  }
  if (!deviceId) {
    throw new Error('无法初始化 deviceId。请检查配置或网络连接。');
  }
}

// 定期检查任务完成状态
function startTaskCompletionCheck() {
  // 立即执行一次检查
  checkTasksCompletion();
  // 每30秒检查一次任务完成状态
  setInterval(checkTasksCompletion, 30000);
}

// 扩展初始化
async function initExtension() {
  try {
    const config = await chrome.storage.sync.get(['host', 'port', 'ssl']);
    
    if (config.host && config.port) {
      await initDeviceId();
      // 启动任务完成检查
      startTaskCompletionCheck();
    }
  } catch (error) {
    console.error('扩展初始化失败:', error);
  }
}

// 扩展安装或启动时初始化
chrome.runtime.onInstalled.addListener(() => {
  initExtension();
});

// 浏览器启动时初始化
chrome.runtime.onStartup.addListener(() => {
  initExtension();
});

// 扩展图标点击事件
chrome.action.onClicked.addListener(async () => {
  try {
    const config = await chrome.storage.sync.get(['host', 'port', 'ssl']);
    
    if (!config.host || !config.port) {
      await chrome.action.setPopup({ popup: 'popup/popup.html' });
      return;
    }

    await initDeviceId();
    await chrome.action.setPopup({ popup: 'popup/popup.html' });

  } catch (error) {
    console.error('初始化失败:', error);
    await chrome.action.setPopup({ popup: 'popup/popup.html' });
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
        ssl: config.ssl || false,
        platform: config.platform || 'docker',
        defaultFileType: config.defaultFileType || ''
      }, async () => {
        try {
          // 清除认证缓存和状态
          await clearAuthCache();
          await chrome.storage.local.remove('deviceId');
          deviceId = null;
          parentFolderId = null;
          
          // 重新初始化
          await initDeviceId();
          console.log('配置更新并刷新认证信息完成');
          sendResponse({ success: true });
        } catch (error) {
          console.error('刷新认证信息失败:', error);
          sendResponse({ success: true }); // 依然返回成功，因为配置已保存
        }
      });
      return true;
    } else {
      sendResponse({ success: false, error: '无效配置' });
    }
  }

  if (message.type === 'getUncompletedTasks' || message.type === 'getCompletedTasks') {
      (async () => {
        try {
          await ensureDeviceIdInitialized();
          const taskPromise = message.type === 'getUncompletedTasks' ? getUncompletedTasks(deviceId) : getCompletedTasks(deviceId);
          taskPromise.then(resp => {
            const tasks = resp?.tasks ? resp.tasks : [];
            const res = tasks.map(task => (
              {
                file_name: task.name,
                name: task.name,
                file_size: parseInt(task.file_size),
                updated_time: task.updated_time,
                progress: task.progress || 0,
                real_path: task.params?.real_path || '',
                speed: parseInt(task.params?.speed || 0),
                created_time: task.created_time,
                origin: task
              }
            ));
            sendResponse(res);
          }).catch(error => {
            sendResponse({ error: error.message, tasks: [] });
          });
        } catch (error) {
          sendResponse({ error: error.message, tasks: [] });
        }
      })();
      return true;
  }

  if (message.type === 'getFileTree') {
    (async () => {
      try {
        if (!message.magnetic_link) {
          throw new Error('缺少磁力链接');
        }
        
        const extractRes = await extractFileList(message.magnetic_link);
        const resources = extractRes?.list?.resources || [];
        
        function parseResources(resList) {
          return resList.map(resource => ({
            name: resource.name,
            isDirectory: resource.is_dir,
            children: resource.is_dir ? parseResources(resource.dir.resources) : [],
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

  if (message.type === 'submitTask') {
    const handleSubmitTask = async () => {
      try {
        await ensureDeviceIdInitialized();
        const task = message.task;
        if (!task || !task.magnetic_link || !task.selected_files) {
          throw new Error('无效任务');
        }

        const finalTaskFiles = task.selected_files;
        const taskName = message.task.task_name || finalTaskFiles[0]?.file_name || '下载任务';
        const taskFileCount = finalTaskFiles.length;

        if (!parentFolderId) {
          const res = await getParentFolderId(deviceId);
          parentFolderId = res?.files?.[0]?.parent_id;
        }

        const submitBody = {
          type: "user#download-url",
          name: taskName,
          file_name: taskName,
          file_size: finalTaskFiles.reduce((sum, f) => sum + f.file_size, 0).toString(),
          space: deviceId,
          params: {
            target: deviceId,
            url: task.magnetic_link,
            total_file_count: taskFileCount.toString(),
            parent_folder_id: parentFolderId,
            sub_file_index: finalTaskFiles.map(f => f.index.toString()).join(','),
            file_id: ""
          }
        };
        
        const res = await submitTask(submitBody);

        if (res?.HttpStatus !== 0) {
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
  
});
