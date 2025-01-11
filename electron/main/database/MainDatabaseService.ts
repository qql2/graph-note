import { app } from "electron";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { DatabaseError } from "../../../src/services/database/core/errors";

export class MainDatabaseService {
  private db: Database.Database | null = null;
  private statements: Map<string, Database.Statement> = new Map();
  private dbPath: string;
  private backupDir: string;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.dbPath = path.join(userDataPath, "graph-note.db");
    this.backupDir = path.join(userDataPath, "backups");

    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this.initializeDatabase();
  }

  private initializeDatabase() {
    try {
      this.db = new Database(this.dbPath, {
        verbose:
          process.env.NODE_ENV === "development" ? console.log : undefined,
      });

      // Enable foreign keys
      this.db.pragma("foreign_keys = ON");

      // Create tables if not exists
      this.createTables();
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw new DatabaseError("Database initialization failed", error as Error);
    }
  }

  private createTables() {
    const schemas = [
      `CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                label TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`,
      `CREATE TABLE IF NOT EXISTS node_properties (
                node_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT,
                FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
                PRIMARY KEY (node_id, key)
            )`,
      `CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
                FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
            )`,
      `CREATE TABLE IF NOT EXISTS relationship_properties (
                relationship_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT,
                FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
                PRIMARY KEY (relationship_id, key)
            )`,
    ];

    for (const schema of schemas) {
      this.db?.exec(schema);
    }
  }

  public query(sql: string, params: any[] = []) {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }

    try {
      let stmt = this.statements.get(sql);
      if (!stmt) {
        stmt = this.db.prepare(sql);
        this.statements.set(sql, stmt);
      }

      if (sql.trim().toLowerCase().startsWith("select")) {
        return stmt.all(params);
      } else {
        return stmt.run(params);
      }
    } catch (error) {
      console.error("Database query error:", error);
      throw new DatabaseError("Query execution failed", error as Error);
    }
  }

  public transaction<T>(operations: (() => T)[]): T {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }

    const transaction = this.db.transaction((ops: (() => T)[]) => {
      return ops.map((op) => op());
    });

    try {
      return transaction(operations);
    } catch (error) {
      console.error("Transaction error:", error);
      throw new DatabaseError("Transaction failed", error as Error);
    }
  }

  public backup(): string {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(this.backupDir, `backup-${timestamp}.db`);

      this.db.backup(backupPath);
      return backupPath;
    } catch (error) {
      console.error("Backup error:", error);
      throw new DatabaseError("Backup failed", error as Error);
    }
  }

  public restore(backupPath: string): void {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }

    if (!fs.existsSync(backupPath)) {
      throw new DatabaseError(`Backup file not found: ${backupPath}`);
    }

    try {
      // 关闭当前数据库连接
      this.close();

      // 复制备份文件到当前数据库文件
      fs.copyFileSync(backupPath, this.dbPath);

      // 重新初始化数据库
      this.initializeDatabase();
    } catch (error) {
      console.error("Restore error:", error);
      throw new DatabaseError("Restore failed", error as Error);
    }
  }

  public listBackups(): string[] {
    try {
      return fs
        .readdirSync(this.backupDir)
        .filter((file) => file.startsWith("backup-") && file.endsWith(".db"))
        .map((file) => path.join(this.backupDir, file))
        .sort()
        .reverse(); // 最新的备份在前面
    } catch (error) {
      console.error("List backups error:", error);
      throw new DatabaseError("Failed to list backups", error as Error);
    }
  }

  public close() {
    if (this.db) {
      this.statements.clear();
      this.db.close();
      this.db = null;
    }
  }
}
