import initSqlJs, { Database } from "sql.js";
import { BaseGraphDB } from "../core/BaseGraphDB";
import { DatabaseConfig, SQLiteEngine, GraphEdge } from "../core/types";

class WebSQLiteEngine implements SQLiteEngine {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  exec(sql: string, params?: any[]): any {
    return this.db.exec(sql, params);
  }

  prepare(sql: string): any {
    return this.db.prepare(sql);
  }

  run(sql: string, params?: any[]): void {
    this.db.run(sql, params);
  }

  isOpen(): boolean {
    return true; // sql.js数据库总是打开的
  }

  close(): void {
    this.db.close();
  }

  export(): Uint8Array {
    return this.db.export();
  }

  async transaction<T>(operation: () => T | Promise<T>): Promise<T> {
    try {
      this.run("BEGIN TRANSACTION");
      const result = await operation();
      this.run("COMMIT");
      return result;
    } catch (error) {
      this.run("ROLLBACK");
      throw error;
    }
  }
}

export class WebGraphDB extends BaseGraphDB {
  protected async createEngine(config: DatabaseConfig): Promise<SQLiteEngine> {
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => config.wasm_path || `/sql-wasm.wasm`,
      });

      // 尝试从localStorage恢复数据
      const savedData = localStorage.getItem("graphDb");
      let db: Database;

      if (savedData) {
        try {
          const binaryArray = new Uint8Array(savedData.split(",").map(Number));
          db = new SQL.Database(binaryArray);
          console.log("Database restored from localStorage");
        } catch (error) {
          console.error("Error restoring database from localStorage:", error);
          db = new SQL.Database();
        }
      } else {
        db = new SQL.Database();
      }

      return new WebSQLiteEngine(db);
    } catch (error) {
      console.error("Error creating SQLite engine:", error);
      throw error;
    }
  }

  protected async persistData(): Promise<void> {
    if (!this.db) return;

    try {
      const binaryArray = this.db.export();
      localStorage.setItem("graphDb", binaryArray.toString());
      console.log("Database saved to localStorage");
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        await this.handleStorageQuotaExceeded();
      }
    }
  }

  private async handleStorageQuotaExceeded(): Promise<void> {
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
      throw error;
    }
  }

  async createBackup(): Promise<string> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupId = `graphDb_backup_${timestamp}`;
      const binaryArray = this.db.export();
      localStorage.setItem(backupId, binaryArray.toString());
      console.log("Backup created:", backupId);
      return backupId;
    } catch (error) {
      console.error("Error creating backup:", error);
      throw error;
    }
  }

  async restoreFromBackup(backupId: string): Promise<void> {
    try {
      const backupData = localStorage.getItem(backupId);
      if (!backupData) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const SQL = await initSqlJs({
        locateFile: (file) => this.config?.wasm_path || `/sql-wasm.wasm`,
      });

      const binaryArray = new Uint8Array(backupData.split(",").map(Number));
      const db = new SQL.Database(binaryArray);
      this.db = new WebSQLiteEngine(db);
      await this.setupDatabase();
      await this.persistData();
      console.log("Database restored from backup:", backupId);
    } catch (error) {
      console.error("Error restoring from backup:", error);
      throw error;
    }
  }

  listBackups(): Promise<string[]> {
    const backups: string[] = [];
    console.log("localStorage length:", localStorage.length);
    for (let i = 0; i < localStorage.length; i++) {
      console.log(localStorage.key(i));
      const key = localStorage.key(i);
      if (key && key.startsWith("graphDb_backup_")) {
        backups.push(key);
      }
    }
    return Promise.resolve(backups.sort().reverse());
  }

  async updateEdge(id: string, updates: Partial<GraphEdge>): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return this.db.transaction(async () => {
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
}
