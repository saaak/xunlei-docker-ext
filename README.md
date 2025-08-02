# 迅雷Docker下载助手 Chrome扩展

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

一款便捷的Chrome扩展，简化与Docker迅雷下载服务（[cnk3x/xunlei](https://github.com/cnk3x/xunlei)）的交互。

![扩展截图](assets/screenshot.png)

## ✨ 功能特性

- 🐳 **连接远程迅雷** - 轻松连接到Docker容器中的迅雷远程下载服务
- ⚙️ **简易配置** - 快速配置Docker迅雷服务的主机地址和端口
- 📊 **任务管理** - 展示当前进行中和已完成的下载任务
- 🔗 **一键添加** - 自动检测网页磁力链接并添加下载任务
- ⚡ **高效体验** - 提供类似原生客户端的下载体验

## 📦 安装

### 前提条件
- 已部署Docker迅雷服务（[cnk3x/xunlei](https://github.com/cnk3x/xunlei)）
- Docker迅雷容器网络可访问

### 安装步骤
1. 下载扩展：
   ```bash
   git clone https://github.com/saaak/xunlei-docker-ext.git
   ```
   或从[Releases页面](https://github.com/saaak/xunlei-docker-ext/releases)下载zip包

2. 在Chrome中打开`chrome://extensions/`

3. 启用"开发者模式"

4. 点击"加载已解压的扩展程序"并选择项目目录

## 🚀 使用指南

1. **配置连接**
   - 点击扩展图标
   - 输入Docker迅雷的Host和Port
   - 点击"保存配置"

2. **添加下载任务**
   - 浏览含磁力链接的网页
   - 点击链接旁的"Docker迅雷下载"按钮
   - 选择文件并确认

3. **查看任务状态**
   - 点击扩展图标查看任务列表
   - 显示下载进度、速度等信息


## 📜 许可证

本项目采用 [MIT License](LICENSE)
