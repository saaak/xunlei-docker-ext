# 迅雷Docker下载助手 Chrome扩展

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

一个Chrome扩展，用于连接Docker部署的迅雷进行下载任务管理。

## 功能特性

- 🐳 连接Docker部署的迅雷
- ⚙️ 配置Docker主机和端口
- 🔗 自动检测页面中的magnet链接
- 📥 一键提交下载任务
- 📊 查看和管理下载任务

## 安装

1. 克隆本仓库
   ```bash
   git clone https://github.com/yourusername/xunlei-docker-extension.git
   ```
2. 打开Chrome浏览器
3. 访问 `chrome://extensions/`
4. 启用"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择项目目录

## 使用说明

1. 首次打开扩展，输入Docker迅雷的host和port
2. 访问包含magnet链接的页面
3. 点击"使用迅雷下载"按钮提交任务
4. 在扩展popup中查看任务状态
5. 点击左上角配置按钮可重新配置

## 开发

```bash
# 安装依赖
npm install

# 构建扩展
npm run build
```

## 贡献

欢迎提交Issue和PR！

## 许可证

本项目采用 [MIT 许可证](LICENSE)