import { BaseGraphDB } from "../core/BaseGraphDB";
import { DatabaseConfig, SQLiteEngine } from "../core/types";
import { DatabaseError } from "../core/errors";
import sqliteService from "../../sqliteService";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";

export class SQLiteGraphDB extends BaseGraphDB {
  private dbName: string = "graph_database";
  private dbVersion: number = 1;
  private connection: SQLiteDBConnection | null = null;

  protected async createEngine(config: DatabaseConfig): Promise<SQLiteEngine> {
    try {
      this.dbName = config.dbName || this.dbName;
      this.dbVersion = config.version || this.dbVersion;

      // 初始化WebStore (仅针对Web平台)
      if (sqliteService.getPlatform() === "web") {
        await sqliteService.initWebStore();
      }

      // 打开数据库连接
      this.connection = await sqliteService.openDatabase(
        this.dbName,
        this.dbVersion,
        false
      );

      // 返回SQLite引擎接口
      return {
        query: async (sql: string, params?: any[]): Promise<{ values?: any[] }> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          return await this.connection.query(sql, params, false);
        },
        run: async (sql: string, params?: any[]): Promise<void> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          await this.connection.run(sql, params, false);
        },
        isOpen: (): boolean => {
          return !!this.connection;
        },
        open: async (): Promise<void> => {
          if (this.connection) {
            await this.connection.open();
          }
        },
        close: async (): Promise<void> => {
          if (this.connection) {
            await sqliteService.closeDatabase(this.dbName, false);
            this.connection = null;
          }
        },
        beginTransaction: async (): Promise<void> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          await this.connection.beginTransaction();
        },
        commitTransaction: async (): Promise<void> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          await this.connection.commitTransaction();
        },
        rollbackTransaction: async (): Promise<void> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          await this.connection.rollbackTransaction();
        },
        export: (): Uint8Array => {
          // 返回一个空的Uint8Array作为占位符
          // 真正的导出功能需要在具体平台实现
          return new Uint8Array(0);
        },
        transaction: async <T>(operation: () => T | Promise<T>): Promise<T> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          
          // 使用Capacitor SQLite的自带事务机制
          return sqliteService.transaction(this.dbName, async () => {
            try {
              // 执行传入的操作
              return await operation();
            } catch (error) {
              // 重新抛出错误，确保错误能够被上层捕获
              throw error;
            }
          });
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to create SQLite engine: ${error}`,
        error as Error
      );
    }
  }

  protected async persistData(): Promise<void> {
    try {
      if (sqliteService.getPlatform() === "web") {
        await sqliteService.saveToStore(this.dbName);
      } else {
        await sqliteService.saveToLocalDisk(this.dbName);
      }
    } catch (error) {
      throw new DatabaseError(
        `Failed to persist data: ${error}`,
        error as Error
      );
    }
  }

  async createBackup(): Promise<string> {
    // 由于Capacitor SQLite不直接支持备份，我们使用导出/导入功能
    try {
      const backupId = `backup_${Date.now()}`;
      
      // 在web平台上，我们只能保存到IndexedDB
      if (sqliteService.getPlatform() === "web") {
        await sqliteService.saveToStore(this.dbName);
      } else {
        await sqliteService.saveToLocalDisk(this.dbName);
      }
      
      return backupId;
    } catch (error) {
      throw new DatabaseError(
        `Failed to create backup: ${error}`,
        error as Error
      );
    }
  }

  async restoreFromBackup(_backupId: string): Promise<void> {
    // 恢复备份需要具体平台的实现
    throw new DatabaseError("Restore from backup not implemented for this platform");
  }

  async listBackups(): Promise<string[]> {
    // 列出备份需要具体平台的实现
    throw new DatabaseError("List backups not implemented for this platform");
  }

  async importData(_data: Uint8Array): Promise<void> {
    throw new DatabaseError("Import data not implemented for this platform");
  }
} 