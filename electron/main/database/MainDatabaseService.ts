import { app } from "electron";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { DatabaseError } from "../../../src/services/database/core/errors";

export class MainDatabaseService {
  private db: Database.Database | null = null;
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
  }

  public query(sql: string, params: any[] = []) {
    if (!this.db) {
      this.db = new Database(this.dbPath);
    }

    try {
      if (sql.trim().toLowerCase().startsWith("select")) {
        return this.db.prepare(sql).all(params);
      } else {
        return this.db.prepare(sql).run(params);
      }
    } catch (error) {
      console.error("Database query error:", error);
      throw new DatabaseError("Query execution failed", error as Error);
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
      throw new DatabaseError(`Backup file not found: ${backupPath}`);
    }

    try {
      this.close();
      fs.copyFileSync(backupPath, this.dbPath);
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
      this.db.close();
      this.db = null;
    }
  }
}
