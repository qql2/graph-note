# 图数据库服务

基于SQLite实现的图数据库服务，用于存储和查询图数据（节点和边）。

## 特性

- 基于SQLite的图数据模型实现
- 支持节点和边的CRUD操作
- 支持属性图模型（节点和边可以有自定义属性）
- 支持路径查找和相连节点查询
- 支持事务操作
- 支持不同的删除模式（级联删除或保留连接）
- 跨平台支持（Web和桌面应用）

## 使用方法

### 初始化数据库

```typescript
import { graphDatabaseService } from "./services/graph-database";

// 初始化数据库
await graphDatabaseService.initialize({
  dbName: "my_graph_db", // 数据库名称
  version: 1, // 数据库版本
  verbose: true // 是否输出详细日志
});

// 获取数据库实例
const db = graphDatabaseService.getDatabase();
```

### 添加节点

```typescript
const nodeId = await db.addNode({
  type: "person", // 节点类型
  label: "张三", // 节点标签
  properties: { // 自定义属性
    age: 30,
    occupation: "软件工程师"
  }
});
```

### 添加边

```typescript
const edgeId = await db.addEdge({
  source_id: node1Id, // 源节点ID
  target_id: node2Id, // 目标节点ID
  type: "friend", // 边的类型
  properties: { // 自定义属性
    since: "2020-01-01"
  }
});
```

### 查询节点和边

```typescript
// 获取所有节点
const allNodes = await db.getNodes();

// 获取所有边
const allEdges = await db.getEdges();
```

### 更新节点和边

```typescript
// 更新节点
await db.updateNode(nodeId, {
  label: "新标签",
  properties: {
    age: 31,
    skills: ["编程", "设计"]
  }
});

// 更新边
await db.updateEdge(edgeId, {
  type: "close_friend",
  properties: {
    since: "2020-01-01",
    relation: "好友"
  }
});
```

### 删除节点和边

```typescript
// 删除边
await db.deleteEdge(edgeId);

// 删除节点（CASCADE模式会级联删除相关边）
import { DeleteMode } from "./services/graph-database";
await db.deleteNode(nodeId, DeleteMode.CASCADE);
```

### 路径查询

```typescript
// 查找从node1到node2的路径
const path = await db.findPath(node1Id, node2Id, 5); // 最大深度为5
```

### 查找相连节点

```typescript
// 查找与指定节点相连的所有节点
const connectedNodes = await db.findConnectedNodes(nodeId, 2); // 深度为2
```

### 关闭数据库

```typescript
await graphDatabaseService.closeDatabase();
```

## 架构设计

该图数据库服务基于SQLite实现，具有以下组件：

1. **核心类型定义**：包含节点、边、配置、引擎接口等类型定义
2. **数据库模式**：定义了表结构和索引
3. **基础图数据库类**：实现了GraphDatabaseInterface接口的通用功能
4. **平台特定实现**：基于Capacitor SQLite插件的实现
5. **数据库服务类**：封装了图数据库的初始化和访问

## 数据模型

- **节点**：包含id、类型、标签和属性
- **边**：包含id、源节点id、目标节点id、类型和属性

## 限制

- 当前实现主要针对中小规模的图数据
- 复杂的图算法（如社区发现、中心性分析等）需要在应用层实现
- 导入/导出和备份功能在不同平台上实现可能有所不同 