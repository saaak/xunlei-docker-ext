import { getDeviceId, getUncompletedTasks, extractFileList, createFolder, submitTask, getCompletedTasks, getParentFolderId } from './utils/api.js';
import { parseDeviceId } from './utils/util.js';
let deviceId = null;
let parentFolderId = null;

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
        ssl: config.ssl || false
      }, () => {
        sendResponse({ success: true });
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
        
        await submitTask(submitBody);
        return { success: true };
      } catch (error) {
        console.error('Failed to submit task:', error);
        return { success: false, error: error.message };
      }
    };

    handleSubmitTask().then(sendResponse);
    return true;
  }
  
});
