// 配置存储
let config = {
  dockerHost: 'localhost',
  dockerPort: 9000,
  fileTypes: []
};

// 初始化配置
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ config });
});

// 监听popup消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'getConfig':
      chrome.storage.sync.get(['config'], (result) => {
        sendResponse(result.config);
      });
      return true;
      
    case 'updateConfig':
      chrome.storage.sync.set({ config: request.config }, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'submitTask':
      submitTask(request.task)
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ error }));
      return true;
  }
});

// 提交任务到Docker迅雷
async function submitTask(task) {
  const { dockerHost, dockerPort } = await getConfig();
  const url = `http://${dockerHost}:${dockerPort}/api/tasks`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(task)
    });
    
    return response.json();
  } catch (error) {
    throw new Error('无法连接到Docker迅雷');
  }
}

// 获取配置
function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['config'], (result) => {
      resolve(result.config);
    });
  });
}