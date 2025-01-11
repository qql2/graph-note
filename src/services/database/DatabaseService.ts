import { WebGraphDB } from "./platforms/WebGraphDB";
import { DesktopGraphDB } from "./platforms/DesktopGraphDB";
import { GraphDatabaseInterface, DatabaseConfig } from "./core/types";

export class DatabaseService {
  private static instance: DatabaseService;
  private db: GraphDatabaseInterface;
  private platform: "web" | "desktop";

  private constructor() {
    // 检测运行平台
    this.platform = this.detectPlatform();

    // 根据平台选择数据库实现
    if (this.platform === "web") {
      this.db = new WebGraphDB();
    } else {
      this.db = new DesktopGraphDB();
    }
  }

  private detectPlatform(): "web" | "desktop" {
    return typeof window !== "undefined" && window.electronAPI ? "desktop" : "web";
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    const config: DatabaseConfig = {
      verbose: process.env.NODE_ENV === "development",
    };

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
