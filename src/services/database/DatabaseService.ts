import { WebGraphDB } from "./platforms/WebGraphDB";
import { DesktopGraphDB } from "./platforms/DesktopGraphDB";
import { GraphDatabaseInterface, DatabaseConfig } from "./core/types";

export type Platform = "web" | "desktop";

export class DatabaseService {
  private static instance: DatabaseService;
  private db: GraphDatabaseInterface;
  private platform: Platform;

  private constructor(platform?: Platform) {
    // 如果指定了平台，使用指定的平台，否则自动检测
    this.platform = platform || this.detectPlatform();
    this.db = DatabaseService.createDatabase(this.platform);
  }

  private detectPlatform(): Platform {
    return typeof window !== "undefined" && window.electronAPI ? "desktop" : "web";
  }

  /**
   * 创建指定平台的数据库实例
   */
  private static createDatabase(platform: Platform): GraphDatabaseInterface {
    switch (platform) {
      case "web":
        return new WebGraphDB();
      case "desktop":
        return new DesktopGraphDB();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * 获取单例实例，可以指定平台
   */
  static getInstance(platform?: Platform): DatabaseService {
    if (!DatabaseService.instance || platform) {
      DatabaseService.instance = new DatabaseService(platform);
    }
    return DatabaseService.instance;
  }

  /**
   * 创建新的数据库服务实例（非单例模式）
   */
  static createInstance(platform: Platform): DatabaseService {
    return new DatabaseService(platform);
  }

  async initialize(config?: DatabaseConfig): Promise<void> {
    const defaultConfig: DatabaseConfig = {
      verbose: process.env.NODE_ENV === "development",
    };

    await this.db.initialize({
      ...defaultConfig,
      ...config,
    });
  }

  getDatabase(): GraphDatabaseInterface {
    return this.db;
  }

  getPlatform(): Platform {
    return this.platform;
  }

  /**
   * 切换到新的平台
   */
  async switchPlatform(platform: Platform, config?: DatabaseConfig): Promise<void> {
    // 如果平台相同，不做任何操作
    if (platform === this.platform) {
      return;
    }

    // 关闭当前数据库连接
    if (this.db) {
      await this.db.close();
    }

    // 创建新平台的数据库实例
    this.platform = platform;
    this.db = DatabaseService.createDatabase(platform);

    // 初始化新的数据库实例
    await this.initialize(config);
  }
}

// 默认导出的实例使用自动检测平台
export const databaseService = DatabaseService.getInstance();
