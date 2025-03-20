// 获取DOM元素
const configPage = document.getElementById('configPage');
const taskPage = document.getElementById('taskPage');
const configForm = document.getElementById('configForm');
const dockerHostInput = document.getElementById('dockerHost');
const dockerPortInput = document.getElementById('dockerPort');
const taskList = document.getElementById('taskList');
const configButton = document.getElementById('configButton');

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ type: 'getConfig' }, (config) => {
    if (config.dockerHost && config.dockerPort) {
      // 已配置，显示任务页面
      showTaskPage();
      refreshTaskList();
    } else {
      // 未配置，显示配置页面
      showConfigPage();
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
    dockerHost: dockerHostInput.value,
    dockerPort: dockerPortInput.value
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
function refreshTaskList() {
  chrome.runtime.sendMessage(
    { type: 'getTasks' },
    (tasks) => {
      taskList.innerHTML = tasks
        .map(task => `
          <div class="task-item">
            <span>${task.name}</span>
            <span>${task.status}</span>
            <span>${task.progress}%</span>
          </div>
        `)
        .join('');
    }
  );
}