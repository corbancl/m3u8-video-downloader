// M3U8视频下载器 - Content Script
// 监控页面中的M3U8资源

(function() {
  'use strict';

  // 拦截XHR请求
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    return originalXHROpen.call(this, method, url, ...args);
  };

  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      if (this._url && isM3U8Url(this._url)) {
        reportM3U8(this._url);
      }
    });
    return originalXHRSend.apply(this, args);
  };

  // 拦截Fetch请求
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    const urlStr = typeof url === 'string' ? url : url.url;
    
    return originalFetch.apply(this, arguments).then(response => {
      if (urlStr && isM3U8Url(urlStr)) {
        reportM3U8(urlStr);
      }
      return response;
    });
  };

  // 检查是否是M3U8 URL
  function isM3U8Url(url) {
    // 排除图片资源
    const imagePatterns = [
      /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)(\?|$)/i,
      /\/image\//i,
      /\/img\//i,
      /\/images\//i,
      /\/assets\/.*\.(jpg|jpeg|png|gif|webp)/i
    ];
    if (imagePatterns.some(p => p.test(url))) {
      return false;
    }

    // M3U8匹配模式
    const m3u8Patterns = [
      /\.m3u8(\?|$)/i,
      /m3u8/i
    ];
    
    return m3u8Patterns.some(p => p.test(url));
  }

  // 报告发现的M3U8资源
  function reportM3U8(url) {
    // 过滤掉一些明显的非视频资源
    const excludePatterns = [
      /audio/i,
      /subtitle/i,
      /caption/i,
      /vtt$/i
    ];
    
    if (excludePatterns.some(p => p.test(url))) {
      return;
    }

    // 发送到background script
    chrome.runtime.sendMessage({
      action: 'foundM3U8',
      url: url,
      pageUrl: window.location.href,
      pageTitle: document.title
    });
  }

  // 监控video标签
  function observeVideoElements() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (video.src && isM3U8Url(video.src)) {
        reportM3U8(video.src);
      }
      
      // 检查source标签
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        if (source.src && isM3U8Url(source.src)) {
          reportM3U8(source.src);
        }
      });
    });
  }

  // 使用MutationObserver监控动态添加的video元素
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'VIDEO') {
          if (node.src && isM3U8Url(node.src)) {
            reportM3U8(node.src);
          }
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // 初始化时检查一次
  if (document.readyState === 'complete') {
    observeVideoElements();
  } else {
    window.addEventListener('load', observeVideoElements);
  }

  console.log('[M3U8下载器] 内容脚本已加载');
})();
