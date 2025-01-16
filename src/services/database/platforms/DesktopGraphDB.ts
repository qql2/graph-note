import { BaseGraphDB } from "../core/BaseGraphDB";
import { DatabaseError } from "../core/errors";
import type { DatabaseConfig, SQLiteEngine } from "../core/types";

// 声明全局 electronAPI 类型
declare global {
  interface Window {
    electronAPI: {
      database: {
        query: (sql: string, params?: any[]) => Promise<any>;
       backup: () => Promise<string>;
        restore: (backupPath: string) => Promise<void>;
        listBackups: () => Promise<string[]>;
      };
    };
  }
}

export class DesktopGraphDB extends BaseGraphDB {
  constructor() {
    super();
  }

  protected async createEngine(config: DatabaseConfig): Promise<SQLiteEngine> {
    // 在桌面端，我们不需要真正的SQLite引擎实例
    // 因为所有操作都通过IPC转发到主进程
    return {
      exec: async (sql: string, params?: any[]) => {
        return await window.electronAPI.database.query(sql, params);
      },
      prepare: () => {
        throw new Error("Not implemented in renderer process");
      },
      run: async (sql: string, params?: any[]) => {
        await window.electronAPI.database.query(sql, params);
      },
      isOpen: () => true,
      close: async () => {
        // 关闭操作由主进程管理
        return Promise.resolve();
      },
      export: () => {
        throw new Error("Not implemented in renderer process");
      },
      transaction: async (operation: () => any) => {
        try {
          await window.electronAPI.database.query("BEGIN");
          const result = await operation();
          await window.electronAPI.database.query("COMMIT");
          return result;
        } catch (error) {
          await window.electronAPI.database.query("ROLLBACK");
          throw error;
        }
      },
    };
  }

  protected async persistData(): Promise<void> {
    // 在桌面端，数据持久化由主进程处理
    return Promise.resolve();
  }

  public async createBackup(): Promise<string> {
    try {
      return await window.electronAPI.database.backup();
    } catch (error) {
      throw new DatabaseError("Backup failed", error as Error);
    }
  }

  public async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      await window.electronAPI.database.restore(backupPath);
    } catch (error) {
      throw new DatabaseError("Restore failed", error as Error);
    }
  }

  public async listBackups(): Promise<string[]> {
    try {
      return await window.electronAPI.database.listBackups();
    } catch (error) {
      throw new DatabaseError("Failed to list backups", error as Error);
    }
  }
}
