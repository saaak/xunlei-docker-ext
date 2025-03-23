// 检测页面中的magnet链接
function detectMagnetLinks() {
  const links = document.querySelectorAll('a[href^="magnet:"]');
  
  links.forEach(link => {
    if (!link.dataset.xunleiProcessed) {
      // 创建下载按钮
      const button = document.createElement('button');
      button.className = 'xunlei-download-btn';
      button.textContent = 'Docker迅雷下载';
      
      // 插入按钮
      link.parentNode.insertBefore(button, link.nextSibling);
      
      // 标记已处理
      link.dataset.xunleiProcessed = true;
      
      // 添加点击事件
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
          // 先获取文件树
          chrome.runtime.sendMessage({
            type: 'getFileTree',
            magnetic_link: link.href
          }).then(files => {
            if (files.length > 0) {
              // 显示文件选择界面
              showFileSelection(files, link.href);
            } else {
              alert('未找到可下载的文件');
            }
          });
        } catch (error) {
          alert('提交任务失败: ' + error.message);
        }
      });
    }
  });
}

// 显示文件选择界面
function showFileSelection(files, magneticLink) {
  // 创建容器
  const container = document.createElement('div');
  container.className = 'xunlei-file-selector';
  
  // 创建文件树
  function createFileTree(files, parent) {
    const ul = document.createElement('ul');
    files.forEach(file => {
      const li = document.createElement('li');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.fileIndex = file.file_index;
      checkbox.dataset.fileSize = file.file_size;
      checkbox.dataset.fileName = file.name;
      
      const label = document.createElement('label');
      label.textContent = file.name;
      if (file.isDirectory) {
        label.className = 'directory';
      }
      
      li.appendChild(checkbox);
      li.appendChild(label);
      
      if (file.children && file.children.length > 0) {
        li.appendChild(createFileTree(file.children, li));
      }
      
      ul.appendChild(li);
    });
    return ul;
  }
  
  // 添加文件树
  container.appendChild(createFileTree(files));
  
  // 添加操作按钮
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'xunlei-buttons';
  
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '确认选择';
  confirmBtn.addEventListener('click', () => {
    const selectedFiles = [];
    container.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      if (!checkbox.parentElement.querySelector('.directory')) {
        selectedFiles.push({
          index: parseInt(checkbox.dataset.fileIndex),
          file_size: parseInt(checkbox.dataset.fileSize),
          file_name: checkbox.dataset.fileName
        });
      }
    });
    
    chrome.runtime.sendMessage({
      type: 'submitTask',
      task: {
        magnetic_link: magneticLink,
        selected_files: selectedFiles
      }
    }).then(response => {
      container.remove();
      alert('任务已提交');
    });
  });
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.addEventListener('click', () => {
    container.remove();
  });
  
  buttonContainer.appendChild(confirmBtn);
  buttonContainer.appendChild(cancelBtn);
  container.appendChild(buttonContainer);
  
  // 添加到页面
  document.body.appendChild(container);
}

// 初始检测
detectMagnetLinks();

// 监听DOM变化
const observer = new MutationObserver(detectMagnetLinks);
observer.observe(document.body, {
  childList: true,
  subtree: true
});