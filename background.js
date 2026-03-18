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
    console.log('[M3U8下载器] 开始处理下载:', m3u8Url);
    
    try {
      // 获取M3U8内容
      let m3u8Content;
      try {
        const response = await fetch(m3u8Url, {
          mode: 'cors',
          credentials: 'omit'
        });
        if (!response.ok) {
          throw new Error(`获取M3U8失败: HTTP ${response.status}`);
        }
        m3u8Content = await response.text();
      } catch (fetchError) {
        console.warn('[M3U8下载器] 跨域获取失败:', fetchError.message);
        throw new Error('无法访问M3U8资源（跨域限制）。请复制链接使用专业下载工具如 ffmpeg 或 N_m3u8DL-RE。');
      }

      console.log('[M3U8下载器] M3U8内容预览:', m3u8Content.substring(0, 500));
      
      // 解析TS片段
      let tsUrls = this.parseM3U8(m3u8Url, m3u8Content);
      console.log('[M3U8下载器] 解析到TS片段数:', tsUrls.length);
      
      // 如果没有找到TS片段，检查是否是主播放列表
      if (tsUrls.length === 0) {
        const subPlaylists = this.parseMasterPlaylist(m3u8Url, m3u8Content);
        if (subPlaylists.length > 0) {
          const firstPlaylist = subPlaylists[0];
          console.log('[M3U8下载器] 检测到主播放列表，自动选择:', firstPlaylist);
          // 递归处理子播放列表
          return await this.handleDownload(firstPlaylist, filename);
        }
        
        // 提供更详细的错误信息
        const hasEncryption = m3u8Content.includes('#EXT-X-KEY:');
        if (hasEncryption) {
          throw new Error('视频已加密，无法直接下载。请复制链接使用 ffmpeg 或 N_m3u8DL-RE 下载。');
        }
        throw new Error('未识别的M3U8格式。可能是动态加载或特殊加密，建议使用专业下载工具。');
      }

      // 检查加密
      const isEncrypted = m3u8Content.includes('#EXT-X-KEY:');
      if (isEncrypted) {
        throw new Error('视频已加密，浏览器扩展无法解密。请复制链接使用 ffmpeg 或 N_m3u8DL-RE 配合密钥下载。');
      }

      // 下载所有TS片段
      console.log('[M3U8下载器] 开始下载TS片段...');
      const tsBlobs = await this.downloadTSSegments(tsUrls);
      
      if (tsBlobs.length === 0) {
        throw new Error('所有片段下载失败，可能是跨域限制或网络问题。');
      }
      
      // 合并为单个Blob
      const combinedBlob = new Blob(tsBlobs, { type: 'video/mp2t' });
      console.log('[M3U8下载器] 合并完成，大小:', (combinedBlob.size / 1024 / 1024).toFixed(2), 'MB');
      
      // 创建下载URL
      const url = URL.createObjectURL(combinedBlob);
      
      // 使用Chrome下载API
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: filename.replace('.mp4', '.ts'),
        saveAs: true
      });

      console.log('[M3U8下载器] 下载任务ID:', downloadId);
      return { success: true };
    } catch (error) {
      console.error('[M3U8下载器] 下载失败:', error);
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
    
    // 检查是否是加密的M3U8
    const isEncrypted = content.includes('#EXT-X-KEY:');
    if (isEncrypted) {
      console.warn('[M3U8下载器] 检测到加密的M3U8，可能无法直接下载');
    }
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 跳过注释和空行
      if (trimmed.startsWith('#') || trimmed === '') {
        continue;
      }
      
      // 处理TS文件路径（支持多种格式）
      if (trimmed.endsWith('.ts') || 
          trimmed.includes('.ts?') || 
          trimmed.includes('.ts&') ||
          /^[a-f0-9]{32,}$/i.test(trimmed) || // 可能是加密的片段名
          trimmed.includes('segment') ||
          trimmed.includes('chunk') ||
          trimmed.includes('part')) {
        
        const tsUrl = this.resolveUrl(baseUrl, trimmed);
        // 确保URL有效
        if (tsUrl.startsWith('http') || tsUrl.startsWith('//') || tsUrl.startsWith('/')) {
          tsUrls.push(tsUrl);
        }
      }
    }
    
    return tsUrls;
  }

  parseMasterPlaylist(baseUrl, content) {
    const playlists = [];
    const lines = content.split('\n');
    let currentBandwidth = 0;
    let bestPlaylist = null;
    let bestBandwidth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 解析带宽信息
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
        if (bandwidthMatch) {
          currentBandwidth = parseInt(bandwidthMatch[1], 10);
        }
      }
      
      // 查找子播放列表（.m3u8文件）
      if (!line.startsWith('#') && line !== '') {
        const isM3U8 = line.endsWith('.m3u8') || line.includes('.m3u8?');
        const mightBePlaylist = !line.includes('.ts') && !line.includes('.mp4');
        
        if (isM3U8 || mightBePlaylist) {
          const playlistUrl = this.resolveUrl(baseUrl, line);
          playlists.push({ url: playlistUrl, bandwidth: currentBandwidth });
          
          // 记录最高清晰度
          if (currentBandwidth > bestBandwidth) {
            bestBandwidth = currentBandwidth;
            bestPlaylist = playlistUrl;
          }
        }
        currentBandwidth = 0;
      }
    }
    
    // 优先返回最高清晰度
    if (bestPlaylist) {
      return [bestPlaylist];
    }
    
    return playlists.map(p => p.url);
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
    let failed = 0;
    
    // 并发下载，但限制并发数
    const concurrency = 3;
    const chunks = this.chunkArray(urls, concurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(url => 
        fetch(url, { mode: 'cors', credentials: 'omit' })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.blob();
          })
          .catch(err => {
            console.warn('[M3U8下载器] 片段下载失败:', url, err.message);
            failed++;
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
      console.log(`[M3U8下载器] 下载进度: ${completed}/${urls.length}, 成功: ${blobs.length}, 失败: ${failed}`);
    }
    
    if (failed > 0 && blobs.length === 0) {
      console.warn('[M3U8下载器] 所有片段下载失败，可能是跨域限制');
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
