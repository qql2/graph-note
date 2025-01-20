import { v4 as uuidv4 } from "uuid";
import {
  GraphNode,
  GraphEdge,
  GraphDatabaseInterface,
  DatabaseConfig,
  SQLiteEngine,
  DeleteMode,
} from "./types";
import { DATABASE_SCHEMA } from "./schema";

export abstract class BaseGraphDB implements GraphDatabaseInterface {
  protected db: SQLiteEngine | null = null;
  protected config: DatabaseConfig | null = null;
  protected initialized = false;

  // 抽象方法：由具体平台实现
  protected abstract createEngine(
    config: DatabaseConfig
  ): Promise<SQLiteEngine>;
  protected abstract persistData(): Promise<void>;

  async initialize(config: DatabaseConfig): Promise<void> {
    if (this.initialized) return;

    try {
      this.config = config;
      this.db = await this.createEngine(config);
      await this.setupDatabase();
      this.initialized = true;
    } catch (error) {
      console.error("Database initialization error:", error);
      throw error;
    }
  }

  protected async setupDatabase(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    this.db.transaction(() => {
      // 创建表
      for (const createTable of DATABASE_SCHEMA.createTables) {
        this.db!.run(createTable);
      }
      // 创建索引
      for (const createIndex of DATABASE_SCHEMA.createIndexes) {
        this.db!.run(createIndex);
      }
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  // 事务支持
  private inTransaction = false;

  async beginTransaction(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    if (this.inTransaction) throw new Error("Transaction already started");

    this.inTransaction = true;
    this.db.run("BEGIN TRANSACTION");
  }

  async commitTransaction(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    if (!this.inTransaction) throw new Error("No transaction in progress");

    this.db.run("COMMIT");
    this.inTransaction = false;
    await this.persistData();
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    if (!this.inTransaction) throw new Error("No transaction in progress");

    this.db.run("ROLLBACK");
    this.inTransaction = false;
  }

  protected async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.db) throw new Error("Database not initialized");
    if (this.inTransaction) {
      // 如果已经在事务中，直接执行操作
      return await operation();
    }

    try {
      await this.beginTransaction();
      const result = await operation();
      await this.commitTransaction();
      return result;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  // 节点操作
  async addNode(
    node: Omit<GraphNode, "created_at" | "updated_at">
  ): Promise<string> {
    const id = node.id || uuidv4();
    const now = new Date().toISOString();

    return this.withTransaction(async () => {
      // 插入节点基本信息
      this.db!.run(
        `INSERT INTO nodes (id, type, label, x, y, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, node.type, node.label, node.x, node.y, now, now]
      );

      // 插入节点属性，确保所有值都被序列化为字符串
      const properties = node.properties || {};
      for (const [key, value] of Object.entries(properties)) {
        this.db!.run(
          `INSERT INTO node_properties (node_id, key, value)
           VALUES (?, ?, ?)`,
          [id, key, JSON.stringify(value)]
        );
      }

      return id;
    });
  }

  async updateNode(id: string, updates: Partial<GraphNode>): Promise<void> {
    return this.withTransaction(async () => {
      if (
        "label" in updates ||
        "type" in updates ||
        "x" in updates ||
        "y" in updates
      ) {
        const sets: string[] = [];
        const params: any[] = [];

        for (const [key, value] of Object.entries(updates)) {
          if (key !== "id" && key !== "created_at" && key !== "properties") {
            sets.push(`${key} = ?`);
            params.push(value);
          }
        }

        if (sets.length > 0) {
          sets.push("updated_at = ?");
          params.push(new Date().toISOString());
          params.push(id);

          this.db!.run(
            `UPDATE nodes SET ${sets.join(", ")} WHERE id = ?`,
            params
          );
        }
      }

      if (updates.properties) {
        this.db!.run("DELETE FROM node_properties WHERE node_id = ?", [id]);
        for (const [key, value] of Object.entries(updates.properties)) {
          this.db!.run(
            `INSERT INTO node_properties (node_id, key, value)
             VALUES (?, ?, ?)`,
            [id, key, JSON.stringify(value)]
          );
        }
      }
    });
  }

  async deleteNode(
    id: string,
    mode: DeleteMode = DeleteMode.KEEP_CONNECTED
  ): Promise<void> {
    return this.withTransaction(async () => {
      if (mode === DeleteMode.CASCADE) {
        // 级联删除模式：删除所有相关数据
        // 1. 删除与节点相关的所有边的属性
        this.db!.run(
          `DELETE FROM relationship_properties 
           WHERE relationship_id IN (
             SELECT id FROM relationships 
             WHERE source_id = ? OR target_id = ?
           )`,
          [id, id]
        );

        // 2. 删除与节点相关的所有边
        this.db!.run(
          "DELETE FROM relationships WHERE source_id = ? OR target_id = ?",
          [id, id]
        );

        // 3. 删除节点的属性
        this.db!.run("DELETE FROM node_properties WHERE node_id = ?", [id]);

        // 4. 删除节点本身
        this.db!.run("DELETE FROM nodes WHERE id = ?", [id]);
      } else {
        // 保留关联数据模式：只删除节点本身和它的属性
        // 1. 删除节点的属性
        this.db!.run("DELETE FROM node_properties WHERE node_id = ?", [id]);

        // 2. 将相关边的源节点或目标节点设为 NULL
        this.db!.run(
          `UPDATE relationships 
           SET source_id = NULL 
           WHERE source_id = ?`,
          [id]
        );
        this.db!.run(
          `UPDATE relationships 
           SET target_id = NULL 
           WHERE target_id = ?`,
          [id]
        );

        // 3. 删除节点本身
        this.db!.run("DELETE FROM nodes WHERE id = ?", [id]);
      }
    });
  }

  async getNodes(): Promise<GraphNode[]> {
    if (!this.db) throw new Error("Database not initialized");

    const result = this.db.exec(`
      SELECT 
        n.*,
        (
          SELECT json_group_object(key, value)
          FROM node_properties
          WHERE node_id = n.id
        ) as props
      FROM nodes n
    `)[0];

    if (!result) return [];

    return result.values.map((row: any) => {
      let properties = {};
      try {
        if (row[7]) {
          const propsObj = JSON.parse(row[7]);
          properties = Object.fromEntries(
            Object.entries(propsObj).map(([k, v]) => [
              k,
              JSON.parse(v as string),
            ])
          );
        }
      } catch (error) {
        console.warn(`Failed to parse properties for node ${row[0]}:`, error);
      }

      return {
        id: row[0],
        type: row[1],
        label: row[2],
        x: row[3],
        y: row[4],
        created_at: row[5],
        updated_at: row[6],
        properties,
      };
    });
  }

  // 边操作
  async addEdge(edge: Omit<GraphEdge, "created_at">): Promise<string> {
    const id = edge.id || uuidv4();
    const now = new Date().toISOString();

    return this.withTransaction(async () => {
      this.db!.run(
        `INSERT INTO relationships (id, source_id, target_id, type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, edge.source_id, edge.target_id, edge.type, now]
      );

      const properties = edge.properties || {};
      for (const [key, value] of Object.entries(properties)) {
        this.db!.run(
          `INSERT INTO relationship_properties (relationship_id, key, value)
           VALUES (?, ?, ?)`,
          [id, key, JSON.stringify(value)]
        );
      }

      return id;
    });
  }

  async deleteEdge(id: string): Promise<void> {
    return this.withTransaction(async () => {
      this.db!.run("DELETE FROM relationships WHERE id = ?", [id]);
    });
  }

  async getEdges(): Promise<GraphEdge[]> {
    if (!this.db) throw new Error("Database not initialized");

    const result = this.db.exec(`
      SELECT 
        r.*,
        (
          SELECT json_group_object(key, value)
          FROM relationship_properties
          WHERE relationship_id = r.id
        ) as props
      FROM relationships r
    `)[0];

    if (!result) return [];

    return result.values.map((row: any) => {
      let properties = {};
      try {
        if (row[5]) {
          const propsObj = JSON.parse(row[5]);
          properties = Object.fromEntries(
            Object.entries(propsObj).map(([k, v]) => [
              k,
              JSON.parse(v as string),
            ])
          );
        }
      } catch (error) {
        console.warn(`Failed to parse properties for edge ${row[0]}:`, error);
      }

      return {
        id: row[0],
        source_id: row[1],
        target_id: row[2],
        type: row[3],
        created_at: row[4],
        properties,
      };
    });
  }

  async updateEdge(id: string, updates: Partial<GraphEdge>): Promise<void> {
    return this.withTransaction(async () => {
      if ("type" in updates) {
        this.db!.run(`UPDATE relationships SET type = ? WHERE id = ?`, [
          updates.type,
          id,
        ]);
      }

      if (updates.properties) {
        this.db!.run(
          "DELETE FROM relationship_properties WHERE relationship_id = ?",
          [id]
        );
        for (const [key, value] of Object.entries(updates.properties)) {
          this.db!.run(
            `INSERT INTO relationship_properties (relationship_id, key, value)
             VALUES (?, ?, ?)`,
            [id, key, JSON.stringify(value)]
          );
        }
      }
    });
  }

  // 高级查询
  async findPath(
    startId: string,
    endId: string,
    maxDepth: number = 5
  ): Promise<GraphEdge[]> {
    if (!this.db) throw new Error("Database not initialized");

    const result = this.db.exec(
      `
      WITH RECURSIVE
      path(source, target, path_edges, depth) AS (
        -- Base case
        SELECT 
          source_id, 
          target_id,
          json_array(
            json_object(
              'id', id,
              'source_id', source_id,
              'target_id', target_id,
              'type', type
            )
          ),
          1
        FROM relationships
        WHERE source_id = ?
        
        UNION ALL
        
        -- Recursive case
        SELECT 
          p.source,
          r.target_id,
          json(
            substr(json(p.path_edges), 1, length(json(p.path_edges)) - 1)
            || ',' ||
            json_object(
              'id', r.id,
              'source_id', r.source_id,
              'target_id', r.target_id,
              'type', r.type
            )
            || ']'
          ),
          p.depth + 1
        FROM path p
        JOIN relationships r ON p.target = r.source_id
        WHERE p.depth < ?
      )
      SELECT path_edges
      FROM path
      WHERE target = ?
      ORDER BY depth
      LIMIT 1
    `,
      [startId, maxDepth, endId]
    )[0];

    if (!result || !result.values[0]) return [];

    try {
      const pathEdges = JSON.parse(result.values[0][0] as string);
      return pathEdges.map((edge: any) => ({
        id: edge.id,
        source_id: edge.source_id,
        target_id: edge.target_id,
        type: edge.type,
        properties: {},
        created_at: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Error parsing path:", error);
      return [];
    }
  }

  async findConnectedNodes(
    nodeId: string,
    depth: number = 1
  ): Promise<GraphNode[]> {
    if (!this.db) throw new Error("Database not initialized");

    const result = this.db.exec(
      `
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
    `,
      [nodeId, depth]
    )[0];

    if (!result) return [];

    return result.values.map((row: any) => ({
      id: row[0],
      type: row[1],
      label: row[2],
      x: row[3],
      y: row[4],
      created_at: row[5],
      updated_at: row[6],
      properties: {},
    }));
  }

  // 数据导入导出
  async exportData(): Promise<Uint8Array> {
    if (!this.db) throw new Error("Database not initialized");
    return this.db.export();
  }

  async importData(data: Uint8Array): Promise<void> {
    await this.initialize(this.config!);
    // 具体导入逻辑由平台特定实现处理
  }

  // 备份管理
  abstract createBackup(): Promise<string>;
  abstract restoreFromBackup(backupId: string): Promise<void>;
  abstract listBackups(): Promise<string[]>;

  async isReady(): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    try {
      // 检查数据库是否可以执行简单查询
      this.db.exec("SELECT 1");

      // 检查必要的表是否存在
      const tables = this.db.exec(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('nodes', 'node_properties', 'relationships', 'relationship_properties')
      `)[0];

      // 确保所有必要的表都存在
      return tables?.values?.length === 4;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }

  // 条件查询节点
  async findNodes(conditions?: {
    type?: string;
    properties?: Record<string, any>;
  }): Promise<GraphNode[]> {
    if (!this.db) throw new Error("Database not initialized");

    let query = `
      SELECT DISTINCT n.id
      FROM nodes n
    `;

    const params: any[] = [];
    const conditions_list: string[] = [];

    if (conditions?.type) {
      conditions_list.push('n.type = ?');
      params.push(conditions.type);
    }

    if (conditions?.properties) {
      Object.entries(conditions.properties).forEach(([key, value]) => {
        conditions_list.push(`
          EXISTS (
            SELECT 1 FROM node_properties 
            WHERE node_id = n.id 
            AND key = ? 
            AND value = json(?)
          )
        `);
        params.push(key, JSON.stringify(value));
      });
    }

    if (conditions_list.length > 0) {
      query += ` WHERE ${conditions_list.join(' AND ')}`;
    }

    try {
      const result = this.db.exec(query, params)[0];
      if (!result) return [];

      // 获取每个节点的完整信息
      return await Promise.all(
        result.values.map(async (row: any) => {
          const nodeId = row[0];
          const nodeResult = this.db!.exec(`
            SELECT 
              n.*,
              (
                SELECT json_group_object(key, value)
                FROM node_properties
                WHERE node_id = n.id
              ) as props
            FROM nodes n
            WHERE n.id = ?
          `, [nodeId])[0];

          if (!nodeResult) return null;

          const nodeRow = nodeResult.values[0];
          let properties = {};
          try {
            if (nodeRow[7]) {
              const propsObj = JSON.parse(nodeRow[7]);
              properties = Object.fromEntries(
                Object.entries(propsObj).map(([k, v]) => [
                  k,
                  JSON.parse(v as string),
                ])
              );
            }
          } catch (error) {
            console.warn(`Failed to parse properties for node ${nodeId}:`, error);
          }

          return {
            id: nodeRow[0],
            type: nodeRow[1],
            label: nodeRow[2],
            x: nodeRow[3],
            y: nodeRow[4],
            created_at: nodeRow[5],
            updated_at: nodeRow[6],
            properties,
          };
        })
      ).then(nodes => nodes.filter((node): node is GraphNode => node !== null));
    } catch (error) {
      console.error('Error in findNodes:', error);
      throw new Error(`Failed to find nodes: ${error}`);
    }
  }

  // 条件查询边
  async findEdges(conditions?: {
    type?: string;
    source_id?: string;
    target_id?: string;
    properties?: Record<string, any>;
  }): Promise<GraphEdge[]> {
    if (!this.db) throw new Error("Database not initialized");

    let query = `
      SELECT DISTINCT r.id
      FROM relationships r
    `;

    const params: any[] = [];
    const conditions_list: string[] = [];

    if (conditions?.type) {
      conditions_list.push('r.type = ?');
      params.push(conditions.type);
    }

    if (conditions?.source_id) {
      conditions_list.push('r.source_id = ?');
      params.push(conditions.source_id);
    }

    if (conditions?.target_id) {
      conditions_list.push('r.target_id = ?');
      params.push(conditions.target_id);
    }

    if (conditions?.properties) {
      Object.entries(conditions.properties).forEach(([key, value]) => {
        conditions_list.push(`
          EXISTS (
            SELECT 1 FROM relationship_properties 
            WHERE relationship_id = r.id 
            AND key = ? 
            AND value = json(?)
          )
        `);
        params.push(key, JSON.stringify(value));
      });
    }

    if (conditions_list.length > 0) {
      query += ` WHERE ${conditions_list.join(' AND ')}`;
    }

    try {
      const result = this.db.exec(query, params)[0];
      if (!result) return [];

      // 获取每个边的完整信息
      return await Promise.all(
        result.values.map(async (row: any) => {
          const edgeId = row[0];
          const edgeResult = this.db!.exec(`
            SELECT 
              r.*,
              (
                SELECT json_group_object(key, value)
                FROM relationship_properties
                WHERE relationship_id = r.id
              ) as props
            FROM relationships r
            WHERE r.id = ?
          `, [edgeId])[0];

          if (!edgeResult) return null;

          const edgeRow = edgeResult.values[0];
          let properties = {};
          try {
            if (edgeRow[5]) {
              const propsObj = JSON.parse(edgeRow[5]);
              properties = Object.fromEntries(
                Object.entries(propsObj).map(([k, v]) => [
                  k,
                  JSON.parse(v as string),
                ])
              );
            }
          } catch (error) {
            console.warn(`Failed to parse properties for edge ${edgeId}:`, error);
          }

          return {
            id: edgeRow[0],
            source_id: edgeRow[1],
            target_id: edgeRow[2],
            type: edgeRow[3],
            created_at: edgeRow[4],
            properties,
          };
        })
      ).then(edges => edges.filter((edge): edge is GraphEdge => edge !== null));
    } catch (error) {
      console.error('Error in findEdges:', error);
      throw new Error(`Failed to find edges: ${error}`);
    }
  }
}
