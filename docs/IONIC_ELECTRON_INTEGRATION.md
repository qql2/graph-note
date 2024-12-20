# Ionic + Electron 集成方案

本文档记录了如何将 Ionic React 应用与 Electron 集成，实现跨平台桌面应用。

## 架构概览

项目采用以下架构： 
```
project/
├── src/ # Ionic React 前端代码
├── electron/ # Electron 相关代码
│ ├── main.cjs # 主进程
│ ├── preload.cjs # 预加载脚本
│ └── server.cjs # Koa 服务器
└── dist/ # 构建输出目录
```

## 技术栈

- Ionic React: UI 框架
- Electron: 桌面应用框架
- Koa: 本地服务器
- Vite: 构建工具
- Electron Forge: 打包工具

## 实现步骤

### 1. 项目初始化

```bash
# 创建 Ionic React 项目
ionic start myApp blank --type react

# 安装 Electron 相关依赖
npm install --save-dev electron electron-forge @electron-forge/cli
npm install --save-dev @electron-forge/maker-squirrel @electron-forge/maker-zip @electron-forge/maker-deb @electron-forge/maker-rpm
npm install --save-dev electron-reload cross-env

# 安装 Koa 相关依赖
npm install koa koa-static koa-router
```

### 2. 配置文件

#### package.json
```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "start": "cross-env NODE_ENV=production electron-forge start",
    "start:dev": "cross-env NODE_ENV=development electron-forge start",
    "package": "npm run build && cross-env NODE_ENV=production electron-forge package",
    "make": "npm run build && cross-env NODE_ENV=production electron-forge make"
  }
}
```

#### vite.config.ts
```typescript
export default defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : "./",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
```

### 3. Electron 配置

#### main.cjs
主进程负责创建窗口和启动本地服务器：
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const AppServer = require('./server.cjs');

async function createWindow() {
  // 启动 Koa 服务器
  const server = new AppServer();
  await server.start(3000);

  // 创建窗口
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
}
```

#### preload.cjs
预加载脚本用于安全地暴露 API：
```javascript
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform
});
```

#### server.cjs
Koa 服务器用于提供静态文件和 API：
```javascript
const Koa = require('koa');
const serve = require('koa-static');
const Router = require('koa-router');

class AppServer {
  constructor() {
    this.app = new Koa();
    this.setupMiddleware();
  }

  setupMiddleware() {
    this.app.use(serve(path.join(__dirname, '../dist')));
  }

  start(port) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => resolve());
    });
  }
}
```

## 开发流程

1. 开发模式
```bash
# 终端 1：启动 Vite 开发服务器
npm run dev

# 终端 2：启动 Electron (会同时启动 Koa 服务器)
npm run start:dev
```

开发模式工作流程：
1. Vite 开发服务器启动 (端口 5173)
2. Electron 启动时会：
   - 启动 Koa 服务器 (端口 3000)
   - 创建主窗口
   - 加载 Vite 开发服务器内容
3. 当前端代码变更时：
   - Vite 热更新生效
   - Koa 服务器继续处理 API 请求

2. 生产模式
```bash
# 构建前端资源
npm run build

# 打包应用
npm run make
```

## 关键特性

1. **开发模式**
   - Vite 开发服务器提供前端资源 (热重载)
   - Koa 服务器处理 API 请求
   - Electron 主进程管理窗口和服务

2. **生产模式**
   - 静态文件由 Koa 服务
   - API 由 Koa 服务器处理
   - Electron 加载本地服务内容

3. **安全性**
   - 启用 contextIsolation
   - 使用 preload 脚本
   - 控制 API 暴露

## 常见问题

1. **路径问题**
   - 开发环境使用绝对路径 "/"
   - 生产环境使用相对路径 "./"

2. **资源加载**
   - 使用 Koa 静态服务器
   - 确保正确的 MIME 类型

3. **进程通信**
   - 通过 preload 脚本暴露 API
   - 使用 IPC 进行进程间通信

## 打包注意事项

1. 确保所有依赖都正确安装
2. 检查文件路径配置
3. 测试不同平台的兼容性
4. 处理好静态资源的打包

## 后续优化

1. 添加自动更新功能
2. 优化启动性能
3. 增加错误处理和日志
4. 改进开发体验

## 参考资源

- [Electron 文档](https://www.electronjs.org/docs)
- [Ionic Framework 文档](https://ionicframework.com/docs)
- [Electron Forge 文档](https://www.electronforge.io/)


这个文档涵盖了：
1. 项目架构和技术栈
2. 详细的实现步骤
3. 关键配置和代码示例
4. 开发和构建流程
5. 常见问题和解决方案
6. 优化建议

你可以根据项目的具体需求继续扩展和完善这个文档。

