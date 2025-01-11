import { ipcRenderer } from "electron";
import { BaseGraphDB } from "../core/BaseGraphDB";
import { DatabaseError } from "../core/errors";
import type { DatabaseConfig, SQLiteEngine } from "../core/types";

export class DesktopGraphDB extends BaseGraphDB {
  constructor() {
    super();
  }

  protected async createEngine(config: DatabaseConfig): Promise<SQLiteEngine> {
    // 在桌面端，我们不需要真正的SQLite引擎实例
    // 因为所有操作都通过IPC转发到主进程
    return {
      exec: async (sql: string, params?: any[]) => {
        return await ipcRenderer.invoke("db:query", sql, params);
      },
      prepare: () => {
        throw new Error("Not implemented in renderer process");
      },
      run: async (sql: string, params?: any[]) => {
        await ipcRenderer.invoke("db:query", sql, params);
      },
      isOpen: () => true,
      close: async () => {
        await ipcRenderer.invoke("db:close");
      },
      export: () => {
        throw new Error("Not implemented in renderer process");
      },
      transaction: async (operation: () => any) => {
        return await ipcRenderer.invoke("db:transaction", [operation]);
      },
    };
  }

  protected async persistData(): Promise<void> {
    // 在桌面端，数据持久化由主进程处理
    return Promise.resolve();
  }

  public async createBackup(): Promise<string> {
    try {
      return await ipcRenderer.invoke("db:backup");
    } catch (error) {
      throw new DatabaseError("Backup failed", error as Error);
    }
  }

  public async restoreFromBackup(backupId: string): Promise<void> {
    try {
      await ipcRenderer.invoke("db:restore", backupId);
    } catch (error) {
      throw new DatabaseError("Restore failed", error as Error);
    }
  }

  public async listBackups(): Promise<string[]> {
    try {
      return await ipcRenderer.invoke("db:listBackups");
    } catch (error) {
      throw new DatabaseError("Failed to list backups", error as Error);
    }
  }
}
