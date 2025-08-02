// 检测页面中的magnet链接
function detectMagnetLinks() {
  const links = document.querySelectorAll('a[href^="magnet:"]');
  
  links.forEach(link => {
    if (!link.dataset.xunleiProcessed) {
      const button = document.createElement('button');
      button.className = 'xunlei-download-btn';
      button.textContent = 'Docker迅雷下载';
      
      link.parentNode.insertBefore(button, link.nextSibling);
      
      link.dataset.xunleiProcessed = true;
      
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
          chrome.runtime.sendMessage({
            type: 'getFileTree',
            magnetic_link: link.href
          }).then(files => {
            if (files.length > 0) {
              showFileSelection(files, link.href);
            } else {
              alert('未找到可下载的文件');
            }
          });
        } catch (error) {
          alert('提交任务失败: 请检查迅雷服务是否正常运行');
        }
      });
    }
  });
}

// 显示文件选择界面
async function showFileSelection(files, magneticLink) {
  const container = document.createElement('div');
  container.className = 'xunlei-file-selector';
  
  const taskNameContainer = document.createElement('div');
  taskNameContainer.className = 'xunlei-task-name';
  
  const taskNameLabel = document.createElement('label');
  taskNameLabel.textContent = '任务名(文件夹名):';
  taskNameLabel.htmlFor = 'xunlei-task-name-input';
  
  const taskNameInput = document.createElement('input');
  taskNameInput.type = 'text';
  taskNameInput.id = 'xunlei-task-name-input';
  taskNameInput.placeholder = '输入任务名(默认为第一个文件名)';
  taskNameInput.value = files[0]?.name || '';
  
  taskNameContainer.appendChild(taskNameLabel);
  taskNameContainer.appendChild(taskNameInput);
  container.appendChild(taskNameContainer);
  
  const defaultFileType = await getDefaultFileType();
  function createFileTree(files, parent) {

    const ul = document.createElement('ul');
    files.forEach(file => {
      const li = document.createElement('li');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = defaultFileType.includes(file.name.split('.').pop());
      checkbox.dataset.fileIndex = file.file_index;
      checkbox.dataset.fileSize = file.file_size;
      checkbox.dataset.fileName = file.name;
      
      if (file.isDirectory) {
        checkbox.addEventListener('change', (e) => {
          const checked = e.target.checked;
          const childCheckboxes = li.querySelectorAll('input[type="checkbox"]');
          childCheckboxes.forEach(childBox => {
            childBox.checked = checked;
          });
        });
      } else {
        checkbox.addEventListener('change', () => {
          let parentLi = li.parentElement.closest('li');
          while (parentLi) {
            const parentCheckbox = parentLi.querySelector(':scope > input[type="checkbox"]');
            const childCheckboxes = parentLi.querySelectorAll(':scope > ul > li > input[type="checkbox"]');
            const allChecked = Array.from(childCheckboxes).every(box => box.checked);
            const anyOneUnchecked = Array.from(childCheckboxes).some(box => !box.checked);
            if (allChecked) {
              parentCheckbox.checked = true;
            } else if (anyOneUnchecked) {
              parentCheckbox.checked = false;
            }
            
            parentLi = parentLi.parentElement.closest('li');
          }
        });
      }
      
      const label = document.createElement('label');
      if (file.isDirectory) {
        label.innerHTML = `${file.name} <span class="directory-hint">(选择将全选子文件)</span>`;
        label.className = 'directory';
      } else {
        label.textContent = file.name;
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
    
    const taskName = taskNameInput.value.trim() || selectedFiles[0]?.file_name || '下载任务';
    
    chrome.runtime.sendMessage({
      type: 'submitTask',
      task: {
        magnetic_link: magneticLink,
        selected_files: selectedFiles,
        task_name: taskName
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


async function getDefaultFileType() {
  let defaultFileType = await chrome.storage.sync.get(['defaultFileType']);
  if (defaultFileType.defaultFileType) {
    return defaultFileType.defaultFileType.split(',').map(type => type.trim());
  }
  return [];
}
