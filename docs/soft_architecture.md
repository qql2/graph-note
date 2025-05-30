### **Graph-Note 项目架构设计**

#### **1. 项目目标**
构建一个跨平台的知识图谱编辑与管理工具，支持：
- 跨平台运行（Web、Windows、Android）
- 可视化编辑知识图谱
- 全局内容检索
- 数据同步与备份

#### **2. 系统架构**

##### **2.0 内核实现方案对比**

1. **统一 SQLite 方案（当前采用）**
   - 优势：
     - 全平台统一采用 @capacitor-community/sqlite，web 端通过 jeep-sqlite 适配，桌面端通过 electron 适配。
     - 一套代码多端运行，维护成本低，部署简单，离线可用。
     - 支持复杂 SQL 查询、事务、备份、升级。
   - 局限性：
     - 依赖 Capacitor 生态和 jeep-sqlite 适配层。
   - 适用场景：
     - 个人知识管理、轻量级图谱编辑、移动/桌面/Web 跨平台。

##### **2.1 当前架构设计（统一 SQLite 实现）**

1. **核心层**
   - 纯 TypeScript 实现，统一通过 @capacitor-community/sqlite 进行数据库操作。
   - Web 端通过 jeep-sqlite 适配，无 sql.js/IndexedDB/LocalStorage 直接存储。
   - 桌面端通过 electron + @capacitor-community/sqlite 适配，无 better-sqlite3 直接实现。
   - 模块化设计，支持按需加载。

2. **在线服务层**
   - RESTful API、AI 增强、数据同步与备份。

3. **跨平台适配层**
   - Capacitor 桥接原生功能，PWA 支持，响应式设计。
   - Web 端通过 jeep-sqlite 适配 @capacitor-community/sqlite。

##### **2.1 核心层次**
1. **数据持久层**
   - 统一通过 @capacitor-community/sqlite 进行本地存储。
   - Web 端通过 jeep-sqlite 适配，无 sql.js/IndexedDB/LocalStorage 直接存储。
   - 桌面端通过 electron + @capacitor-community/sqlite 适配，无 better-sqlite3 直接实现。
   - 数据模型、接口、事务、备份、升级等与实际代码一致。

##### **2.2 图数据库实现**

- 数据模型、表结构、索引、接口等与 src/models/GraphNode.ts、src/services/graph-database/core/schema.ts 保持一致。
- 备份与恢复通过 @capacitor-community/sqlite 的 saveToStore/saveToLocalDisk 实现。
- jeep-sqlite 作为 web 端适配层，详见 main.tsx。

##### **2.2.3 Web端存储实现**

- 采用 @capacitor-community/sqlite + jeep-sqlite，无 sql.js/IndexedDB/LocalStorage。
- 数据持久化通过 saveToStore，备份/恢复通过 saveToLocalDisk。

##### **2.2.7 桌面端存储实现**

- 采用 electron + @capacitor-community/sqlite，无 better-sqlite3 直接实现。
- 数据存储、事务、备份、升级等与 web 端一致。

##### **3.1 数据存储与同步**
- 本地存储统一为 @capacitor-community/sqlite。
- 轻量级同步、备份、导入导出等通过统一接口实现。

##### **4. 技术挑战**
- 主要为统一适配、性能优化、离线功能、数据安全。
- jeep-sqlite 适配层为 web 端关键。

#### **3. 核心功能模块**

##### **3.1 数据存储与同步**
- **本地存储**
  - 数据格式：关系型存储的图结构
  - 核心特性：
    - 平台特定SQLite实现
    - 统一数据操作抽象层
    - 事务支持
    - 并发控制
    - 数据完整性约束
  
- **数据同步**
  - 轻量级同步：
    - WebDAV 协议
    - 文件系统同步
    - 云存储服务
  - 高级同步（需要在线服务）：
    - 实时协同编辑
    - 版本控制
    - 冲突解决

##### **3.2 计算任务处理**
- **本地处理**
  - Web Worker 多线程计算
  - 增量计算策略
  - 数据分片处理
  - 缓存优化

- **云端处理**
  - AI 辅助分析
  - 大规模图计算
  - 知识图谱推理
  - 图谱自动构建

##### **3.3 图形交互**
- **基础操作**
  - 节点创建与删除
  - 关系建立与修改
  - 拖拽定位
  - 缩放与平移
  
- **高级功能**
  - 节点分组
  - 自动布局
  - 历史记录
  - 协同编辑

##### **3.4 搜索系统**
- **搜索范围**
  - 节点内容
  - 关系属性
  - 标签与分类
  
- **实现方案**
  - SQLite全文检索（FTS5）
  - 内存索引缓存
  - 模糊搜索支持

#### **4. 技术挑战**

1. **性能优化**
   - 平台特定SQLite优化
   - 数据操作抽象层性能
   - 跨平台数据同步效率
   - 查询优化策略

2. **离线功能**
   - 本地数据持久化
   - 离线编辑支持
   - 同步冲突处理
   - 数据库版本管理

3. **跨平台适配**
   - 统一数据操作接口
   - SQLite实现差异处理
   - 平台特定功能兼容
   - 数据同步策略适配

4. **数据安全**
   - SQLite加密支持
   - 传输安全
   - 权限控制

#### **5. 开发路线**

1. **第一阶段**：核心功能实现
   - 基础图形编辑
   - 统一SQLite抽象层设计
   - 桌面端SQLite集成
   - PWA 支持
   - 响应式设计

2. **第二阶段**：功能完善
   - 移动端SQLite适配
   - Web端SQLite服务
   - 数据同步基础实现
   - 平台特定优化

3. **第三阶段**：在线服务集成
   - AI 服务接入
   - 云端同步
   - 协作功能
   - 性能优化

4. **第四阶段**：生态建设
   - 插件系统
   - 主题定制
   - API 开放
   - 社区工具集成

##### **2.1 数据库架构**

1. **分层设计**
   ```
   src/services/database/
   ├── core/                 # 核心抽象层
   │   ├── types.ts         # 接口定义
   │   ├── schema.ts        # 数据库模式
   │   └── BaseGraphDB.ts   # 基础实现
   ├── platforms/           # 平台适配层
   │   ├── WebGraphDB.ts    # Web平台实现
   │   ├── DesktopGraphDB.ts  # 桌面平台实现（计划）
   │   └── MobileGraphDB.ts   # 移动平台实现（计划）
   └── DatabaseService.ts   # 服务封装
   ```

2. **核心抽象层**
   - `types.ts`: 定义统一的接口和类型
     - `GraphNode`: 节点数据结构
     - `GraphEdge`: 边数据结构
     - `GraphDatabaseInterface`: 数据库操作接口
     - `SQLiteEngine`: 存储引擎接口
   - `schema.ts`: 定义数据库表结构和索引
   - `BaseGraphDB.ts`: 提供通用的数据库操作实现

3. **平台适配层**
   - Web平台：使用sql.js + localStorage
   - 桌面平台：计划使用better-sqlite3
   - 移动平台：计划使用Capacitor SQLite

4. **统一接口**
   ```typescript
   interface GraphDatabaseInterface {
     // 初始化和配置
     initialize(config: DatabaseConfig): Promise<void>;
     close(): Promise<void>;
     
     // 数据操作
     addNode(node: GraphNode): Promise<string>;
     updateNode(id: string, updates: Partial<GraphNode>): Promise<void>;
     deleteNode(id: string): Promise<void>;
     getNodes(): Promise<GraphNode[]>;
     
     addEdge(edge: GraphEdge): Promise<string>;
     updateEdge(id: string, updates: Partial<GraphEdge>): Promise<void>;
     deleteEdge(id: string): Promise<void>;
     getEdges(): Promise<GraphEdge[]>;
     
     // 高级查询
     findPath(startId: string, endId: string, maxDepth?: number): Promise<GraphEdge[]>;
     findConnectedNodes(nodeId: string, depth?: number): Promise<GraphNode[]>;
     
     // 数据导入导出
     exportData(): Promise<Uint8Array>;
     importData(data: Uint8Array): Promise<void>;
     
     // 备份管理
     createBackup(): Promise<string>;
     restoreFromBackup(backupId: string): Promise<void>;
     listBackups(): Promise<string[]>;
   }
   ```

5. **数据模型**
   ```typescript
   interface GraphNode {
     id: string;
     type: string;
     label: string;
     x: number;
     y: number;
     properties: Record<string, any>;
     created_at: string;
     updated_at: string;
   }

   interface GraphEdge {
     id: string;
     source_id: string;
     target_id: string;
     type: string;
     properties: Record<string, any>;
     created_at: string;
   }
   ```

6. **存储引擎抽象**
   ```typescript
   interface SQLiteEngine {
     exec(sql: string, params?: any[]): any;
     prepare(sql: string): any;
     run(sql: string, params?: any[]): void;
     isOpen(): boolean;
     close(): void;
     export(): Uint8Array;
     begin(): void;
     commit(): void;
     rollback(): void;
   }
   ```