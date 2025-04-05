import { BaseGraphDB } from "../core/BaseGraphDB";
import { DatabaseConfig, SQLiteEngine } from "../core/types";
import { DatabaseError, TransactionError } from "../core/errors";
import sqliteService from "../../sqliteService";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";

export class SQLiteGraphDB extends BaseGraphDB {
  private dbName: string = "graph_database";
  private dbVersion: number = 1;
  private connection: SQLiteDBConnection | null = null;
  private transactionQueue: Promise<any> = Promise.resolve();
  private isInTransaction: boolean = false;

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
        query: async (
          sql: string,
          params?: any[]
        ): Promise<{ values?: any[] }> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          console.log("query sql", sql, params);
          return await this.connection.query(sql, params);
        },
        run: async (sql: string, params?: any[]): Promise<void> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          console.log("run sql", sql, params);
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
          await this.beginTransaction();
        },
        commitTransaction: async (): Promise<void> => {
          await this.commitTransaction();
        },
        rollbackTransaction: async (): Promise<void> => {
          await this.rollbackTransaction();
        },
        export: (): Uint8Array => {
          // 返回一个空的Uint8Array作为占位符
          // 真正的导出功能需要在具体平台实现
          return new Uint8Array(0);
        },
        transaction: async <T>(operation: () => T | Promise<T>): Promise<T> => {
          return this.transaction(operation);
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to create SQLite engine: ${error}`,
        error as Error
      );
    }
  }

  // 改进的事务处理方法
  async beginTransaction(): Promise<void> {
    if (!this.connection) {
      throw new DatabaseError("Database connection not established");
    }

    if (this.isInTransaction) {
      throw new TransactionError("Transaction already started");
    }

    try {
      await this.connection.beginTransaction();
      this.isInTransaction = true;
    } catch (error) {
      throw new TransactionError("Failed to begin transaction", error as Error);
    }
  }

  async commitTransaction(): Promise<void> {
    if (!this.connection) {
      throw new DatabaseError("Database connection not established");
    }

    if (!this.isInTransaction) {
      throw new TransactionError("No transaction in progress");
    }

    try {
      await this.connection.commitTransaction();
      this.isInTransaction = false;
      await this.persistData();
    } catch (error) {
      throw new TransactionError(
        "Failed to commit transaction",
        error as Error
      );
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.connection) {
      throw new DatabaseError("Database connection not established");
    }

    if (!this.isInTransaction) {
      throw new TransactionError("No transaction in progress");
    }

    try {
      await this.connection.rollbackTransaction();
      this.isInTransaction = false;
    } catch (error) {
      throw new TransactionError(
        "Failed to rollback transaction",
        error as Error
      );
    }
  }

  // 优化的事务执行方法，使用队列确保事务按顺序执行
  async transaction<T>(operation: () => T | Promise<T>): Promise<T> {
    return (this.transactionQueue = this.transactionQueue.then(async () => {
      if (!this.connection) {
        throw new DatabaseError("Database connection not established");
      }

      // 如果已经在事务中，直接执行操作
      if (this.isInTransaction) {
        return await operation();
      }

      try {
        // 开始事务
        await this.connection.beginTransaction();
        this.isInTransaction = true;

        // 检查事务是否真的开始了
        const transactionActive = await this.connection.isTransactionActive();
        if (transactionActive.result === false) {
          throw new TransactionError("Failed to begin transaction");
        }

        let result;
        try {
          // 执行操作
          result = await operation();
        } catch (error) {
          // 如果执行失败，回滚事务
          await this.connection.rollbackTransaction();
          this.isInTransaction = false;
          throw error;
        }

        // 提交事务
        try {
          await this.connection.commitTransaction();
        } catch (error: any) {
          if(error.message.includes('no transaction is active')){
            console.warn('Transaction has been ended unexpectedly');
          } else {
            throw error;
          }
        }
          
        this.isInTransaction = false;
        await this.persistData();

        return result;
      } catch (error: any) {
        this.isInTransaction = false;
        const msg = error.message ? error.message : error;
        throw new DatabaseError(`Transaction failed: ${msg}`, error);
      }
    }));
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
    throw new DatabaseError(
      "Restore from backup not implemented for this platform"
    );
  }

  async listBackups(): Promise<string[]> {
    // 列出备份需要具体平台的实现
    throw new DatabaseError("List backups not implemented for this platform");
  }

  async importData(_data: Uint8Array): Promise<void> {
    throw new DatabaseError("Import data not implemented for this platform");
  }

  // 重写inTransaction属性，让BaseGraphDB可以获取当前事务状态
  protected override get inTransaction(): boolean {
    return this.isInTransaction;
  }
}
