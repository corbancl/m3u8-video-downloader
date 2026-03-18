// M3U8视频下载器 - Background Service Worker

class M3U8Background {
  constructor() {
    this.init();
  }

  init() {
    this.setupWebRequestListener();
    this.setupMessageListener();
  }

  setupWebRequestListener() {
    // 监听所有网络请求，查找M3U8资源
    chrome.webRequest.onCompleted.addListener(
      (details) => {
        const url = details.url;
        
        // 检查是否是M3U8资源
        if (this.isM3U8Url(url)) {
          this.saveVideo(details.tabId, {
            url: url,
            source: this.extractSource(url),
            timestamp: Date.now()
          });
        }
      },
      { urls: ["<all_urls>"] }
    );
  }

  isM3U8Url(url) {
    const m3u8Patterns = [
      /\.m3u8/i,
      /\.m3u8\?/i,
      /m3u8/i,
      /playlist.*\.ts/i,
      /hls.*\.ts/i,
      /stream.*\.m3u8/i
    ];
    
    return m3u8Patterns.some(pattern => pattern.test(url));
  }

  extractSource(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '未知来源';
    }
  }

  async saveVideo(tabId, video) {
    const key = `videos_${tabId}`;
    const result = await chrome.storage.local.get(key);
    const videos = result[key] || [];
    
    // 避免重复
    if (!videos.find(v => v.url === video.url)) {
      videos.push(video);
      await chrome.storage.local.set({ [key]: videos });
      
      // 更新扩展图标徽章
      chrome.action.setBadgeText({ text: videos.length.toString(), tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#667eea', tabId });
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'download') {
        this.handleDownload(message.url, message.filename)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 异步响应
      }
      
      if (message.action === 'getVideos') {
        this.getVideos(message.tabId)
          .then(videos => sendResponse({ success: true, videos }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }
    });
  }

  async handleDownload(m3u8Url, filename) {
    try {
      // 获取M3U8内容
      const m3u8Content = await this.fetchM3U8(m3u8Url);
      
      // 解析TS片段
      const tsUrls = this.parseM3U8(m3u8Url, m3u8Content);
      
      if (tsUrls.length === 0) {
        throw new Error('未找到有效的视频片段');
      }

      // 下载所有TS片段
      const tsBlobs = await this.downloadTSSegments(tsUrls);
      
      // 合并为单个Blob
      const combinedBlob = new Blob(tsBlobs, { type: 'video/mp2t' });
      
      // 转换为MP4（简单合并，实际需要FFmpeg）
      // 这里直接下载TS文件，用户可用播放器播放或后续转换
      const url = URL.createObjectURL(combinedBlob);
      
      // 使用Chrome下载API
      await chrome.downloads.download({
        url: url,
        filename: filename.replace('.mp4', '.ts'),
        saveAs: true
      });

      return { success: true };
    } catch (error) {
      console.error('下载失败:', error);
      return { success: false, error: error.message };
    }
  }

  async fetchM3U8(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`获取M3U8失败: ${response.status}`);
    }
    return await response.text();
  }

  parseM3U8(baseUrl, content) {
    const tsUrls = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 跳过注释和空行
      if (trimmed.startsWith('#') || trimmed === '') {
        continue;
      }
      
      // 处理TS文件路径
      if (trimmed.endsWith('.ts') || trimmed.includes('.ts?')) {
        const tsUrl = this.resolveUrl(baseUrl, trimmed);
        tsUrls.push(tsUrl);
      }
      
      // 如果是嵌套的M3U8，递归处理
      if (trimmed.endsWith('.m3u8') && !trimmed.startsWith('http')) {
        // 这里可以递归处理，但为简化先跳过
      }
    }
    
    return tsUrls;
  }

  resolveUrl(baseUrl, relativePath) {
    try {
      return new URL(relativePath, baseUrl).href;
    } catch {
      return relativePath;
    }
  }

  async downloadTSSegments(urls) {
    const blobs = [];
    let completed = 0;
    
    // 并发下载，但限制并发数
    const concurrency = 5;
    const chunks = this.chunkArray(urls, concurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(url => 
        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error(`下载失败: ${res.status}`);
            return res.blob();
          })
          .catch(err => {
            console.error(`片段下载失败: ${url}`, err);
            return null;
          })
      );
      
      const results = await Promise.all(promises);
      for (const blob of results) {
        if (blob) {
          blobs.push(blob);
        }
      }
      
      completed += chunk.length;
      console.log(`下载进度: ${completed}/${urls.length}`);
    }
    
    return blobs;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async getVideos(tabId) {
    const key = `videos_${tabId}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || [];
  }
}

// 初始化
new M3U8Background();

// 监听标签页关闭，清理存储
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`videos_${tabId}`);
});
