import { BaseGraphDB } from "../core/BaseGraphDB";
import { DatabaseConfig, SQLiteEngine } from "../core/types";
import { DatabaseError, TransactionError } from "../core/errors";
import sqliteService from "../../sqliteService";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { GraphUpgradeStatements, getLatestGraphDbVersion } from "../upgrades/graph.upgrade.statements";

export class SQLiteGraphDB extends BaseGraphDB {
  private dbName: string = "graph_database";
  private dbVersion: number = getLatestGraphDbVersion();
  private connection: SQLiteDBConnection | null = null;
  private transactionQueue: Promise<any> = Promise.resolve();
  private isInTransaction: boolean = false;

  // 添加实现抽象方法getEngine，修复linter错误
  protected async getEngine(): Promise<SQLiteEngine> {
    // 如果没有连接，抛出错误
    if (!this.connection) {
      throw new DatabaseError("Database connection not established");
    }

    // 返回当前引擎实例
    return {
      query: async (sql: string, params?: any[]): Promise<{ values?: any[] }> => {
        return await this.connection!.query(sql, params);
      },
      run: async (sql: string, params?: any[]): Promise<void> => {
        await this.connection!.run(sql, params, false);
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
        return new Uint8Array(0);
      },
      transaction: async <T>(operation: () => T | Promise<T>): Promise<T> => {
        return this.transaction(operation);
      },
    };
  }

  protected async createEngine(config: DatabaseConfig): Promise<SQLiteEngine> {
    try {
      this.dbName = config.dbName || this.dbName;
      this.dbVersion = getLatestGraphDbVersion();
      console.log(`SQLiteGraphDB: Setting DB version to ${this.dbVersion}`);

      // Initialize WebStore (only for Web platform)
      if (sqliteService.getPlatform() === "web") {
        await sqliteService.initWebStore();
      }

      // Add upgrade statements before opening the database
      await sqliteService.addUpgradeStatement({
        database: this.dbName,
        upgrade: GraphUpgradeStatements,
      });
      console.log(`SQLiteGraphDB: Added ${GraphUpgradeStatements.length} upgrade statements for ${this.dbName}.`);

      // Open database connection, allowing upgrades up to the specified version
      this.connection = await sqliteService.openDatabase(
        this.dbName,
        this.dbVersion,
        false
      );
      console.log(`SQLiteGraphDB: Database ${this.dbName} opened successfully at version ${this.dbVersion}.`);

      // 返回SQLite引擎接口
      return {
        query: async (
          sql: string,
          params?: any[]
        ): Promise<{ values?: any[] }> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          // 减少输出,只保留edges相关的日志
          if (sql.includes("relationships") || sql.includes("relationship_properties")) {
            ;
          }
          return await this.connection.query(sql, params);
        },
        run: async (sql: string, params?: any[]): Promise<void> => {
          if (!this.connection) {
            throw new Error("Database connection not established");
          }
          // 减少输出,只保留edges相关的日志
          if (sql.includes("relationships") || sql.includes("relationship_properties")) {
            ;
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
  // 注意：不要在事务操作中调用persistData()，因为它已经在这个方法的成功路径上自动调用了
  // 在事务中调用persistData()会导致"Transaction has been ended unexpectedly"错误
  async transaction<T>(operation: () => T | Promise<T>): Promise<T> {
    return (this.transactionQueue = this.transactionQueue.catch((error: any) => {
      return null;
    }).then(async () => {
      if (!this.connection) {
        console.error('[SQLiteGraphDB] 事务开始失败: 数据库连接未建立');
        throw new DatabaseError("Database connection not established");
      }

      
      let alreadyInTransaction = false;
      try {
        await this.connection.beginTransaction();
        this.isInTransaction = true;
        
      } catch (error:any) {
        if (error.message && /Already in transaction|cannot start a transaction within a transaction/i.test(error.message)) {
          alreadyInTransaction = true;
          
        } else {
          console.error(`[SQLiteGraphDB] 开始事务失败:`, error);
          throw error;
        }
      }

      // 如果已经在事务中，直接执行操作
      if (alreadyInTransaction) {
        
        return await operation();
      }

      try {
        // 检查事务是否真的开始了
        const transactionActive = await this.connection.isTransactionActive();
        if (transactionActive.result === false) {
          console.error(`[SQLiteGraphDB] 事务未成功激活`);
          throw new TransactionError("Failed to begin transaction");
        }
        

        let result;
        try {
          // 执行操作
          
          result = await operation();
          
        } catch (error) {
          // 如果执行失败，回滚事务
          console.error(`[SQLiteGraphDB] 操作执行失败，回滚事务:`, error);
          await this.connection.rollbackTransaction();
          this.isInTransaction = false;
          throw error;
        }

        // 提交事务
        try {
          
          await this.connection.commitTransaction();
          
        } catch (error: any) {
          if(error.message && error.message.includes('no transaction is active')){
            console.warn('[SQLiteGraphDB] 事务已意外结束，但操作已成功执行');
            // 尽管事务状态有问题，但操作已经执行成功，继续保存数据
          } else {
            console.error("[SQLiteGraphDB] 提交事务时出错:", error);
            // 只有在提交时出现非事务状态类错误时才抛出
            this.isInTransaction = false;
            throw error;
          }
        }
          
        this.isInTransaction = false;
        
        // 无论事务状态如何，都尝试保存数据
        // 注意：这是事务API自动调用的persistData，不应在operation函数中再次调用
        try {
          // TODO (AI切勿擅自修改) 未来将persistData移出事务API, 需要设计一个API, 为所有修改操作自动调用持久化
          
          await this.persistData();
          
        } catch (persistError) {
          console.error("[SQLiteGraphDB] 持久化数据失败:", persistError);
          // 保存数据失败不应该影响操作的结果
        }

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
      const platform = sqliteService.getPlatform();
      
      
      if (platform === "web") {
        
        await sqliteService.saveToStore(this.dbName);
        
      } else if (platform === "android") {

      } else {
        // electron 平台不用手动保存到本地磁盘
      }
    } catch (error) {
      console.error(`[SQLiteGraphDB] 保存数据失败: ${error}`);
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

  // 添加获取数据库状态的方法，用于调试
  async getDatabaseStatus(): Promise<any> {
    const platform = sqliteService.getPlatform();
    let transactionStatus = false;
    let connectionStatus = false;
    
    try {
      // 检查连接状态
      connectionStatus = !!this.connection;
      
      // 检查事务状态
      if (this.connection) {
        const result = await this.connection.isTransactionActive();
        transactionStatus = result.result as boolean;
      }
      
      return {
        platform,
        dbName: this.dbName,
        dbVersion: this.dbVersion,
        isConnected: connectionStatus,
        inTransaction: this.isInTransaction,
        actualTransactionActive: transactionStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[SQLiteGraphDB] 获取数据库状态失败:', error);
      return {
        platform,
        dbName: this.dbName,
        error: `获取状态失败: ${error}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 强制提交当前事务并保存数据，用于调试
  async forceCommitTransaction(): Promise<{ success: boolean, message: string }> {
    
    
    try {
      if (!this.connection) {
        const message = "数据库连接未建立，无法提交事务";
        console.error(`[SQLiteGraphDB] ${message}`);
        return { success: false, message };
      }
      
      // 检查事务状态
      const transactionActive = await this.connection.isTransactionActive();
      
      if (!transactionActive.result) {
        const message = "当前没有活跃的事务，尝试执行空事务";
        
        // 没有活跃事务，尝试开始一个简单事务并提交
        try {
          await this.connection.beginTransaction();
          // 执行一个简单查询
          await this.connection.query("SELECT 1");
          await this.connection.commitTransaction();
          
          // 尝试持久化数据
          await this.persistData();
          
          return { 
            success: true, 
            message: "成功执行并提交了一个空事务，并尝试持久化数据" 
          };
        } catch (error) {
          const errorMsg = `尝试执行空事务失败: ${error}`;
          console.error(`[SQLiteGraphDB] ${errorMsg}`);
          return { success: false, message: errorMsg };
        }
      }
      
      // 有活跃事务，尝试提交
      try {
        
        await this.connection.commitTransaction();
        
        
        // 重置事务状态
        this.isInTransaction = false;
        
        // 尝试持久化数据
        await this.persistData();
        
        return { 
          success: true, 
          message: "成功提交了活跃事务并持久化数据" 
        };
      } catch (error) {
        const errorMsg = `提交活跃事务失败: ${error}`;
        console.error(`[SQLiteGraphDB] ${errorMsg}`);
        
        // 尝试回滚事务
        try {
          await this.connection.rollbackTransaction();
          this.isInTransaction = false;
          return { 
            success: false, 
            message: `${errorMsg}，已回滚事务` 
          };
        } catch (rollbackError) {
          return { 
            success: false, 
            message: `${errorMsg}，且回滚也失败: ${rollbackError}` 
          };
        }
      }
    } catch (error) {
      const errorMsg = `强制提交事务时发生错误: ${error}`;
      console.error(`[SQLiteGraphDB] ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
  }
}
