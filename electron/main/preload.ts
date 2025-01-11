import { contextBridge, ipcRenderer } from "electron";

// 数据库 API 类型定义
interface DatabaseAPI {
  query: (sql: string, params?: any[]) => Promise<any>;
  backup: () => Promise<string>;
  restore: (backupPath: string) => Promise<void>;
  listBackups: () => Promise<string[]>;
}

// 完整的 API 类型定义
interface ElectronAPI {
  database: DatabaseAPI;
}

// 数据库操作接口实现
const databaseAPI: DatabaseAPI = {
  query: (sql: string, params: any[] = []) =>
    ipcRenderer.invoke("database:query", sql, params),
  backup: () => 
    ipcRenderer.invoke("database:backup"),
  restore: (backupPath: string) =>
    ipcRenderer.invoke("database:restore", backupPath),
  listBackups: () => 
    ipcRenderer.invoke("database:listBackups"),
};

// 完整的 API 实现
const api: ElectronAPI = {
  database: databaseAPI,
};

// 使用 contextBridge 暴露 API 到渲染进程
// 这样可以在渲染进程中通过 window.electronAPI 访问
contextBridge.exposeInMainWorld("electronAPI", api);

// 为 TypeScript 添加类型声明
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 