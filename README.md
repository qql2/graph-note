# Graph Note

一个基于 Ionic React 的跨平台笔记应用。

## 开发环境设置

### 依赖安装
```bash
npm install
```

### 开发模式运行

#### Android 开发
在开发模式下运行 Android 应用时，需要同时运行以下两个服务：

1. Web 开发服务器（提供实时更新的 Web 内容）
```bash
npm run dev
```

2. Android 应用
```bash
npx cap run android
```

> **重要说明**：在开发模式下，Android 应用实际上是一个包装了 WebView 的壳应用，它会加载本地开发服务器提供的 Web 内容。因此，确保在运行 Android 应用之前已经启动了 Web 开发服务器。

### 构建

```bash
npm run build
```

### 测试

```bash
# 端到端测试
npm run test.e2e

# 单元测试
npm run test.unit
```

## 项目结构

- `/src` - Web 应用源代码
- `/android` - Android 平台特定代码
- `/electron` - Electron 桌面应用代码

## 技术栈

- Ionic React
- Capacitor
- TypeScript
- Vite
- Electron 