// 检测页面中的magnet链接
function detectMagnetLinks() {
  // 1. 检测a标签中的magnet链接
  const links = document.querySelectorAll('a[href^="magnet:"]');
  
  links.forEach(link => {
    if (!link.dataset.xunleiProcessed) {
      addDownloadButton(link, link.href, link);
    }
  });
  
  // 2. 检测页面中所有元素的magnet链接
  const magnetRegex = /magnet:\?[^\s<>"']+/gi;
  
  // 检测文本节点中的magnet链接
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // 跳过已处理的节点和脚本、样式标签
        if (node.parentElement.dataset.xunleiProcessed || 
            ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (magnetRegex.test(node.textContent)) {
      textNodes.push(node);
    }
  }
  
  textNodes.forEach(textNode => {
    const matches = textNode.textContent.match(magnetRegex);
    if (matches && !textNode.parentElement.dataset.xunleiProcessed) {
      matches.forEach(magnetLink => {
        // 为每个magnet链接创建一个包装元素
        const wrapper = document.createElement('span');
        wrapper.style.cssText = 'display: inline-block; margin: 0 5px; position: relative;';
        
        const linkText = document.createElement('code');
        linkText.textContent = magnetLink.substring(0, 50) + (magnetLink.length > 50 ? '...' : '');
        linkText.style.cssText = 'background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 12px;';
        
        wrapper.appendChild(linkText);
        
        // 替换原文本中的magnet链接
        const newContent = textNode.textContent.replace(magnetLink, '');
        textNode.textContent = newContent;
        
        // 插入包装元素
        textNode.parentElement.insertBefore(wrapper, textNode.nextSibling);
        
        addDownloadButton(wrapper, magnetLink, wrapper);
      });
      
      textNode.parentElement.dataset.xunleiProcessed = true;
    }
  });
  
  // 3. 检测其他标签的属性中的magnet链接
  const allElements = document.querySelectorAll('*:not(script):not(style):not(noscript)');
  
  allElements.forEach(element => {
    if (element.dataset.xunleiProcessed) return;
    
    const magnetLinks = [];
    
    // 检查常见属性
    const attributesToCheck = ['value', 'title', 'alt', 'placeholder', 'data-url', 'data-link', 'data-magnet'];
    
    attributesToCheck.forEach(attr => {
      const attrValue = element.getAttribute(attr);
      if (attrValue && magnetRegex.test(attrValue)) {
        const matches = attrValue.match(magnetRegex);
        if (matches) {
          matches.forEach(match => {
            if (!magnetLinks.includes(match)) {
              magnetLinks.push(match);
            }
          });
        }
      }
    });
    
    // 检查所有data-*属性
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') && magnetRegex.test(attr.value)) {
        const matches = attr.value.match(magnetRegex);
        if (matches) {
          matches.forEach(match => {
            if (!magnetLinks.includes(match)) {
              magnetLinks.push(match);
            }
          });
        }
      }
    });
    
    // 为找到的magnet链接添加下载按钮
    if (magnetLinks.length > 0) {
      magnetLinks.forEach(magnetLink => {
        // 创建显示元素
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: inline-block; margin: 2px; padding: 5px; border: 1px solid #ddd; border-radius: 5px; background: #f9f9f9;';
        
        const linkText = document.createElement('code');
        linkText.textContent = `[${element.tagName.toLowerCase()}] ${magnetLink.substring(0, 40)}${magnetLink.length > 40 ? '...' : ''}`;
        linkText.style.cssText = 'background: #e8e8e8; padding: 2px 4px; border-radius: 3px; font-size: 11px; display: block; margin-bottom: 3px;';
        
        wrapper.appendChild(linkText);
        
        // 插入到元素后面
        element.parentNode.insertBefore(wrapper, element.nextSibling);
        
        addDownloadButton(wrapper, magnetLink, wrapper);
      });
      
      element.dataset.xunleiProcessed = true;
    }
  });
}

// 添加下载按钮的通用函数
function addDownloadButton(targetElement, magnetLink, insertAfter) {
  if (targetElement.dataset.xunleiProcessed) return;
  
  const button = document.createElement('button');
  button.className = 'xunlei-download-btn';
  button.textContent = 'Docker迅雷下载';
  
  insertAfter.parentNode.insertBefore(button, insertAfter.nextSibling);
  
  targetElement.dataset.xunleiProcessed = true;
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    try {
      chrome.runtime.sendMessage({
        type: 'getFileTree',
        magnetic_link: magnetLink
      }).then(files => {
        if (files.length > 0) {
          showFileSelection(files, magnetLink);
        } else {
          alert('未找到可下载的文件');
        }
      });
    } catch (error) {
      alert('提交任务失败: 请检查迅雷服务是否正常运行');
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
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        checkbox.checked = !checkbox.checked;
      });
      
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
      if (response.success) {
        alert('任务已提交');
      } else {
        alert('提交任务失败: ' + response.error);
      }
      container.remove();
    }).catch(error => {
      alert('提交任务失败: ' + error.message);
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
