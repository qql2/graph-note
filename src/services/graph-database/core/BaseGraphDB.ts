import { v4 as uuidv4 } from "uuid";
import {
  GraphNode,
  GraphEdge,
  GraphDatabaseInterface,
  DatabaseConfig,
  SQLiteEngine,
  DeleteMode,
  Operation,
  ExportOptions,
  ImportMode,
  ImportResult,
  ValidationResult
} from "./types";
import { DATABASE_SCHEMA } from "./schema";
import {
  DatabaseError,
  NodeNotFoundError,
  EdgeNotFoundError,
  ValidationError,
  TransactionError,
} from "./errors";

// TODO: 嵌套事务的处理交给transaction Service

export abstract class BaseGraphDB implements GraphDatabaseInterface {
  protected db: SQLiteEngine | null = null;
  protected config: DatabaseConfig | null = null;
  protected initialized = false;

  // 抽象方法：由具体平台实现
  protected abstract createEngine(config: DatabaseConfig): Promise<SQLiteEngine>;
  protected abstract persistData(): Promise<void>;
  protected abstract getEngine(): Promise<SQLiteEngine>;

  async initialize(config: DatabaseConfig): Promise<void> {
    if (this.initialized) return;

    try {
      this.config = config;
      this.db = await this.createEngine(config);
      await this.setupDatabase();
      this.initialized = true;
    } catch (error) {
      console.error("Database initialization error:", error);
      throw error
    }
  }

  protected async setupDatabase(): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    try {
      await this.db.transaction(async () => {
        // 创建表
        for (const createTable of DATABASE_SCHEMA.createTables) {
          await this.db!.run(createTable);
        }
        // 创建索引
        for (const createIndex of DATABASE_SCHEMA.createIndexes) {
          await this.db!.run(createIndex);
        }
      });      
    } catch (error) {
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        this.initialized = false;
      } catch (error) {
        throw new DatabaseError("Failed to close database", error as Error);
      }
    }
  }

  // 事务支持 - 这些方法现在是抽象的，由具体平台实现
  // TODO (AI切勿擅自修改)将来移除这些套层方法, 直接通过this.db.transaction方法
  async beginTransaction(): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");
    await this.db.beginTransaction();
  }

  async commitTransaction(): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");
    await this.db.commitTransaction();
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");
    await this.db.rollbackTransaction();
  }

  // 判断是否在事务中 - 这个方法也由具体平台实现
  protected get inTransaction(): boolean {
    // 这个需要在具体实现中提供，默认返回false
    return false;
  }

  // TODO (AI不要自动修改)将来不要再额外包一层了, 直接用db.transaction方法
  protected async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.db) throw new DatabaseError("Database not initialized");
    
    // 直接使用db.transaction方法，该方法会在具体实现中提供
    try {
      return await this.db.transaction(operation);
    } catch (error) {
      throw error;
    }
  }

  // 节点操作
  async addNode(node: Omit<GraphNode, "created_at" | "updated_at">): Promise<string> {
    if (!this.db) throw new DatabaseError("Database not initialized");
    
    const id = node.id || uuidv4();
    const now = new Date().toISOString();

    // 定义添加节点的操作
    const addNodeOperation = async (db: SQLiteEngine) => {
      // 插入节点基本信息
      await db.run(
        `INSERT INTO nodes (id, type, label, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, node.type, node.label, now, now]
      );

      // 插入节点属性
      if (node.properties) {
        for (const [key, value] of Object.entries(node.properties)) {
          await db.run(
            `INSERT INTO node_properties (node_id, key, value)
             VALUES (?, ?, ?)`,
            [id, key, JSON.stringify(value)]
          );
        }
      }

      return id;
    };

    // 使用事务执行操作
    try {
      return await this.withTransaction(async () => {
        try {
          return await addNodeOperation(this.db!);
        } catch (error) {
          throw new DatabaseError(`Failed to add node: ${error}`, error as Error);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async updateNode(id: string, updates: Partial<GraphNode>): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    // 创建更新操作的函数
    const updateOperation = async (db: SQLiteEngine) => {
      // 检查节点是否存在
      const nodeExistsResult = await db.query(
        "SELECT 1 FROM nodes WHERE id = ?",
        [id]
      );
      
      if (!nodeExistsResult?.values || nodeExistsResult.values.length === 0) {
        throw new NodeNotFoundError(id);
      }

      // 更新节点基本属性
      if (
        updates.label !== undefined ||
        updates.type !== undefined
      ) {
        const sets: string[] = [];
        const params: any[] = [];

        if (updates.label !== undefined) {
          sets.push("label = ?");
          params.push(updates.label);
        }
        if (updates.type !== undefined) {
          sets.push("type = ?");
          params.push(updates.type);
        }

        if (sets.length > 0) {
          sets.push("updated_at = ?");
          params.push(new Date().toISOString());
          params.push(id);

          await db.run(
            `UPDATE nodes SET ${sets.join(", ")} WHERE id = ?`,
            params
          );
        }
      }

      // 更新节点属性
      if (updates.properties) {
        // 删除现有属性
        await db.run("DELETE FROM node_properties WHERE node_id = ?", [id]);
        
        // 插入新属性
        for (const [key, value] of Object.entries(updates.properties)) {
          await db.run(
            `INSERT INTO node_properties (node_id, key, value)
             VALUES (?, ?, ?)`,
            [id, key, JSON.stringify(value)]
          );
        }
      }
    };

    try {
      // 如果已经在事务中，直接执行操作
      if (this.inTransaction) {
        try {
          await updateOperation(this.db);
        } catch (error) {
          if (error instanceof NodeNotFoundError) {
            throw error;
          }
          throw new DatabaseError(`Failed to update node: ${error}`, error as Error);
        }
        return;
      }

      // 否则，使用事务执行操作
      await this.db.transaction(async () => {
        try {
          await updateOperation(this.db!);
          // 移除persistData调用，因为它已经在事务API中自动执行了
        } catch (error) {
          if (error instanceof NodeNotFoundError) {
            throw error;
          }
          throw new DatabaseError(`Failed to update node: ${error}`, error as Error);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteNode(id: string, mode: DeleteMode = DeleteMode.KEEP_CONNECTED): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    // 创建删除操作的函数
    const deleteOperation = async (db: SQLiteEngine) => {
      // 检查节点是否存在
      const nodeExistsResult = await db.query(
        "SELECT 1 FROM nodes WHERE id = ?",
        [id]
      );
      
      if (!nodeExistsResult?.values || nodeExistsResult.values.length === 0) {
        throw new NodeNotFoundError(id);
      }

      // 添加日志以便调试
      ;

      if (mode === DeleteMode.CASCADE) {
        // 级联删除模式：删除所有相关数据
        // 1. 获取与节点相关的所有边ID
        const relatedEdgesResult = await db.query(
          `SELECT id FROM relationships 
           WHERE source_id = ? OR target_id = ?`,
          [id, id]
        );
        
        // 记录相关边的ID
        const edgeIds: string[] = [];
        if (relatedEdgesResult?.values && relatedEdgesResult.values.length > 0) {
          relatedEdgesResult.values.forEach(row => {
            if (row.id) edgeIds.push(row.id);
          });
        }
        
        ;

        // 2. 删除与节点相关的所有边的属性
        for (const edgeId of edgeIds) {
          await db.run(
            `DELETE FROM relationship_properties 
             WHERE relationship_id = ?`,
            [edgeId]
          );
          ;
        }

        // 3. 删除与节点相关的所有边
        await db.run(
          "DELETE FROM relationships WHERE source_id = ? OR target_id = ?",
          [id, id]
        );
        ;

        // 4. 删除节点的属性
        await db.run("DELETE FROM node_properties WHERE node_id = ?", [id]);
        ;

        // 5. 删除节点本身
        await db.run("DELETE FROM nodes WHERE id = ?", [id]);
        ;
      } else {
        // 保留关联数据模式：只删除节点本身和它的属性
        // 1. 删除节点的属性
        await db.run("DELETE FROM node_properties WHERE node_id = ?", [id]);
        ;

        // 2. 将相关边的源节点或目标节点设为 NULL
        await db.run(
          `UPDATE relationships 
           SET source_id = NULL 
           WHERE source_id = ?`,
          [id]
        );
        await db.run(
          `UPDATE relationships 
           SET target_id = NULL 
           WHERE target_id = ?`,
          [id]
        );
        ;

        // 3. 删除节点本身
        await db.run("DELETE FROM nodes WHERE id = ?", [id]);
        ;
      }
    };

    try {
      // 使用事务来执行删除操作
      await this.withTransaction(async () => {
        try {
          await deleteOperation(this.db!);
        } catch (error) {
          if (error instanceof NodeNotFoundError) {
            throw error;
          }
          throw new DatabaseError(`Failed to delete node: ${error}`, error as Error);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async getNodes(): Promise<GraphNode[]> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    try {
      // 获取所有节点基本信息
      const nodesResult = await this.db.query("SELECT * FROM nodes");
      
      if (!nodesResult?.values || nodesResult.values.length === 0) {
        return [];
      }

      const nodes: GraphNode[] = [];
      
      for (const nodeRow of nodesResult.values) {
        // 确保初始化节点属性对象
        const node: GraphNode = {
          id: nodeRow.id,
          label: nodeRow.label,
          type: nodeRow.type || "node", // 确保有type字段
          created_at: nodeRow.created_at,
          updated_at: nodeRow.updated_at,
          properties: {} // 确保一定有properties对象
        };

        // 获取节点属性
        const propsResult = await this.db.query(
          "SELECT key, value FROM node_properties WHERE node_id = ?",
          [node.id]
        );
        
        if (propsResult?.values && propsResult.values.length > 0) {
          for (const propRow of propsResult.values) {
            let key: string;
            let rawValue: string;
            
            if (Array.isArray(propRow)) {
              // 如果是数组形式 [key, value]
              key = propRow[0];
              rawValue = propRow[1];
            } else {
              // 如果是对象形式 {key, value}
              key = propRow.key;
              rawValue = propRow.value;
            }
            
            try {
              node.properties![key] = JSON.parse(rawValue);
            } catch (e) {
              node.properties![key] = rawValue;
            }
          }
        }

        nodes.push(node);
      }

      return nodes;
    } catch (error) {
      throw new DatabaseError(`Failed to get nodes: ${error}`, error as Error);
    }
  }

  // 边操作
  async addEdge(edge: Omit<GraphEdge, "created_at">): Promise<string> {
    if (!this.db) throw new DatabaseError("Database not initialized");
    
    const id = edge.id || uuidv4();
    const now = new Date().toISOString();
    
    ;

    // 创建添加边的操作
    const addEdgeOperation = async (db: SQLiteEngine): Promise<string> => {
      // 验证源节点和目标节点存在
      if (edge.source_id) {
        const sourceExistsResult = await db.query(
          "SELECT 1 FROM nodes WHERE id = ?",
          [edge.source_id]
        );
        
        if (!sourceExistsResult?.values || sourceExistsResult.values.length === 0) {
          throw new NodeNotFoundError(edge.source_id);
        }
        ;
      }
      
      if (edge.target_id) {
        const targetExistsResult = await db.query(
          "SELECT 1 FROM nodes WHERE id = ?",
          [edge.target_id]
        );
        
        if (!targetExistsResult?.values || targetExistsResult.values.length === 0) {
          throw new NodeNotFoundError(edge.target_id);
        }
        ;
      }

      // 插入边基本信息
      await db.run(
        `INSERT INTO relationships (id, source_id, target_id, type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, edge.source_id, edge.target_id, edge.type, now]
      );
      ;

      // 插入边属性
      if (edge.properties) {
        for (const [key, value] of Object.entries(edge.properties)) {
          await db.run(
            `INSERT INTO relationship_properties (relationship_id, key, value)
             VALUES (?, ?, ?)`,
            [id, key, JSON.stringify(value)]
          );
          ;
        }
      }

      return id;
    };

    try {
      // 如果已经在事务中，直接执行操作
      if (this.inTransaction) {
        ;
        try {
          return await addEdgeOperation(this.db);
        } catch (error) {
          console.error("Error in addEdge operation:", error);
          if (error instanceof NodeNotFoundError) {
            throw error;
          }
          throw new DatabaseError(`Failed to add edge: ${error}`, error as Error);
        }
      }

      // 否则，使用事务执行操作
      ;
      // TODO: 这里只要在事务中执行就会导致事务提交失败
      return await this.db.transaction(async () => {
        try {
          const result = await addEdgeOperation(this.db!);
          // 不需要调用persistData，因为withTransaction会自动处理
          ;
          return result;
        } catch (error) {
          console.error("Error in addEdge transaction:", error);
          if (error instanceof NodeNotFoundError) {
            throw error;
          }
          throw new DatabaseError(`Failed to add edge: ${error}`, error as Error);
        }
      });
    } catch (error) {
      console.error("Fatal error in addEdge:", error);
      throw error;
    }
  }

  async updateEdge(id: string, updates: Partial<GraphEdge>): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    // 创建更新边的操作
    const updateEdgeOperation = async (db: SQLiteEngine): Promise<void> => {
      // 检查边是否存在
      const edgeExistsResult = await db.query(
        "SELECT 1 FROM relationships WHERE id = ?",
        [id]
      );
      
      if (!edgeExistsResult?.values || edgeExistsResult.values.length === 0) {
        throw new EdgeNotFoundError(id);
      }

      // 更新边基本属性
      if (
        updates.source_id !== undefined ||
        updates.target_id !== undefined ||
        updates.type !== undefined
      ) {
        // 验证源节点和目标节点
        if (updates.source_id) {
          const sourceExistsResult = await db.query(
            "SELECT 1 FROM nodes WHERE id = ?",
            [updates.source_id]
          );
          
          if (!sourceExistsResult?.values || sourceExistsResult.values.length === 0) {
            throw new NodeNotFoundError(updates.source_id);
          }
        }
        
        if (updates.target_id) {
          const targetExistsResult = await db.query(
            "SELECT 1 FROM nodes WHERE id = ?",
            [updates.target_id]
          );
          
          if (!targetExistsResult?.values || targetExistsResult.values.length === 0) {
            throw new NodeNotFoundError(updates.target_id);
          }
        }

        const sets: string[] = [];
        const params: any[] = [];

        if (updates.source_id !== undefined) {
          sets.push("source_id = ?");
          params.push(updates.source_id);
        }
        if (updates.target_id !== undefined) {
          sets.push("target_id = ?");
          params.push(updates.target_id);
        }
        if (updates.type !== undefined) {
          sets.push("type = ?");
          params.push(updates.type);
        }

        if (sets.length > 0) {
          params.push(id);
          await db.run(
            `UPDATE relationships SET ${sets.join(", ")} WHERE id = ?`,
            params
          );
        }
      }

      // 更新边属性
      if (updates.properties) {
        // 删除现有属性
        await db.run(
          "DELETE FROM relationship_properties WHERE relationship_id = ?", 
          [id]
        );
        
        // 插入新属性
        for (const [key, value] of Object.entries(updates.properties)) {
          await db.run(
            `INSERT INTO relationship_properties (relationship_id, key, value)
             VALUES (?, ?, ?)`,
            [id, key, JSON.stringify(value)]
          );
        }
      }
    };

    try {
      // 如果已经在事务中，直接执行操作
      if (this.inTransaction) {
        try {
          await updateEdgeOperation(this.db);
        } catch (error) {
          if (error instanceof NodeNotFoundError || error instanceof EdgeNotFoundError) {
            throw error;
          }
          throw new DatabaseError(`Failed to update edge: ${error}`, error as Error);
        }
        return;
      }

      // 否则，使用事务执行操作
      await this.db.transaction(async () => {
        try {
          await updateEdgeOperation(this.db!);
          // 移除persistData调用，因为它已经在事务API中自动执行了
        } catch (error) {
          if (error instanceof NodeNotFoundError || error instanceof EdgeNotFoundError) {
            throw error;
          }
          throw new DatabaseError(`Failed to update edge: ${error}`, error as Error);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteEdge(id: string): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    // 创建删除边的操作
    const deleteEdgeOperation = async (db: SQLiteEngine): Promise<void> => {
      // 检查边是否存在
      const edgeExistsResult = await db.query(
        "SELECT 1 FROM relationships WHERE id = ?",
        [id]
      );
      
      if (!edgeExistsResult?.values || edgeExistsResult.values.length === 0) {
        throw new EdgeNotFoundError(id);
      }

      ;

      // 删除边属性
      await db.run(
        "DELETE FROM relationship_properties WHERE relationship_id = ?", 
        [id]
      );
      ;
      
      // 删除边
      await db.run("DELETE FROM relationships WHERE id = ?", [id]);
      ;
    };

    try {
      // 使用事务执行删除操作
      await this.withTransaction(async () => {
        try {
          await deleteEdgeOperation(this.db!);
        } catch (error) {
          if (error instanceof EdgeNotFoundError) {
            throw error;
          }
          throw new DatabaseError(`Failed to delete edge: ${error}`, error as Error);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async getEdges(): Promise<GraphEdge[]> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    try {
      ;
      // 获取所有边基本信息
      const edgesResult = await this.db.query("SELECT * FROM relationships");
      
      ;
      
      if (!edgesResult?.values || edgesResult.values.length === 0) {
        ;
        return [];
      }

      ;
      
      const edges: GraphEdge[] = [];
      
      for (const edgeRow of edgesResult.values) {
        ;
        
        // 确保初始化边属性对象
        const edge: GraphEdge = {
          id: edgeRow.id,
          source_id: edgeRow.source_id,
          target_id: edgeRow.target_id,
          type: edgeRow.type,
          created_at: edgeRow.created_at,
          properties: {} // 确保一定有properties对象
        };

        ;

        // 获取边属性
        const propsResult = await this.db.query(
          "SELECT key, value FROM relationship_properties WHERE relationship_id = ?",
          [edge.id]
        );
        
        ;
        
        if (propsResult?.values && propsResult.values.length > 0) {
          for (const propRow of propsResult.values) {
            let key: string;
            let rawValue: string;
            
            if (Array.isArray(propRow)) {
              // 如果是数组形式 [key, value]
              key = propRow[0];
              rawValue = propRow[1];
            } else {
              // 如果是对象形式 {key, value}
              key = propRow.key;
              rawValue = propRow.value;
            }
            
            try {
              edge.properties![key] = JSON.parse(rawValue);
            } catch (e) {
              edge.properties![key] = rawValue;
            }
            
            ;
          }
        }

        edges.push(edge);
        ;
      }

      ;
      return edges;
    } catch (error) {
      console.error("Error in getEdges:", error);
      throw new DatabaseError(`Failed to get edges: ${error}`, error as Error);
    }
  }

  async findPath(
    startId: string,
    endId: string,
    maxDepth: number = 10
  ): Promise<GraphEdge[]> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    try {
      // 检查开始和结束节点是否存在
      const startExistsResult = await this.db.query("SELECT 1 FROM nodes WHERE id = ?", [startId]);
      if (!startExistsResult?.values || startExistsResult.values.length === 0) {
        throw new NodeNotFoundError(startId);
      }
      
      const endExistsResult = await this.db.query("SELECT 1 FROM nodes WHERE id = ?", [endId]);
      if (!endExistsResult?.values || endExistsResult.values.length === 0) {
        throw new NodeNotFoundError(endId);
      }

      // 实现广度优先搜索
      const visitedNodes = new Set<string>([startId]);
      const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: startId, path: [] }];
      const edgesMap = new Map<string, GraphEdge>();
      
      // 先获取所有边和边的详细信息，以提高性能
      const allEdges = await this.getEdges();
      allEdges.forEach(edge => {
        if (edge.id) {
          edgesMap.set(edge.id, edge);
        }
      });
      
      // 构建快速查找的邻接表
      const adjacencyList = new Map<string, Array<{ edgeId: string; targetId: string }>>();
      
      allEdges.forEach(edge => {
        if (edge.source_id && edge.target_id && edge.id) {
          if (!adjacencyList.has(edge.source_id)) {
            adjacencyList.set(edge.source_id, []);
          }
          adjacencyList.get(edge.source_id)!.push({
            edgeId: edge.id,
            targetId: edge.target_id
          });
        }
      });
      
      // BFS查找路径
      for (let depth = 0; depth < maxDepth && queue.length > 0; depth++) {
        const levelSize = queue.length;
        
        for (let i = 0; i < levelSize; i++) {
          const { nodeId, path } = queue.shift()!;
          
          if (nodeId === endId) {
            // 找到路径，返回边的详细信息
            return path.map(edgeId => edgesMap.get(edgeId))
                       .filter((edge): edge is GraphEdge => edge !== undefined);
          }
          
          // 遍历当前节点的所有出边
          const neighbors = adjacencyList.get(nodeId) || [];
          
          for (const { edgeId, targetId } of neighbors) {
            if (!visitedNodes.has(targetId)) {
              visitedNodes.add(targetId);
              queue.push({
                nodeId: targetId,
                path: [...path, edgeId]
              });
            }
          }
        }
      }
      
      // 没有找到路径
      return [];
    } catch (error) {
      if (error instanceof NodeNotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to find path: ${error}`, error as Error);
    }
  }

  async findConnectedNodes(nodeId: string, depth: number = 1): Promise<GraphNode[]> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    try {
      // 检查节点是否存在
      const nodeExistsResult = await this.db.query("SELECT 1 FROM nodes WHERE id = ?", [nodeId]);
      if (!nodeExistsResult?.values || nodeExistsResult.values.length === 0) {
        throw new NodeNotFoundError(nodeId);
      }

      // 获取所有节点和边，以优化性能
      const allNodes = await this.getNodes();
      const allEdges = await this.getEdges();
      
      // 构建节点映射和邻接表
      const nodesMap = new Map<string, GraphNode>();
      allNodes.forEach(node => {
        if (node.id) {
          nodesMap.set(node.id, node);
        }
      });
      
      const adjacencyList = new Map<string, string[]>();
      
      // 构建无向图的邻接表
      allEdges.forEach(edge => {
        if (edge.source_id) {
          if (!adjacencyList.has(edge.source_id)) {
            adjacencyList.set(edge.source_id, []);
          }
          if (edge.target_id) {
            adjacencyList.get(edge.source_id)!.push(edge.target_id);
          }
        }
        
        if (edge.target_id) {
          if (!adjacencyList.has(edge.target_id)) {
            adjacencyList.set(edge.target_id, []);
          }
          if (edge.source_id) {
            adjacencyList.get(edge.target_id)!.push(edge.source_id);
          }
        }
      });
      
      // BFS查找连接的节点
      const visitedNodes = new Set<string>([nodeId]);
      const queue: Array<{ id: string; level: number }> = [{ id: nodeId, level: 0 }];
      const connectedNodes: GraphNode[] = [];
      
      while (queue.length > 0) {
        const { id, level } = queue.shift()!;
        
        if (level > 0) { // 不包括起始节点
          const node = nodesMap.get(id);
          if (node) {
            connectedNodes.push(node);
          }
        }
        
        if (level < depth) {
          const neighbors = adjacencyList.get(id) || [];
          
          for (const neighborId of neighbors) {
            if (!visitedNodes.has(neighborId)) {
              visitedNodes.add(neighborId);
              queue.push({ id: neighborId, level: level + 1 });
            }
          }
        }
      }
      
      return connectedNodes;
    } catch (error) {
      if (error instanceof NodeNotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to find connected nodes: ${error}`, error as Error);
    }
  }

  async exportData(): Promise<Uint8Array> {
    if (!this.db) throw new DatabaseError("Database not initialized");
    
    try {
      return this.db.export();
    } catch (error) {
      throw new DatabaseError(`Failed to export data: ${error}`, error as Error);
    }
  }

  async importData(data: Uint8Array): Promise<void> {
    throw new DatabaseError("Import method must be implemented by the platform-specific class");
  }

  async createBackup(): Promise<string> {
    throw new DatabaseError("Backup method must be implemented by the platform-specific class");
  }

  async restoreFromBackup(backupId: string): Promise<void> {
    throw new DatabaseError("Restore method must be implemented by the platform-specific class");
  }

  async listBackups(): Promise<string[]> {
    throw new DatabaseError("List backups method must be implemented by the platform-specific class");
  }

  // 清空数据库方法
  public async clear(): Promise<void> {
    const db = this.db;
    if (!db) throw new DatabaseError("Database not initialized");
    try {
      await db.beginTransaction();
      
      // 先清空边属性表
      await db.run('DELETE FROM relationship_properties');
      
      // 再清空边表
      await db.run('DELETE FROM relationships');
      
      // 清空节点属性表
      await db.run('DELETE FROM node_properties');
      
      // 最后清空节点表
      await db.run('DELETE FROM nodes');
      
      await db.commitTransaction();
    } catch (error) {
      await db.rollbackTransaction();
      throw error;
    }
  }

  // 导出数据为JSON
  public async exportToJson(options?: ExportOptions): Promise<string> {
    const prettyPrint = options?.prettyPrint ?? true;
    const includeMetadata = options?.includeMetadata ?? true;
    
    // 获取所有节点和边
    const nodes = await this.getNodes();
    const edges = await this.getEdges();
    
    // 构建导出数据
    const exportData: any = {
      data: {
        nodes,
        edges
      }
    };
    
    // 添加元数据
    if (includeMetadata) {
      exportData.metadata = {
        version: "1.0",
        created_at: new Date().toISOString(),
      };
    }
    
    // 转换为JSON字符串
    return JSON.stringify(exportData, null, prettyPrint ? 2 : undefined);
  }
  
  // 验证导入数据
  public async validateImportData(jsonData: string): Promise<ValidationResult> {
    try {
      // 解析JSON数据
      const parsedData = JSON.parse(jsonData);
      
      // 检查基本结构
      if (!parsedData.data || !Array.isArray(parsedData.data.nodes) || !Array.isArray(parsedData.data.edges)) {
        return {
          valid: false,
          nodeCount: 0,
          edgeCount: 0,
          errors: ["Invalid data structure: missing 'data.nodes' or 'data.edges' arrays"]
        };
      }
      
      // 提取版本信息
      const version = parsedData.metadata?.version;
      
      // 计算节点和边的数量
      const nodeCount = parsedData.data.nodes.length;
      const edgeCount = parsedData.data.edges.length;
      
      // 验证节点数据
      const nodeErrors: string[] = [];
      parsedData.data.nodes.forEach((node: any, index: number) => {
        if (!node.type || !node.label) {
          nodeErrors.push(`Node at index ${index} is missing required fields (type or label)`);
        }
      });
      
      // 验证边数据
      const edgeErrors: string[] = [];
      parsedData.data.edges.forEach((edge: any, index: number) => {
        if (!edge.source_id || !edge.target_id || !edge.type) {
          edgeErrors.push(`Edge at index ${index} is missing required fields (source_id, target_id, or type)`);
        }
      });
      
      const errors = [...nodeErrors, ...edgeErrors];
      
      return {
        valid: errors.length === 0,
        version,
        nodeCount,
        edgeCount,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        nodeCount: 0,
        edgeCount: 0,
        errors: [`Invalid JSON format: ${(error as Error).message}`]
      };
    }
  }
  
  // 获取单个边的方法
  public async getEdge(id: string): Promise<GraphEdge> {
    const db = this.db;
    if (!db) throw new DatabaseError("Database not initialized");
    const result = await db.query(
      'SELECT * FROM relationships WHERE id = ?',
      [id]
    );

    if (!result.values || result.values.length === 0) {
      throw new Error(`Edge with id ${id} not found`);
    }

    // 获取基本边信息
    const edge: GraphEdge = result.values[0] as GraphEdge;
    
    // 获取边的属性
    const propsResult = await db.query(
      "SELECT key, value FROM relationship_properties WHERE relationship_id = ?",
      [id]
    );
    
    // 初始化属性对象
    edge.properties = {};
    
    if (propsResult?.values && propsResult.values.length > 0) {
      for (const propRow of propsResult.values) {
        let key: string;
        let rawValue: string;
        
        if (Array.isArray(propRow)) {
          key = propRow[0];
          rawValue = propRow[1];
        } else {
          key = propRow.key;
          rawValue = propRow.value;
        }
        
        try {
          edge.properties[key] = JSON.parse(rawValue);
        } catch (e) {
          edge.properties[key] = rawValue;
        }
      }
    }

    return edge;
  }

  // 从JSON导入数据方法中修改边导入部分
  public async importFromJson(jsonData: string, mode: ImportMode): Promise<ImportResult> {
    // 解析JSON数据
    let parsedData;
    try {
      parsedData = JSON.parse(jsonData);
    } catch (error) {
      return {
        success: false,
        nodesImported: 0,
        edgesImported: 0,
        errors: [`Invalid JSON format: ${(error as Error).message}`]
      };
    }
    
    // 验证数据结构
    if (!parsedData.data || !Array.isArray(parsedData.data.nodes) || !Array.isArray(parsedData.data.edges)) {
      return {
        success: false,
        nodesImported: 0,
        edgesImported: 0,
        errors: ["Invalid data structure: missing 'data.nodes' or 'data.edges' arrays"]
      };
    }
    
    const db = this.db;
    if (!db) throw new DatabaseError("Database not initialized");
    const errors: string[] = [];
    const importedNodeIds: string[] = [];
    
    try {
      await db.beginTransaction();
      
      // 如果是替换模式，先清空数据库
      if (mode === ImportMode.REPLACE) {
        // 清空边表
        await db.run('DELETE FROM relationship_properties');
        await db.run('DELETE FROM relationships');
        // 清空节点表
        await db.run('DELETE FROM node_properties');
        await db.run('DELETE FROM nodes');
      }
      
      // 导入节点
      for (const node of parsedData.data.nodes) {
        try {
          // 处理ID冲突
          if (mode === ImportMode.MERGE && node.id) {
            // 检查节点是否已存在
            try {
              await this.getNode(node.id);
              // 如果存在则更新
              await this.updateNode(node.id, {
                label: node.label,
                type: node.type,
                properties: node.properties
              });
              importedNodeIds.push(node.id);
            } catch {
              // 不存在则添加
              const newId = await this.addNode({
                id: node.id,
                label: node.label,
                type: node.type,
                properties: node.properties
              });
              importedNodeIds.push(newId);
            }
          } else {
            // 替换模式或无ID的合并模式直接添加
            const newNode = {
              id: node.id, // 如果提供了ID则使用，否则会自动生成
              label: node.label,
              type: node.type,
              properties: node.properties
            };
            const newId = await this.addNode(newNode);
            importedNodeIds.push(newId);
          }
        } catch (error) {
          errors.push(`Failed to import node ${node.id || 'unknown'}: ${(error as Error).message}`);
        }
      }
      
      // 导入边 - 修改这部分添加外键约束检查
      const importedEdgeIds: string[] = [];
      
      // 创建一个已导入节点ID的集合，用于快速查找
      const importedNodesSet = new Set(importedNodeIds);
      
      // 检查所有需要导入的边，确保引用的节点都存在
      for (const edge of parsedData.data.edges) {
        try {
          // 检查源节点和目标节点是否存在
          const sourceExists = edge.source_id ? importedNodesSet.has(edge.source_id) : true;
          const targetExists = edge.target_id ? importedNodesSet.has(edge.target_id) : true;
          
          if (!sourceExists) {
            errors.push(`Failed to import edge ${edge.id || 'unknown'}: Source node ${edge.source_id} does not exist`);
            continue;
          }
          
          if (!targetExists) {
            errors.push(`Failed to import edge ${edge.id || 'unknown'}: Target node ${edge.target_id} does not exist`);
            continue;
          }
          
          // 处理ID冲突
          if (mode === ImportMode.MERGE && edge.id) {
            // 检查边是否已存在
            try {
              await this.getEdge(edge.id);
              // 如果存在则更新
              await this.updateEdge(edge.id, {
                source_id: edge.source_id,
                target_id: edge.target_id,
                type: edge.type,
                properties: edge.properties
              });
              importedEdgeIds.push(edge.id);
            } catch {
              // 不存在则添加
              const newId = await this.addEdge({
                id: edge.id,
                source_id: edge.source_id,
                target_id: edge.target_id,
                type: edge.type,
                properties: edge.properties
              });
              importedEdgeIds.push(newId);
            }
          } else {
            // 替换模式或无ID的合并模式直接添加
            const newEdge = {
              id: edge.id, // 如果提供了ID则使用，否则会自动生成
              source_id: edge.source_id,
              target_id: edge.target_id,
              type: edge.type,
              properties: edge.properties
            };
            
            const newId = await this.addEdge(newEdge);
            importedEdgeIds.push(newId);
          }
        } catch (error) {
          errors.push(`Failed to import edge ${edge.id || 'unknown'}: ${(error as Error).message}`);
        }
      }
      
      await db.commitTransaction();
      
      return {
        success: errors.length === 0,
        nodesImported: importedNodeIds.length,
        edgesImported: importedEdgeIds.length,
        errors
      };
    } catch (error) {
      await db.rollbackTransaction();
      return {
        success: false,
        nodesImported: 0,
        edgesImported: 0,
        errors: [`Transaction failed: ${(error as Error).message}`]
      };
    }
  }

  // 获取单个节点的方法
  public async getNode(id: string): Promise<GraphNode> {
    const db = this.db
    if (!db) throw new DatabaseError("Database not initialized");
    const result = await db.query(
      'SELECT * FROM nodes WHERE id = ?',
      [id]
    );

    if (!result.values || result.values.length === 0) {
      throw new Error(`Node with id ${id} not found`);
    }

    return result.values[0] as GraphNode;
  }
} 