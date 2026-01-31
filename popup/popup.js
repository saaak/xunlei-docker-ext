const configPage = document.getElementById('configPage');
const taskPage = document.getElementById('taskPage');
const configForm = document.getElementById('configForm');
const platformSelect = document.getElementById('platform');
const dockerHostInput = document.getElementById('dockerHost');
const portGroup = document.getElementById('portGroup');
const dockerPortInput = document.getElementById('dockerPort');
const defaultFileTypeInput = document.getElementById('defaultFileType');
const taskList = document.getElementById('taskList');
const configButton = document.getElementById('configButton');
const uncompletedTab = document.getElementById('uncompletedTab');
const completedTab = document.getElementById('completedTab');
let currentTab = 'uncompleted';

document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.sync.get(['host', 'port', 'ssl', 'defaultFileType']);
  if (config.host && config.port) {
    showTaskPage();
    
    // 检查是否需要显示已完成任务标签
    const showCompletedTabData = await chrome.storage.local.get(['showCompletedTab']);
    if (showCompletedTabData.showCompletedTab) {
      // 切换到已完成任务标签
      currentTab = 'completed';
      completedTab.classList.add('active');
      uncompletedTab.classList.remove('active');
      
      // 清除标记，避免下次打开仍然自动切换
      chrome.storage.local.remove(['showCompletedTab']);
    }
    
    await refreshTaskList();
    setInterval(refreshTaskList, 5000);
  } else {
    showConfigPage();
  }

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
      taskList.style.display = 'block';
      refreshTaskList();
    }
  });
});

function updatePortVisibility() {
  if (platformSelect.value === 'fnos') {
    portGroup.style.display = 'none';
    dockerPortInput.value = '5666'; // 默认端口
  } else {
    portGroup.style.display = 'block';
  }
}

function showConfigPage() {
  chrome.storage.sync.get(['host', 'port', 'ssl', 'defaultFileType', 'platform']).then((config) => {
    platformSelect.value = config.platform || 'docker';
    dockerHostInput.value = config.host || '';
    dockerPortInput.value = config.port || '';
    defaultFileTypeInput.value = config.defaultFileType || '';
    updatePortVisibility();
  });
  configPage.style.display = 'block';
  taskPage.style.display = 'none';
}

platformSelect.addEventListener('change', updatePortVisibility);

function showTaskPage() {
  configPage.style.display = 'none';
  taskPage.style.display = 'block';
}

configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const config = {
    platform: platformSelect.value,
    host: dockerHostInput.value,
    port: dockerPortInput.value,
    defaultFileType: defaultFileTypeInput.value
  };
  
  chrome.runtime.sendMessage(
    { type: 'updateConfig', config },
    (response) => {
      if (response.success) {
        showTaskPage();
        refreshTaskList();
      }
    }
  );
});

configButton.addEventListener('click', () => {
  showConfigPage();
});

async function refreshTaskList() {
  try {
    const messageType = currentTab === 'uncompleted' ? 'getUncompletedTasks' : 'getCompletedTasks';
    chrome.runtime.sendMessage({ type: messageType }, (tasks) => {
      taskList.innerHTML = tasks
        .map(task => `
          <div class="task-item">
            <span>${task.name}</span>
            ${currentTab === 'uncompleted' ? `
              <span>${(task.speed / 1024 / 1024).toFixed(2)}Mb/s</span>
              <span>${task.progress}%</span>
            ` : `
              <span>已完成</span>
              <span>${new Date(task.created_time).toLocaleDateString()}</span>
            `}
          </div>
        `)
        .join('');
    });
    
  } catch (error) {
    console.error('Failed to get tasks:', error);
    taskList.innerHTML = error;
  }
}