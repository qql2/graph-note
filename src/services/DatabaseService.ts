import initSqlJs, { Database } from "sql.js";
import { v4 as uuidv4 } from "uuid";

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  properties: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: Record<string, any>;
  created_at: string;
}

export class DatabaseService {
  private db: Database | null = null;
  private static instance: DatabaseService;
  private initialized = false;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `/sql-wasm.wasm`,
      });

      // 尝试从localStorage恢复数据
      const savedData = localStorage.getItem("graphDb");
      if (savedData) {
        try {
          const binaryArray = new Uint8Array(savedData.split(",").map(Number));
          this.db = new SQL.Database(binaryArray);
          console.log("Database restored from localStorage");
        } catch (error) {
          console.error("Error restoring database from localStorage:", error);
          // 如果恢复失败，创建新的数据库
          this.db = new SQL.Database();
          await this.createTables();
        }
      } else {
        // 如果没有保存的数据，创建新的数据库
        this.db = new SQL.Database();
        await this.createTables();
      }

      // 验证数据库结构
      await this.validateDatabaseStructure();

      this.initialized = true;
      console.log("Database initialization completed");
    } catch (error) {
      console.error("Database initialization error:", error);
      throw error;
    }
  }

  private async validateDatabaseStructure(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      // 检查必要的表是否存在
      const tables = this.db.exec(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('nodes', 'node_properties', 'relationships', 'relationship_properties')
      `)[0];

      const existingTables = tables ? tables.values.map((row) => row[0]) : [];
      const requiredTables = [
        "nodes",
        "node_properties",
        "relationships",
        "relationship_properties",
      ];
      const missingTables = requiredTables.filter(
        (table) => !existingTables.includes(table)
      );

      if (missingTables.length > 0) {
        console.log("Missing tables detected:", missingTables);
        await this.createTables();
      }

      // 检查索引
      const indexes = this.db.exec(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `)[0];

      const existingIndexes = indexes
        ? indexes.values.map((row) => row[0])
        : [];
      const requiredIndexes = [
        "idx_nodes_type",
        "idx_relationships_type",
        "idx_relationships_source",
        "idx_relationships_target",
      ];
      const missingIndexes = requiredIndexes.filter(
        (index) => !existingIndexes.includes(index)
      );

      if (missingIndexes.length > 0) {
        console.log("Missing indexes detected:", missingIndexes);
        await this.createIndexes();
      }
    } catch (error) {
      console.error("Error validating database structure:", error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const queries = [
      // 节点表
      `CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // 节点属性表
      `CREATE TABLE IF NOT EXISTS node_properties (
        node_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        PRIMARY KEY (node_id, key)
      )`,

      // 关系表
      `CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
      )`,

      // 关系属性表
      `CREATE TABLE IF NOT EXISTS relationship_properties (
        relationship_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
        PRIMARY KEY (relationship_id, key)
      )`,
    ];

    try {
      this.db.run("BEGIN TRANSACTION");
      for (const query of queries) {
        this.db.run(query);
      }
      this.db.run("COMMIT");
      await this.createIndexes();
      this.saveToLocalStorage();
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id)`,
    ];

    try {
      this.db.run("BEGIN TRANSACTION");
      for (const index of indexes) {
        this.db.run(index);
      }
      this.db.run("COMMIT");
      this.saveToLocalStorage();
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  private saveToLocalStorage(): void {
    if (!this.db) return;
    try {
      const binaryArray = this.db.export();
      localStorage.setItem("graphDb", binaryArray.toString());
      console.log("Database saved to localStorage");
      this.getNodes().then((nodes) => {
        console.log("Saved Nodes:", nodes);
      });
      this.getEdges().then((edges) => {
        console.log("Saved Edges:", edges);
      });
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      // 如果存储空间不足，尝试清理
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        this.handleStorageQuotaExceeded();
      }
    }
  }

  private handleStorageQuotaExceeded(): void {
    try {
      // 尝试清理旧数据
      const oldBackups = Object.keys(localStorage).filter((key) =>
        key.startsWith("graphDb_backup_")
      );

      // 按时间戳排序，保留最新的3个备份
      oldBackups
        .sort()
        .slice(0, -3)
        .forEach((key) => {
          localStorage.removeItem(key);
        });

      // 再次尝试保存
      if (this.db) {
        const binaryArray = this.db.export();
        localStorage.setItem("graphDb", binaryArray.toString());
      }
    } catch (error) {
      console.error("Failed to handle storage quota exceeded:", error);
    }
  }

  async addNode(
    node: Omit<GraphNode, "created_at" | "updated_at">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not initialized");

    const id = node.id || uuidv4();
    const now = new Date().toISOString();

    try {
      this.db.run("BEGIN TRANSACTION");

      // 插入节点基本信息
      this.db.run(
        `INSERT INTO nodes (id, type, label, x, y, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, node.type, node.label, node.x, node.y, now, now]
      );

      // 插入节点属性
      for (const [key, value] of Object.entries(node.properties)) {
        this.db.run(
          `INSERT INTO node_properties (node_id, key, value)
           VALUES (?, ?, ?)`,
          [id, key, JSON.stringify(value)]
        );
      }

      this.db.run("COMMIT");
      this.saveToLocalStorage();
      return id;
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  async updateNode(id: string, updates: Partial<GraphNode>): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      this.db.run("BEGIN TRANSACTION");

      // 更新基本信息
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

          this.db.run(
            `UPDATE nodes SET ${sets.join(", ")} WHERE id = ?`,
            params
          );
        }
      }

      // 更新属性
      if (updates.properties) {
        // 删除旧属性
        this.db.run("DELETE FROM node_properties WHERE node_id = ?", [id]);

        // 插入新属性
        for (const [key, value] of Object.entries(updates.properties)) {
          this.db.run(
            `INSERT INTO node_properties (node_id, key, value)
             VALUES (?, ?, ?)`,
            [id, key, JSON.stringify(value)]
          );
        }
      }

      this.db.run("COMMIT");
      this.saveToLocalStorage();
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  async addEdge(edge: Omit<GraphEdge, "created_at">): Promise<string> {
    if (!this.db) throw new Error("Database not initialized");

    const id = edge.id || uuidv4();
    const now = new Date().toISOString();

    try {
      this.db.run("BEGIN TRANSACTION");

      // 插入关系基本信息
      this.db.run(
        `INSERT INTO relationships (id, source_id, target_id, type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, edge.source_id, edge.target_id, edge.type, now]
      );

      // 插入关系属性
      for (const [key, value] of Object.entries(edge.properties)) {
        this.db.run(
          `INSERT INTO relationship_properties (relationship_id, key, value)
           VALUES (?, ?, ?)`,
          [id, key, JSON.stringify(value)]
        );
      }

      this.db.run("COMMIT");
      this.saveToLocalStorage();
      return id;
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  async getNodes(): Promise<GraphNode[]> {
    if (!this.db) throw new Error("Database not initialized");

    const result = this.db.exec(`
      SELECT n.*, GROUP_CONCAT(json_object('key', np.key, 'value', np.value)) as props
      FROM nodes n
      LEFT JOIN node_properties np ON n.id = np.node_id
      GROUP BY n.id
    `)[0];

    if (!result) return [];

    return result.values.map((row: any) => {
      const props = row[7] ? JSON.parse(`[${row[7]}]`) : [];
      const properties: Record<string, any> = {};
      props.forEach((prop: any) => {
        properties[prop.key] = JSON.parse(prop.value);
      });

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

  async getEdges(): Promise<GraphEdge[]> {
    if (!this.db) throw new Error("Database not initialized");

    const result = this.db.exec(`
      SELECT r.*, GROUP_CONCAT(json_object('key', rp.key, 'value', rp.value)) as props
      FROM relationships r
      LEFT JOIN relationship_properties rp ON r.id = rp.relationship_id
      GROUP BY r.id
    `)[0];

    if (!result) return [];

    return result.values.map((row: any) => {
      const props = row[5] ? JSON.parse(`[${row[5]}]`) : [];
      const properties: Record<string, any> = {};
      props.forEach((prop: any) => {
        properties[prop.key] = JSON.parse(prop.value);
      });

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

  async deleteNode(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      this.db.run("BEGIN TRANSACTION");
      this.db.run("DELETE FROM nodes WHERE id = ?", [id]);
      this.db.run("COMMIT");
      this.saveToLocalStorage();
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  async deleteEdge(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      this.db.run("BEGIN TRANSACTION");
      this.db.run("DELETE FROM relationships WHERE id = ?", [id]);
      this.db.run("COMMIT");
      this.saveToLocalStorage();
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  // 高级查询方法
  async findPath(
    startId: string,
    endId: string,
    maxDepth: number = 5
  ): Promise<GraphEdge[]> {
    if (!this.db) throw new Error("Database not initialized");

    const result = this.db.exec(
      `
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
    `,
      [startId, maxDepth, endId]
    )[0];

    if (!result || !result.values[0][0]) return [];

    const path = JSON.parse(result.values[0][0] as string);
    return path.map((edge: any) => ({
      id: edge.id,
      source_id: edge.source,
      target_id: edge.target,
      type: "path",
      properties: {},
      created_at: new Date().toISOString(),
    }));
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

  // 数据导出
  async exportData(): Promise<Blob> {
    if (!this.db) throw new Error("Database not initialized");
    const binaryArray = this.db.export();
    return new Blob([binaryArray], { type: "application/x-sqlite3" });
  }

  // 数据导入
  async importData(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const SQL = await initSqlJs({
      locateFile: (file) => `/sql-wasm.wasm`,
    });
    this.db = new SQL.Database(uint8Array);
    this.saveToLocalStorage();
  }

  // 创建备份
  async createBackup(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupKey = `graphDb_backup_${timestamp}`;
      const binaryArray = this.db.export();
      localStorage.setItem(backupKey, binaryArray.toString());
      console.log("Backup created:", backupKey);
    } catch (error) {
      console.error("Error creating backup:", error);
      throw error;
    }
  }

  // 从备份恢复
  async restoreFromBackup(backupKey: string): Promise<void> {
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `/sql-wasm.wasm`,
      });

      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        throw new Error(`Backup not found: ${backupKey}`);
      }

      const binaryArray = new Uint8Array(backupData.split(",").map(Number));
      this.db = new SQL.Database(binaryArray);
      await this.validateDatabaseStructure();
      this.saveToLocalStorage();
      console.log("Database restored from backup:", backupKey);
    } catch (error) {
      console.error("Error restoring from backup:", error);
      throw error;
    }
  }

  // 列出所有备份
  listBackups(): string[] {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith("graphDb_backup_"))
      .sort()
      .reverse();
  }
}

export const databaseService = DatabaseService.getInstance();
