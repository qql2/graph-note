# Graph Note

一个基于 Ionic React 的跨平台知识图谱笔记应用。

## 项目目标

Graph Note 旨在创建一个现代化的知识管理工具，通过图形化的方式展示和管理知识结构，实现以下目标：

1. 提供直观的知识图谱可视化界面
2. 支持跨平台使用（桌面端、Web端）
3. 实现本地优先的数据存储策略
4. 支持多设备数据同步
5. 提供灵活的知识组织方式

## 实现原理

### 核心技术架构

1. **数据管理层**：
   - 使用 Neo4j 嵌入式数据库进行本地存储
   - 通过变更记录实现增量同步
   - 支持跨端数据一致性

2. **业务逻辑层**：
   - 处理数据操作逻辑（节点和关系的增删改查）
   - 实现同步逻辑与冲突解决
   - 基于操作记录管理变更日志

3. **UI 层**：
   - 基于 AntV X6 实现复杂图形交互
   - 提供交互式思维导图和双链笔记界面
   - 支持拖拽、折叠等编辑功能

4. **跨端支持层**：
   - 使用 Ionic + Electron 实现跨平台支持
   - 通过 WebDAV 协议实现云同步
   - 支持桌面端和 Web 端

### 实现过程

1. **数据存储与同步**：
   - 使用 Neo4j 嵌入式模式存储本地数据
   - 实现基于 JSON 格式的变更记录
   - 通过 WebDAV 协议进行跨端同步

2. **图形编辑与交互**：
   - 集成 AntV X6 图形库
   - 实现节点和边的拖拽、编辑、折叠功能
   - 优化移动端触摸交互体验

3. **跨平台开发**：
   - 使用 Ionic 框架提供统一的 Web 组件
   - 通过 Electron 打包为桌面应用
   - 处理不同平台的特性适配

## 功能特性

1. **知识图谱编辑**：
   - 节点创建、编辑、删除
   - 关系连接与管理
   - 支持节点折叠与展开
   - 图形化拖拽交互

2. **数据同步**：
   - 本地优先的存储策略
   - 增量同步机制
   - 冲突检测与解决
   - 多设备数据一致性

3. **跨平台支持**：
   - 桌面端应用（Windows/macOS）
   - Web 端支持
   - 统一的用户体验

4. **交互优化**：
   - 触摸屏支持
   - 缩放与平移
   - 响应式布局
   - 性能优化

## 项目状态

### 已完成功能

- [x] 基础项目架构搭建
- [x] Neo4j 嵌入式数据库集成
- [x] AntV X6 图形编辑器实现
- [x] 基础节点和边的操作功能
- [x] 触摸屏交互支持
- [x] 桌面端应用打包

### 进行中功能

- [ ] 数据同步机制实现
- [ ] 冲突解决策略优化
- [ ] Web 端部署支持
- [ ] 性能优化

### 计划功能

- [ ] 移动端适配
- [ ] 协作编辑功能
- [ ] 知识图谱分析工具
- [ ] AI 辅助功能集成
- [ ] 插件系统支持

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
- `/need-migration` - 待迁移的旧版本代码

## 技术栈

- Ionic React - UI 框架
- Capacitor - 原生功能封装
- TypeScript - 开发语言
- Vite - 构建工具
- Electron - 桌面应用框架
- Neo4j - 图数据库
- AntV X6 - 图形编辑器