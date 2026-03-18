// M3U8视频下载器 - Popup脚本

class M3U8Popup {
  constructor() {
    this.videos = [];
    this.init();
  }

  async init() {
    await this.loadVideos();
    this.render();
    this.setupListeners();
  }

  async loadVideos() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // 从存储中获取当前页面的视频
    const result = await chrome.storage.local.get(`videos_${tab.id}`);
    this.videos = result[`videos_${tab.id}`] || [];
    
    // 更新状态
    const statusText = document.getElementById('statusText');
    if (this.videos.length > 0) {
      statusText.textContent = `已检测到 ${this.videos.length} 个视频资源`;
    }
  }

  render() {
    const videoList = document.getElementById('videoList');
    
    if (this.videos.length === 0) {
      videoList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p>暂未检测到M3U8资源</p>
          <p style="font-size: 12px; margin-top: 5px;">请打开包含视频的网页</p>
        </div>
      `;
      return;
    }

    videoList.innerHTML = this.videos.map((video, index) => `
      <div class="video-item" data-index="${index}">
        <div class="video-url" title="${video.url}">${this.truncateUrl(video.url)}</div>
        <div class="video-info">
          <div class="video-source">
            <span>📡</span>
            <span>${video.source || '未知来源'}</span>
          </div>
          <span class="badge">${video.size || '未知大小'}</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-text">准备下载...</div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="download" data-index="${index}">
            ⬇️ 下载MP4
          </button>
          <button class="btn btn-secondary" data-action="copy" data-index="${index}">
            📋 复制链接
          </button>
        </div>
      </div>
    `).join('');

    // 使用事件委托绑定按钮点击
    videoList.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const index = parseInt(e.currentTarget.dataset.index, 10);
        if (action === 'download') {
          this.download(index);
        } else if (action === 'copy') {
          this.copyUrl(index);
        }
      });
    });
  }

  truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      if (path.length > 50) {
        return urlObj.origin + path.substring(0, 47) + '...';
      }
      return url;
    } catch {
      return url.length > 60 ? url.substring(0, 57) + '...' : url;
    }
  }

  async download(index) {
    const video = this.videos[index];
    if (!video) {
      console.error('未找到视频:', index);
      this.showToast('❌ 未找到视频');
      return;
    }

    const item = document.querySelector(`.video-item[data-index="${index}"]`);
    if (!item) {
      console.error('未找到视频项');
      this.showToast('❌ UI错误');
      return;
    }

    const progressContainer = item.querySelector('.progress-container');
    const progressFill = progressContainer.querySelector('.progress-fill');
    const progressText = progressContainer.querySelector('.progress-text');
    const btn = item.querySelector('.btn-primary');
    
    if (!progressContainer || !progressFill || !progressText || !btn) {
      console.error('未找到UI元素');
      this.showToast('❌ UI元素缺失');
      return;
    }

    progressContainer.style.display = 'block';
    btn.disabled = true;
    progressText.textContent = '正在下载...';
    progressText.style.color = '#a0aec0';
    progressFill.style.width = '0%';

    try {
      console.log('开始下载:', video.url);
      
      // 发送下载请求到background
      const response = await chrome.runtime.sendMessage({
        action: 'download',
        url: video.url,
        filename: `video_${Date.now()}.mp4`
      });

      console.log('下载响应:', response);

      if (response && response.success) {
        progressFill.style.width = '100%';
        progressText.textContent = '✅ 下载完成!';
        progressText.style.color = '#4ade80';
      } else {
        const errorMsg = (response && response.error) ? response.error : '下载失败';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('下载错误:', error);
      progressText.textContent = `❌ ${error.message}`;
      progressText.style.color = '#f87171';
      btn.disabled = false;
    }
  }

  async copyUrl(index) {
    const video = this.videos[index];
    if (!video) {
      this.showToast('❌ 未找到视频');
      return;
    }

    try {
      await navigator.clipboard.writeText(video.url);
      this.showToast('✅ 链接已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      // 备用方案：创建临时输入框
      const textarea = document.createElement('textarea');
      textarea.value = video.url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.showToast('✅ 链接已复制到剪贴板');
      } catch (e) {
        this.showToast('❌ 复制失败');
      }
      document.body.removeChild(textarea);
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    
    // 使用 class 而非内联样式
    toast.className = 'toast-message';
    
    // 添加样式到 head（如果不存在）
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        .toast-message {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          font-size: 13px;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  setupListeners() {
    // 监听存储变化，实时更新视频列表
    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      for (const key in changes) {
        if (key.startsWith('videos_')) {
          await this.loadVideos();
          this.render();
        }
      }
    });
  }
}

const popup = new M3U8Popup();
