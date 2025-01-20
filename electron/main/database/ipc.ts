import { ipcMain } from "electron";
import { MainDatabaseService } from "./MainDatabaseService";

export function setupDatabaseIPC(dbService: MainDatabaseService) {
  // 数据库初始化
  ipcMain.handle("database:initialize", async () => {
    await dbService.initialize();
  });

  // 检查数据库是否就绪
  ipcMain.handle("database:isReady", () => {
    return dbService.isReady();
  });

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

  // 重新加载数据库
  ipcMain.handle("database:reload", async () => {
    await dbService.reload();
  });
}
