import { ipcMain } from "electron";
import { MainDatabaseService } from "./MainDatabaseService";

export function setupDatabaseIPC(dbService: MainDatabaseService) {
  // 数据库查询
  ipcMain.handle("database:query", async (_, sql: string, params: any[] = []) => {
    return await dbService.query(sql, params);
  });

  // 数据库备份
  ipcMain.handle("database:backup", async () => {
    return await dbService.backup();
  });

  // 从备份恢复
  ipcMain.handle("database:restore", async (_, backupPath: string) => {
    await dbService.restore(backupPath);
  });

  // 列出所有备份
  ipcMain.handle("database:listBackups", async () => {
    return await dbService.listBackups();
  });
}
