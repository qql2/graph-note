### **Graph-Note 项目架构设计**

#### **1. 项目目标**
构建一个跨平台的知识图谱编辑与管理工具，支持：
- 跨平台运行（Web、Windows、Android）
- 可视化编辑知识图谱
- 全局内容检索
- 数据同步与备份

#### **2. 系统架构**

##### **2.0 内核实现方案对比**

1. **纯前端实现方案**（当前采用）
   - 优势：
     - 一套代码多端运行，维护成本低
     - 部署简单，无需额外运行时
     - 完全离线可用
     - 启动速度快，资源占用小
     - 跨平台兼容性好
   - 局限性：
     - 复杂计算性能受限
     - 高级功能需要在线服务支持
     - 大规模数据处理能力有限
   - 适用场景：
     - 个人知识管理
     - 轻量级图谱编辑
     - 移动端优先的应用

2. **独立内核方案**（如思源笔记）
   - 优势：
     - 计算性能强
     - 支持复杂的本地功能
     - 数据处理能力强
     - 可扩展性好
   - 局限性：
     - 多端适配成本高
     - 需要维护多套代码
     - 部署复杂
     - 资源占用较大
   - 适用场景：
     - 专业知识管理工具
     - 企业级应用
     - 桌面端为主的应用

3. **混合方案**
   - 优势：
     - 平衡了性能和跨平台性
     - 可按需加载高级功能
     - 灵活的架构选择
   - 局限性：
     - 架构复杂度高
     - 开发维护成本高
     - 需要处理多种运行时状态
   - 适用场景：
     - 渐进式开发的应用
     - 需要平衡性能和便携性的场景

##### **2.1 当前架构设计（纯前端实现）**

1. **核心层**
   - 纯 TypeScript 实现
   - 基于 Web API 和浏览器能力
   - 使用 Web Worker 处理计算密集任务
   - 平台特定的存储引擎：
     - Web端：sql.js + localStorage
     - 移动端：SQLite
     - 桌面端：better-sqlite3
   - 模块化设计，支持按需加载

2. **在线服务层**
   - RESTful API 接口
   - 基于云函数的无服务架构
   - AI 增强功能（知识图谱构建、Graph RAG）
   - 数据同步与备份服务

3. **跨平台适配层**
   - Capacitor 桥接原生功能
   - PWA 支持
   - 响应式设计
   - 平台特性检测与降级处理

##### **2.1 核心层次**
1. **数据持久层**
   - 功能：负责图数据的本地存储与管理
   - 技术选型：
     - Web端存储策略：
       - sql.js：WebAssembly版SQLite实现
       - localStorage持久化
       - IndexedDB备份支持
       - 完整SQL功能支持
       - 支持复杂查询和事务
     - 移动端：Capacitor SQLite插件
       - 原生SQLite实现
       - 平台优化
       - 系统级性能
     - 桌面端：better-sqlite3
       - 原生性能
       - 完整SQLite功能支持
       - 可靠的事务处理
     - 统一抽象层：
       - 跨平台通用接口
       - 统一的数据操作API
       - 平台无关的业务逻辑
   - 数据模型：
     - 节点表：存储知识点信息
     - 节点属性表：存储节点属性
     - 关系表：存储节点间连接
     - 关系属性表：存储关系属性
     - 变更记录表：追踪数据修改

#### **2.2 图数据库实现**

##### **2.2.1 数据模型设计**

1. **节点表设计**
   ```sql
   CREATE TABLE nodes (
     id TEXT PRIMARY KEY,
     type TEXT NOT NULL,
     label TEXT NOT NULL,
     x REAL NOT NULL,
     y REAL NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )
   ```
   - 使用UUID作为主键
   - 必须指定节点类型和标签
   - 存储节点位置信息
   - 自动记录创建和更新时间

2. **节点属性表设计**
   ```sql
   CREATE TABLE node_properties (
     node_id TEXT NOT NULL,
     key TEXT NOT NULL,
     value TEXT,
     FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
     PRIMARY KEY (node_id, key)
   )
   ```
   - 使用EAV（实体-属性-值）模型存储属性
   - 支持动态属性
   - 级联删除确保数据一致性

3. **关系表设计**
   ```sql
   CREATE TABLE relationships (
     id TEXT PRIMARY KEY,
     source_id TEXT NOT NULL,
     target_id TEXT NOT NULL,
     type TEXT NOT NULL,
     created_at TEXT NOT NULL,
     FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
     FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
   )
   ```
   - 使用外键约束确保引用完整性
   - 必须指定关系类型
   - 自动记录创建时间

4. **关系属性表设计**
   ```sql
   CREATE TABLE relationship_properties (
     relationship_id TEXT NOT NULL,
     key TEXT NOT NULL,
     value TEXT,
     FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
     PRIMARY KEY (relationship_id, key)
   )
   ```
   - 与节点属性表类似的EAV模型
   - 支持关系的动态属性
   - 级联删除保证数据一致性

##### **2.2.2 索引优化**

1. **节点索引**
   ```sql
   CREATE INDEX idx_nodes_type ON nodes(type)
   ```
   - 优化按类型查询节点的性能
   - 支持快速类型过滤

2. **关系索引**
   ```sql
   CREATE INDEX idx_relationships_type ON relationships(type)
   CREATE INDEX idx_relationships_source ON relationships(source_id)
   CREATE INDEX idx_relationships_target ON relationships(target_id)
   ```
   - 优化关系查询性能
   - 支持高效的图遍历
   - 加速路径查找算法

##### **2.2.3 Web端存储实现**

1. **初始化流程**
   ```typescript
   async initialize(): Promise<void> {
     // 1. 加载sql.js的WebAssembly模块
     const SQL = await initSqlJs({
       locateFile: file => `/sql-wasm.wasm`
     });

     // 2. 创建数据库实例
     this.db = new SQL.Database();

     // 3. 创建表结构
     await this.createTables();

     // 4. 从localStorage恢复数据
     const savedData = localStorage.getItem("graphDb");
     if (savedData) {
       const binaryArray = new Uint8Array(savedData.split(",").map(Number));
       this.db = new SQL.Database(binaryArray);
     }
   }
   ```

2. **数据持久化**
   ```typescript
   private saveToLocalStorage(): void {
     if (!this.db) return;
     // 导出数据库为二进制数组
     const binaryArray = this.db.export();
     // 保存到localStorage
     localStorage.setItem("graphDb", binaryArray.toString());
   }
   ```

3. **查询优化**
   - 使用预编译语句
   - 批量操作优化
   - 事务处理
   - 异步操作处理

4. **错误处理**
   - 数据库初始化错误处理
   - 存储空间不足处理
   - 数据完整性检查
   - 自动备份机制

##### **2.2.4 高级查询功能**

1. **路径查找**
   ```sql
   WITH RECURSIVE
   path(source, target, path, depth) AS (
     -- Base case
     SELECT source_id, target_id, 
            json_array(json_object('id', id, 'source', source_id, 'target', target_id)), 
            1
     FROM relationships
     WHERE source_id = ?
     
     UNION ALL
     
     -- Recursive case
     SELECT p.source, r.target_id, 
            json_array_extend(p.path, json_object('id', r.id, 'source', r.source_id, 'target', r.target_id)),
            p.depth + 1
     FROM path p
     JOIN relationships r ON p.target = r.source_id
     WHERE p.depth < ?
   )
   SELECT path
   FROM path
   WHERE target = ?
   ORDER BY depth
   LIMIT 1
   ```

2. **连接节点查找**
   ```sql
   WITH RECURSIVE
   connected(id, depth) AS (
     -- Base case
     SELECT id, 0
     FROM nodes
     WHERE id = ?
     
     UNION
     
     -- Recursive case
     SELECT n.id, c.depth + 1
     FROM connected c
     JOIN relationships r ON c.id = r.source_id OR c.id = r.target_id
     JOIN nodes n ON (r.source_id = n.id OR r.target_id = n.id) AND n.id != c.id
     WHERE c.depth < ?
   )
   SELECT DISTINCT n.*
   FROM connected c
   JOIN nodes n ON c.id = n.id
   ```

##### **2.2.5 性能优化**

1. **数据库性能**
   - 使用适当的索引
   - 优化查询语句
   - 批量操作
   - 使用事务

2. **存储优化**
   - 定期清理无用数据
   - 压缩存储数据
   - 分块存储大数据
   - 增量更新

3. **内存管理**
   - 控制数据库大小
   - 分页加载数据
   - 及时释放资源
   - 内存使用监控

##### **2.2.6 数据同步**

1. **变更跟踪**
   - 记录所有修改操作
   - 生成变更日志
   - 支持增量同步

2. **冲突处理**
   - 使用时间戳
   - 版本控制
   - 冲突解决策略
   - 手动合并支持

3. **备份恢复**
   - 自动备份
   - 导入导出
   - 版本回滚
   - 数据迁移

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