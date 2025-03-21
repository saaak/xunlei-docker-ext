// 获取DOM元素
const configPage = document.getElementById('configPage');
const taskPage = document.getElementById('taskPage');
const configForm = document.getElementById('configForm');
const dockerHostInput = document.getElementById('dockerHost');
const dockerPortInput = document.getElementById('dockerPort');
const taskList = document.getElementById('taskList');
const configButton = document.getElementById('configButton');
const uncompletedTab = document.getElementById('uncompletedTab');
const completedTab = document.getElementById('completedTab');

let currentTab = 'uncompleted';

// 页面初始化
document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.sync.get(['host', 'port', 'ssl']);
  if (config.host && config.port) {
    showTaskPage();
    await refreshTaskList();
    setInterval(refreshTaskList, 5000);
  } else {
    showConfigPage();
  }

  // 绑定tab点击事件
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
});

// 显示配置页面
function showConfigPage() {
  configPage.style.display = 'block';
  taskPage.style.display = 'none';
}

// 显示任务页面
function showTaskPage() {
  configPage.style.display = 'none';
  taskPage.style.display = 'block';
}

// 处理配置表单提交
configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const config = {
    host: dockerHostInput.value,
    port: dockerPortInput.value
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

// 处理配置按钮点击
configButton.addEventListener('click', () => {
  showConfigPage();
});

// 获取并展示任务列表
async function refreshTaskList() {
  try {
    const messageType = currentTab === 'uncompleted' ? 'getTasks' : 'getCompletedTasks';
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