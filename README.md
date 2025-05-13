# Graph Note

一个支持多端（Web/Android/iOS/Electron）的知识图谱笔记应用。

## 核心理念

Graph Note 致力于以知识图谱为核心，采用四象限关系可视化，帮助用户高效梳理、归类和关联信息。强调节点关系的层级与归类，支持灵活的交互与可扩展性，追求多端一致的知识管理体验。

## 安装依赖

```powershell
npm install
```

## 启动说明

### Web端
```powershell
npm run dev
```

### Android端
```powershell
npm run android:start
```

### iOS端
```powershell
npm run ios:start
```

### Electron端
首次运行需先安装依赖：
```powershell
npm run electron:install
```
启动Electron桌面端：
```powershell
npm run electron:start
```

## 主要目录说明

- `src/`：前端主要源码
- `android/`：Android 平台相关代码
- `ios/`：iOS 平台相关代码
- `electron/`：Electron 桌面端相关代码

更多平台或高级用法请参考各端目录下的说明或源码。
