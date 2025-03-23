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
const fileSelectTab = document.getElementById('fileSelectTab');
const fileTree = document.getElementById('fileTree');
const confirmSelection = document.getElementById('confirmSelection');
const fileSelectPage = document.getElementById('fileSelectPage');

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
      fileSelectTab.classList.remove('active');
      taskList.style.display = 'block';
      fileSelectPage.style.display = 'none';
      refreshTaskList();
    }
  });

  fileSelectTab.addEventListener('click', () => {
    if (currentTab !== 'fileSelect') {
      currentTab = 'fileSelect';
      fileSelectTab.classList.add('active');
      uncompletedTab.classList.remove('active');
      completedTab.classList.remove('active');
      taskList.style.display = 'none';
      fileSelectPage.style.display = 'block';
      loadFileTree();
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
// 加载文件树
async function loadFileTree() {
  try {
    chrome.runtime.sendMessage({ type: 'getFileTree' }, (files) => {
      fileTree.innerHTML = renderFileTree(files);
      addTreeEventListeners();
    });
  } catch (error) {
    console.error('Failed to load file tree:', error);
    fileTree.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

// 渲染文件树
function renderFileTree(files, level = 0) {
  return `
    <ul>
      ${files.map(file => `
        <li class="${file.isDirectory ? 'folder' : 'file'}">
          ${file.isDirectory ? `
            <input type="checkbox" ${file.checked ? 'checked' : ''}>
            <span>${file.name}</span>
          ` : `
            <input type="checkbox" ${file.checked ? 'checked' : ''}>
            <span>${file.name}</span>
          `}
          ${file.children ? renderFileTree(file.children, level + 1) : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

// 添加文件树事件监听
function addTreeEventListeners() {
  const folders = fileTree.querySelectorAll('.folder');
  folders.forEach(folder => {
    folder.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        folder.classList.toggle('open');
      }
    });
  });

  // 处理文件夹选择
  fileTree.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const parentLi = e.target.closest('li');
      if (parentLi.classList.contains('folder')) {
        const children = parentLi.querySelectorAll('input[type="checkbox"]');
        children.forEach(child => {
          child.checked = e.target.checked;
        });
      }
    }
  });
}

// 确认文件选择
confirmSelection.addEventListener('click', () => {
  const selectedFiles = [];
  const checkboxes = fileTree.querySelectorAll('input[type="checkbox"]:checked');
  
  checkboxes.forEach(checkbox => {
    const fileName = checkbox.nextElementSibling.textContent;
    if (!checkbox.closest('.folder')) {
      selectedFiles.push(fileName);
    }
  });

  chrome.runtime.sendMessage({
    type: 'setSelectedFiles',
    files: selectedFiles
  }, () => {
    currentTab = 'uncompleted';
    uncompletedTab.classList.add('active');
    fileSelectTab.classList.remove('active');
    taskList.style.display = 'block';
    fileSelectPage.style.display = 'none';
    refreshTaskList();
  });
});

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