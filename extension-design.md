# 迅雷Docker Chrome扩展设计文档

## 1. 项目结构
```
xunlei-docker-extension/
├── manifest.json
├── background.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── styles.css
├── content/
│   ├── content.js
│   └── content.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 2. 主要功能模块

### 2.1 配置管理
- Docker host和port配置
- 文件类型过滤规则配置
- 配置持久化存储

### 2.2 页面内容分析
- 检测页面中的magnet链接
- 在检测到的链接附近插入提交按钮
- 处理用户点击事件

### 2.3 任务管理
- 提交下载任务到Docker迅雷
- 展示当前下载任务状态
- 支持任务暂停/继续/删除

## 3. 技术实现细节

### 3.1 manifest.json
- 声明扩展权限
- 注册background脚本
- 配置popup页面
- 注册content script

### 3.2 background.js
- 处理配置存储
- 与Docker迅雷API通信
- 管理下载任务数据

### 3.3 popup页面
- 提供配置界面
- 展示下载任务列表
- 提供任务管理操作

### 3.4 content script
- 页面内容分析
- 动态插入提交按钮
- 与background通信