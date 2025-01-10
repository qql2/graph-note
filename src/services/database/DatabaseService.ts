import { WebGraphDB } from "./platforms/WebGraphDB";
import { DesktopGraphDB } from "./platforms/DesktopGraphDB";
import { GraphDatabaseInterface, DatabaseConfig } from "./core/types";
import path from "path";
import { app } from "electron";

export class DatabaseService {
  private static instance: DatabaseService;
  private db: GraphDatabaseInterface;
  private platform: "web" | "desktop";

  private constructor() {
    // 检测运行平台
    this.platform =
      typeof window !== "undefined" && !window.electron ? "web" : "desktop";

    // 根据平台选择数据库实现
    if (this.platform === "web") {
      this.db = new WebGraphDB();
    } else {
      this.db = new DesktopGraphDB();
    }
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    const config: DatabaseConfig = {
      platform: this.platform,
    };

    if (this.platform === "web") {
      config.wasm_path = "./sql-wasm.wasm";
    } else {
      // 在桌面端使用应用数据目录
      const userDataPath = app.getPath("userData");
      config.storage_path = path.join(userDataPath, "graph-note.db");
    }

    await this.db.initialize(config);
  }

  getDatabase(): GraphDatabaseInterface {
    return this.db;
  }

  getPlatform(): "web" | "desktop" {
    return this.platform;
  }
}

export const databaseService = DatabaseService.getInstance();
