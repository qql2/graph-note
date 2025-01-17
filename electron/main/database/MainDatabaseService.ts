import { app } from "electron";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { DatabaseError } from "../../../src/services/database/core/errors";

export class MainDatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;
  private backupDir: string;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.dbPath = path.join(userDataPath, "graph-note.db");
    this.backupDir = path.join(userDataPath, "backups");

    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // 启动自动保存
    this.startAutoSave();
  }

  private startAutoSave() {
    // 每5分钟自动保存一次
    this.autoSaveInterval = setInterval(() => {
      Promise.resolve().then(() => this.backup()).catch((error: Error) => {
        console.error("Auto backup failed:", error);
      });
    }, 5 * 60 * 1000);
  }

  public query(sql: string, params: any[] = []) {
    if (!this.db) {
      this.db = new Database(this.dbPath);
    }

    try {
      if (sql.trim().toLowerCase().startsWith("select")) {
        return this.db.prepare(sql).all(params);
      } else {
        const result = this.db.prepare(sql).run(params);
        // 对于修改操作，触发保存
        if (!sql.trim().toLowerCase().startsWith("begin") && 
            !sql.trim().toLowerCase().startsWith("commit") && 
            !sql.trim().toLowerCase().startsWith("rollback")) {
          this.save();
        }
        return result;
      }
    } catch (error) {
      console.error("Database query error:", error);
      throw new DatabaseError("Query execution failed", error as Error);
    }
  }

  private save() {
    if (!this.db) return;
    
    try {
      // 强制写入所有待处理的更改
      this.db.pragma('wal_checkpoint(RESTART)');
    } catch (error) {
      console.error("Save error:", error);
      throw new DatabaseError("Save failed", error as Error);
    }
  }

  public backup(): string {
    if (!this.db) {
      this.db = new Database(this.dbPath);
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
    if (!fs.existsSync(backupPath)) {
      throw new DatabaseError("Backup file not found");
    }

    try {
      // 关闭当前数据库连接
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // 复制备份文件到主数据库文件
      fs.copyFileSync(backupPath, this.dbPath);

      // 重新打开数据库
      this.db = new Database(this.dbPath);
    } catch (error) {
      console.error("Restore error:", error);
      throw new DatabaseError("Restore failed", error as Error);
    }
  }

  public listBackups(): string[] {
    try {
      return fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith("backup-"))
        .map(file => path.join(this.backupDir, file))
        .sort()
        .reverse();
    } catch (error) {
      console.error("List backups error:", error);
      throw new DatabaseError("Failed to list backups", error as Error);
    }
  }

  public close() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
