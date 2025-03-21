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
          chrome.runtime.sendMessage({
            type: 'submitTask',
            task: {
              magnetic_link: link.href
            }
          }).then(
            response => {
              alert('提交任务: ' + response)
            }
          );
        } catch (error) {
          alert('提交任务失败: ' + error.message);
        }
      });
    }
  });
}

// 初始检测
detectMagnetLinks();

// 监听DOM变化
const observer = new MutationObserver(detectMagnetLinks);
observer.observe(document.body, {
  childList: true,
  subtree: true
});