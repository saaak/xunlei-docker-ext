import { getDeviceId, getUncompletedTasks, extractFileList, createFolder, submitTask, getCompletedTasks, getParentFolderId } from './utils/api.js';
import { parseDeviceId } from './utils/util.js';
let deviceId = null;
let parentFolderId = null;

// 扩展图标点击事件
chrome.action.onClicked.addListener(async () => {
  try {
    const config = await chrome.storage.sync.get(['host', 'port', 'ssl']);
    
    if (!config.host || !config.port) {
      // 没配置，显示配置页
      await chrome.action.setPopup({ popup: 'popup/popup.html' });
      return;
    }

    // 没有缓存，尝试获取 deviceId
    try {
      const deviceResponse = await getDeviceId();
      const id = parseDeviceId(deviceResponse);
      if (id) {
        deviceId = id;
        await chrome.storage.local.set({ deviceId: id });
        await chrome.action.setPopup({ popup: 'popup/popup.html' });
      } else {
        // 解析失败，显示配置页
        await chrome.action.setPopup({ popup: 'popup/popup.html' });
      }
    } catch (err) {
      console.error('获取 DeviceId 失败:', err);
      // 获取失败，显示配置页
      await chrome.action.setPopup({ popup: 'popup/popup.html' });
    }

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

  if (message.type === 'getTasks' || message.type === 'getCompletedTasks') {
    try {
      const taskPromise = message.type === 'getTasks' ? getUncompletedTasks(deviceId) : getCompletedTasks(deviceId);
      taskPromise.then(resp => {
        const tasks = resp?.tasks ? resp.tasks : [];
        const res = tasks.map(task => ({
          file_name: task.name,
          name: task.name,
          file_size: parseInt(task.file_size),
          updated_time: task.updated_time,
          progress: task.progress || 0,
          real_path: task.params?.real_path || '',
          speed: parseInt(task.params?.speed || 0),
          created_time: task.created_time,
          origin: task
        }))
        sendResponse(res);
      })
      
    } catch (error) {
      console.error('Failed to get tasks:', error);
      sendResponse([]);
    }
    return true;
  }

  if (message.type === 'submitTask') {
    try {
      const task = message.task;
      if (task && task.magnetic_link) {
        extractFileList(task.magnetic_link).then(
          (extractRes) => {
            const resources = extractRes?.list?.resources;
            const taskName = resources?.[0]?.name;
            const taskFileCount = resources?.[0]?.file_count;
            const taskFiles = []
            function parseResources(resList) {
              for (const resource of resList) {
                if (resource.is_dir) {
                  parseResources(resource.dir.resources);
                } else {
                  const fileIndex = resource.file_index || 0;
                  taskFiles.push({
                    index: fileIndex,
                    file_size: resource.file_size,
                    file_name: resource.name
                  });
                }
              }
            }
            parseResources(resources);
            
            let finalTaskFiles = taskFiles;
            if (typeof preprocessFiles === 'function') {
              finalTaskFiles = preprocessFiles(taskFiles);
            }

            if (!parentFolderId) {
              getParentFolderId(deviceId).then(
                (res) => {
                  parentFolderId = res?.files?.[0]?.parent_id;

                  let targetParentId = parentFolderId;
                  // if (subDir) {
                  //   if (subDir.includes('/')) {
                  //     console.error("Multilevel subdirectories are not supported");
                  //     return false;
                  //   }
                  //   const createFolderBody = {
                  //     parent_id: parentFolderId,
                  //     name: subDir,
                  //     space: deviceId,
                  //     kind: "drive#folder"
                  //   };
                  //   const folderResponse = await createFolder(createFolderBody);
                  //   targetParentId = folderResponse?.file?.id;
                  // }
      
                  const subFileIndex = finalTaskFiles.map(f => f.index.toString());
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
                      parent_folder_id: targetParentId,
                      sub_file_index: subFileIndex.join(','),
                      file_id: ""
                    }
                  };
                  submitTask(submitBody);
                  sendResponse();
                }
              )
            } else {
              let targetParentId = parentFolderId;
              // if (subDir) {
              //   if (subDir.includes('/')) {
              //     console.error("Multilevel subdirectories are not supported");
              //     return false;
              //   }
              //   const createFolderBody = {
              //     parent_id: parentFolderId,
              //     name: subDir,
              //     space: deviceId,
              //     kind: "drive#folder"
              //   };
              //   const folderResponse = await createFolder(createFolderBody);
              //   targetParentId = folderResponse?.file?.id;
              // }
  
              const subFileIndex = finalTaskFiles.map(f => f.index.toString());
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
                  parent_folder_id: targetParentId,
                  sub_file_index: subFileIndex.join(','),
                  file_id: ""
                }
              };
              submitTask(submitBody);
              sendResponse();
            }

           
          }
        )
        

      } else {
        sendResponse({ error: '无效任务' });
      }
    } catch (error) {
      console.error('Failed to submit task:', error);
      sendResponse({ error: '提交任务失败' });
    }
  }
  
});

// 监听配置更新
chrome.storage.onChanged.addListener(() => {
  console.log('配置已更新，重置 ApiClient');
});
