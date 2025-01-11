import { ipcMain } from "electron";
import { MainDatabaseService } from "./MainDatabaseService";

export function setupDatabaseIPC(dbService: MainDatabaseService) {
  // 基础查询
  ipcMain.handle("db:query", async (_, sql: string, params: any[]) => {
    return dbService.query(sql, params);
  });

  // 事务处理
  ipcMain.handle("db:transaction", async (_, operations: (() => any)[]) => {
    return dbService.transaction(operations);
  });

  // 备份数据库
  ipcMain.handle("db:backup", async () => {
    return dbService.backup();
  });

  // 从备份恢复
  ipcMain.handle("db:restore", async (_, backupPath: string) => {
    return dbService.restore(backupPath);
  });

  // 列出所有备份
  ipcMain.handle("db:listBackups", async () => {
    return dbService.listBackups();
  });

  // 关闭数据库连接
  ipcMain.handle("db:close", async () => {
    dbService.close();
  });
}
