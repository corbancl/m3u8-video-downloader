# M3U8视频下载器

<p align="center">
  <img src="icons/icon.svg" width="128" height="128" alt="M3U8视频下载器图标">
</p>

<p align="center">
  <strong>🎬 一款强大的Chrome扩展，自动检测网页中的M3U8视频资源并下载</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-green?logo=google-chrome" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## ✨ 功能特点

- 🔍 **自动检测** - 实时监控网页中的M3U8视频资源
- ⬇️ **一键下载** - 点击即可下载并合并为MP4/TS格式
- 📋 **复制链接** - 快速复制M3U8链接到剪贴板
- 🎨 **美观界面** - 现代化UI设计，深色主题
- 📊 **进度显示** - 实时显示下载进度
- 🏷️ **智能识别** - 自动过滤音频和字幕资源

## 📦 安装方法

### 方式一：开发者模式安装

1. 下载本项目源码或Release包
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择项目文件夹

### 方式二：CRX文件安装

1. 下载 `M3U8视频下载器.crx` 文件
2. 拖拽到 `chrome://extensions/` 页面

## 🚀 使用说明

1. 安装扩展后，浏览器工具栏会出现图标
2. 访问包含M3U8视频的网页
3. 扩展会自动检测页面中的视频资源
4. 点击图标查看检测到的视频列表
5. 点击 **下载MP4** 按钮开始下载

## 📝 支持的网站

支持大多数使用HLS（HTTP Live Streaming）协议的视频网站，包括但不限于：

- 在线教育平台
- 视频分享网站
- 直播回放
- 新闻媒体网站

> ⚠️ 注意：部分有DRM保护或特殊加密的视频可能无法下载

## 🛠️ 技术栈

- **Manifest V3** - 最新的Chrome扩展规范
- **Service Worker** - 后台处理下载任务
- **Content Script** - 页面注入监控网络请求
- **Web Request API** - 拦截和分析网络请求

## 📁 项目结构

```
M3U8视频下载器/
├── manifest.json       # 扩展配置文件
├── popup.html         # 弹出窗口界面
├── popup.js           # 弹出窗口逻辑
├── background.js      # 后台服务脚本
├── content.js         # 内容脚本
├── icons/             # 图标资源
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # 说明文档
```

## ⚙️ 高级功能

### 自定义文件名

下载时会自动生成时间戳文件名，如 `video_1712345678.ts`

### 并发下载

后台自动使用多线程并发下载TS片段，提高下载速度

## 🔒 隐私说明

- 扩展仅在用户主动点击时工作
- 不收集任何用户数据
- 不上传任何信息到第三方服务器
- 所有数据仅存储在本地

## 📜 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交Pull Request

## 📮 联系方式

- GitHub: [@corbancl](https://github.com/corbancl)
- 项目地址: [m3u8-video-downloader](https://github.com/corbancl/m3u8-video-downloader)

---

<p align="center">
  Made with ❤️ by corbancl
</p>
