import { v4 as uuidv4 } from "uuid";
import {
  GraphNode,
  GraphEdge,
  GraphDatabaseInterface,
  DatabaseConfig,
  SQLiteEngine,
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
      for (const [key, value] of Object.entries(node.properties)) {
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

  async deleteNode(id: string): Promise<void> {
    return this.withTransaction(async () => {
      this.db!.run("DELETE FROM nodes WHERE id = ?", [id]);
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

      for (const [key, value] of Object.entries(edge.properties)) {
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
}
