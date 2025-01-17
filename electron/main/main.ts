import { app, BrowserWindow } from "electron";
import path from "path";
import { MainDatabaseService } from "./database/MainDatabaseService";
import { setupDatabaseIPC } from "./database/ipc";
import { AppServer } from "./server";

interface MainWindow extends BrowserWindow {
  // 添加任何特定于应用的窗口属性
}

class MainProcess {
  private mainWindow: MainWindow | null = null;
  private dbService: MainDatabaseService | null = null;
  private server: AppServer | null = null;

  constructor() {
    this.setupAppEvents();
  }

  private setupAppEvents() {
    app.whenReady().then(() => this.createWindow());

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", () => {
      if (!this.mainWindow) {
        this.createWindow();
      }
    });

    app.on("before-quit", () => {
      this.cleanup();
    });
  }

  private async createWindow() {
    try {
      await this.initializeServices();
      await this.createMainWindow();
      await this.loadApplication();
    } catch (error) {
      console.error("Failed to initialize app:", error);
      app.quit();
    }
  }

  private async initializeServices() {
    // 启动 Koa 服务器
    this.server = new AppServer();
    await this.server.start(3000);

    // 初始化数据库服务
    this.dbService = new MainDatabaseService();
    setupDatabaseIPC(this.dbService);
  }

  private async createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, "preload.js"),
        sandbox: true,
      },
    }) as MainWindow;
  }

  private async loadApplication() {
    if (!this.mainWindow) return;

    if (process.env.NODE_ENV === "development") {
      await this.mainWindow.loadURL("http://localhost:5173");
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadURL("http://localhost:3000");
    }
  }

  private cleanup() {
    // 清理数据库连接
    if (this.dbService) {
      this.dbService.close();
      this.dbService = null;
    }

    // 清理服务器
    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    // 清理窗口
    if (this.mainWindow) {
      this.mainWindow.close();
      this.mainWindow = null;
    }
  }
}

// 启动应用
new MainProcess();
