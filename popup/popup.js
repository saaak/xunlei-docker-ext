const configPage = document.getElementById('configPage');
const taskPage = document.getElementById('taskPage');
const configForm = document.getElementById('configForm');
const dockerHostInput = document.getElementById('dockerHost');
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

function showConfigPage() {
  chrome.storage.sync.get(['host', 'port', 'ssl', 'defaultFileType']).then((config) => {
    dockerHostInput.value = config.host || '';
    dockerPortInput.value = config.port || '';
    defaultFileTypeInput.value = config.defaultFileType || '';
  });
  configPage.style.display = 'block';
  taskPage.style.display = 'none';
}

function showTaskPage() {
  configPage.style.display = 'none';
  taskPage.style.display = 'block';
}

configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const config = {
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