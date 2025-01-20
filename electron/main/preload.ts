import { contextBridge, ipcRenderer } from "electron";
import { DatabaseAPI, ElectronAPI } from "../../src/services/database/core/types";

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
  reload: () =>
    ipcRenderer.invoke("database:reload"),
  initialize: () =>
    ipcRenderer.invoke("database:initialize"),
  isReady: () =>
    ipcRenderer.invoke("database:isReady"),
};

// 完整的 API 实现
const api: ElectronAPI = {
  database: databaseAPI,
};

// 使用 contextBridge 暴露 API 到渲染进程
contextBridge.exposeInMainWorld("electronAPI", api);

// 为 TypeScript 添加类型声明
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 