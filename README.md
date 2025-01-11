# Graph Note

一个基于 Ionic React 的跨平台知识图谱笔记应用。

## 项目目标

Graph Note 旨在创建一个现代化的知识管理工具，通过图形化的方式展示和管理知识结构，实现以下目标：

1. 提供直观的知识图谱可视化界面
2. 支持跨平台使用（桌面端、Web端、移动端）
3. 实现本地优先的数据存储策略
4. 支持多设备数据同步
5. 提供灵活的知识组织方式
6. 确保离线可用性

## 实现原理

### 数据库选型分析

#### SQLite 方案（当前采用）
优势：
- 完全嵌入式，无需独立服务器
- 文件型数据库，易于部署和迁移
- 在移动端有成熟的实现
- 跨平台支持完善
- 零配置，即开即用
- 完全支持离线操作
- 数据库文件可直接用于备份和同步

局限性：
- 需要通过关系型模型模拟图结构
- 复杂图查询性能可能不如专业图数据库
- 不支持原生图算法

#### Neo4j 方案（已放弃）
优势：
- 原生图数据库，更适合知识图谱场景
- 强大的图查询语言 Cypher
- 内置图分析算法
- 可视化支持更好

局限性：
- 移动端部署复杂
- 资源占用较大
- 离线支持不完善
- 嵌入式版本限制较多

### 核心技术架构

1. **数据管理层**：
   - 使用 SQLite 数据库进行本地存储
   - 采用关系模型存储图结构数据
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
   - 使用 SQLite 存储本地数据
   - 设计高效的关系型数据模型
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
- [x] SQLite 数据库集成
- [x] AntV X6 图形编辑器实现
- [x] 基础节点和边的操作功能
- [x] 触摸屏交互支持
- [x] 桌面端应用打包

### 进行中功能

- [ ] 数据库模型优化
- [ ] 图数据查询性能优化
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

### 构建系统设计

项目采用双构建系统设计，分别针对主进程和渲染进程：

1. **主进程构建（esbuild）**
   - 使用 esbuild 构建 Electron 主进程代码
   - 原因选择：
     - 主进程运行在 Node.js 环境，不需要浏览器特性
     - esbuild 构建速度快（Go语言实现）
     - 配置简单，专注于 Node.js 环境
     - 对原生模块支持好（如 better-sqlite3）
     - 可精确控制输出格式（CommonJS）
   - 构建配置：
     ```javascript
     // scripts/build-main.js
     await esbuild.build({
       entryPoints: ['src/main/main.ts'],
       outdir: 'electron',
       platform: 'node',
       format: 'cjs',
       target: 'node14',
       bundle: true,
       external: ['electron', 'better-sqlite3']
     });
     ```

2. **渲染进程构建（Vite）**
   - 使用 Vite 构建前端（渲染进程）代码
   - 选择原因：
     - 优秀的 HMR 支持
     - 对 React、TypeScript 支持完善
     - 丰富的插件生态
     - 适合前端开发体验

3. **构建命令**
   ```bash
   # 完整构建
   npm run build

   # 仅构建主进程
   npm run build:main

   # 仅构建渲染进程
   npm run build:renderer
   ```

## 项目结构

- `/src` - Web 应用源代码
  - `/components` - React 组件
  - `/services` - 业务服务层
  - `/pages` - 页面组件
  - `/theme` - 主题相关
  - `/types` - TypeScript 类型定义

- `/electron` - Electron 桌面应用代码
  - `main.cjs` - 主进程入口
  - `server.cjs` - 本地服务器
  - `preload.cjs` - 预加载脚本
  - `/database` - 数据库相关代码

- `/android` - Android 平台特定代码
  - `/app` - Android 应用代码
  - `/capacitor` - Capacitor 配置

- `/scripts` - 构建和工具脚本
  - `build-main.js` - 主进程构建脚本

- `/dist` - 构建输出目录
  - Web 应用构建产物

- `/need-migration` - 待迁移的旧版本代码

## 技术栈

- Ionic React - UI 框架
- Capacitor - 原生功能封装
- TypeScript - 开发语言
- Vite - 构建工具
- Electron - 桌面应用框架
- SQLite - 本地数据库
- AntV X6 - 图形编辑器

## 图数据库实现

本项目使用SQLite实现了一个轻量级的图数据库，支持以下功能：

### 数据模型

- **节点（Nodes）**
  - 唯一标识符（ID）
  - 类型（Type）
  - 自定义属性（Properties）
  - 创建和更新时间戳

- **关系（Relationships）**
  - 唯一标识符（ID）
  - 源节点（Source Node）
  - 目标节点（Target Node）
  - 类型（Type）
  - 自定义属性（Properties）
  - 创建时间戳

### 核心功能

1. **基础操作**
   - 创建节点和关系
   - 查询节点和关系
   - 更新节点和关系属性
   - 删除节点和关系

2. **图查询**
   - 最短路径查找
   - 模式匹配
   - 属性过滤
   - 类型过滤

3. **数据持久化**
   - 基于SQLite的本地存储
   - 事务支持
   - 数据完整性约束
   - 索引优化

### 技术特点

- 纯TypeScript实现
- 完全离线运行
- 跨平台支持
- 轻量级设计
- 类型安全
- 异步API

### 使用示例

```typescript
// 获取数据库服务实例
const db = DatabaseService.getInstance();

// 创建节点
const node1 = await db.createNode({
  type: 'Person',
  name: 'Alice',
  age: 30
});

const node2 = await db.createNode({
  type: 'Person',
  name: 'Bob',
  age: 25
});

// 创建关系
const relationship = await db.createRelationship(
  node1.id,
  node2.id,
  'KNOWS',
  { since: '2023' }
);

// 查找最短路径
const path = await db.findShortestPath(node1.id, node2.id);

// 模式匹配查询
const results = await db.matchPattern({
  nodeType: 'Person',
  relationshipType: 'KNOWS',
  targetType: 'Person'
});

// 按类型查找节点
const persons = await db.findNodes({
  type: 'Person',
  properties: { age: 30 }
});
```