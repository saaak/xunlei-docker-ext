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
  button.textContent = '迅雷下载';
  
  insertAfter.parentNode.insertBefore(button, insertAfter.nextSibling);
  
  targetElement.dataset.xunleiProcessed = true;
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // 检查扩展上下文连接是否依然有效（扩展重载后需提示刷新网页）
    if (!chrome.runtime?.id) {
      alert('扩展已更新或重新加载，请刷新当前网页(F5)后再点击下载！');
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '解析中...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'getFileTree',
        magnetic_link: magnetLink
      });

      if (response && response.error) {
        alert('解析磁力链接失败: ' + response.error);
        return;
      }

      if (Array.isArray(response) && response.length > 0) {
        showFileSelection(response, magnetLink);
      } else {
        alert('未找到可下载的文件，可能链接暂无可用资源或解析超时');
      }
    } catch (error) {
      console.error('解析磁力链接失败:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        alert('扩展已重新加载，请刷新当前网页(F5)后再点击下载！');
      } else {
        alert('解析任务失败: ' + (error.message || '请检查迅雷服务或网络连接'));
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

// 显示文件选择界面
async function showFileSelection(files, magneticLink) {
  const container = document.createElement('div');
  container.className = 'xunlei-file-selector';
  
  const config = await getDefaultConfig();
  
  // 1. 下载子目录容器
  const taskDirContainer = document.createElement('div');
  taskDirContainer.className = 'xunlei-task-dir';
  
  const taskDirLabel = document.createElement('label');
  taskDirLabel.textContent = '下载子目录 (可选):';
  taskDirLabel.htmlFor = 'xunlei-task-dir-input';
  
  const taskDirInput = document.createElement('input');
  taskDirInput.type = 'text';
  taskDirInput.id = 'xunlei-task-dir-input';
  taskDirInput.placeholder = '例如 /folder/ 或 /电影/，留空保存到根目录';
  taskDirInput.value = config.defaultDownloadDir || '';
  
  taskDirContainer.appendChild(taskDirLabel);
  taskDirContainer.appendChild(taskDirInput);
  container.appendChild(taskDirContainer);

  // 2. 任务名容器
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
  
  const defaultFileType = config.defaultFileType || [];

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
  confirmBtn.addEventListener('click', async () => {
    const selectedFiles = [];
    container.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      if (!checkbox.parentElement.querySelector('.directory')) {
        selectedFiles.push({
          index: parseInt(checkbox.dataset.fileIndex, 10),
          file_size: parseInt(checkbox.dataset.fileSize, 10),
          file_name: checkbox.dataset.fileName
        });
      }
    });

    if (selectedFiles.length === 0) {
      alert('请至少勾选一个需要下载的文件');
      return;
    }
    
    const rawTaskName = taskNameInput.value.trim() || selectedFiles[0]?.file_name || '下载任务';
    let dir = taskDirInput.value.trim();
    let finalTaskName = rawTaskName;

    if (dir) {
      if (!dir.startsWith('/')) dir = '/' + dir;
      if (!dir.endsWith('/')) dir = dir + '/';
      
      // 如果用户在任务名中没有重复手写此目录前缀，自动拼接
      if (!rawTaskName.startsWith(dir)) {
        finalTaskName = `${dir}${rawTaskName.replace(/^\/+/, '')}`;
      }
    }

    if (!chrome.runtime?.id) {
      alert('扩展已更新或重新加载，请刷新当前网页(F5)后再试');
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = '正在提交任务...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'submitTask',
        task: {
          magnetic_link: magneticLink,
          selected_files: selectedFiles,
          task_name: finalTaskName,
          download_dir: dir
        }
      });

      if (response && response.success) {
        alert('任务已成功提交至迅雷下载！');
        container.remove();
      } else {
        alert('提交任务失败: ' + (response?.error || '未知错误'));
      }
    } catch (error) {
      console.error('提交任务异常:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        alert('扩展已更新或重新加载，请刷新当前网页(F5)后再试');
      } else {
        alert('提交任务失败: ' + (error.message || '网络连接异常'));
      }
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '确认选择';
    }
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

async function getDefaultConfig() {
  try {
    if (!chrome.runtime?.id) return { defaultFileType: [], defaultDownloadDir: '' };
    const data = await chrome.storage.sync.get(['defaultFileType', 'defaultDownloadDir']);
    let fileTypes = [];
    if (data.defaultFileType) {
      fileTypes = data.defaultFileType.split(',').map(type => type.trim());
    }
    return {
      defaultFileType: fileTypes,
      defaultDownloadDir: (data.defaultDownloadDir || '').trim()
    };
  } catch (e) {
    return { defaultFileType: [], defaultDownloadDir: '' };
  }
}
