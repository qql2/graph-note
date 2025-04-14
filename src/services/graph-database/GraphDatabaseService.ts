import { SQLiteGraphDB } from "./platforms/SQLiteGraphDB";
import { GraphDatabaseInterface, DatabaseConfig } from "./core/types";

class GraphDatabaseService {
  private static instance: GraphDatabaseService;
  private db: GraphDatabaseInterface;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private dbName: string = "graph_database";
  // 增加引用计数，以防止数据库被过早关闭
  private referenceCount: number = 0;
  // 增加指示关闭操作是否正在进行中的标志
  private closingInProgress: boolean = false;
  // 跟踪当前请求数据库访问的组件
  private accessingComponents: Set<string> = new Set();

  private constructor() {
    this.db = new SQLiteGraphDB();
  }

  static getInstance(): GraphDatabaseService {
    if (!GraphDatabaseService.instance) {
      GraphDatabaseService.instance = new GraphDatabaseService();
    }
    return GraphDatabaseService.instance;
  }

  // 注册组件对数据库的使用
  registerComponent(componentName: string): void {
    this.accessingComponents.add(componentName);
    this.referenceCount++;
    console.log(`组件 [${componentName}] 注册数据库使用, 当前引用计数: ${this.referenceCount}`);
  }

  // 注销组件对数据库的使用
  unregisterComponent(componentName: string): void {
    if (this.accessingComponents.has(componentName)) {
      this.accessingComponents.delete(componentName);
      if (this.referenceCount > 0) {
        this.referenceCount--;
      }
      console.log(`组件 [${componentName}] 注销数据库使用, 当前引用计数: ${this.referenceCount}`);
    }
  }

  async initialize(config?: DatabaseConfig, componentName: string = "unknown"): Promise<void> {
    // 注册组件访问
    this.registerComponent(componentName);
    
    // 如果数据库已经初始化，且使用相同的数据库名称，直接返回
    const newDbName = config?.dbName || "graph_database";
    if (this.initialized && this.dbName === newDbName) {
      console.log(`组件 [${componentName}] 使用已初始化的数据库 ${this.dbName}`);
      return;
    }
    
    // 如果已经有一个初始化过程在进行中，等待它完成
    if (this.initializationPromise) {
      try {
        console.log(`组件 [${componentName}] 等待已有的数据库初始化完成...`);
        await this.initializationPromise;
        
        // 如果数据库名称与当前不同，需要重新初始化
        if (this.initialized && this.dbName !== newDbName) {
          console.log(`数据库名称不同 (${this.dbName} -> ${newDbName})，正在重新初始化...`);
          await this._doCloseDatabase();
          return this.initialize(config, componentName);
        }
        
        // 如果初始化成功且使用相同的数据库名称，直接返回
        if (this.initialized) {
          console.log(`组件 [${componentName}] 使用已初始化的数据库 ${this.dbName}`);
          return;
        }
      } catch (error) {
        // 之前的初始化失败，尝试关闭并重新初始化
        console.warn(`组件 [${componentName}] 检测到之前的初始化失败，尝试重新初始化`, error);
        await this._doCloseDatabase();
      }
    }
    
    // 创建一个新的初始化Promise
    console.log(`组件 [${componentName}] 开始初始化数据库...`);
    this.initializationPromise = this._doInitialize(config);
    try {
      await this.initializationPromise;
      console.log(`组件 [${componentName}] 初始化数据库完成`);
    } catch (error) {
      // 初始化失败，清空initializationPromise以便下次尝试
      this.initializationPromise = null;
      console.error(`组件 [${componentName}] 初始化数据库失败:`, error);
      throw error;
    }
  }
  
  private async _doInitialize(config?: DatabaseConfig): Promise<void> {
    try {
      // 如果有关闭操作正在进行中，等待它完成
      if (this.closingInProgress) {
        console.log(`等待数据库关闭操作完成...`);
        // 等待可能的关闭操作完成
        for (let i = 0; i < 10 && this.closingInProgress; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 如果等待超时，取消初始化
        if (this.closingInProgress) {
          throw new Error("等待数据库关闭操作超时");
        }
      }

      // 检查在等待期间数据库是否已被其他操作初始化
      if (this.initialized) {
        const newDbName = config?.dbName || "graph_database";
        if (this.dbName === newDbName) {
          console.log(`数据库 ${this.dbName} 已在其他操作中被初始化，跳过重复初始化`);
          return;
        }
      }

      // 重新检查初始化状态
      if (!this.initialized) {
        const defaultConfig: DatabaseConfig = {
          dbName: "graph_database",
          version: 1,
          verbose: process.env.NODE_ENV === "development"
        };

        const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
        this.dbName = finalConfig.dbName || "graph_database"; // 确保dbName始终有值
        
        console.log(`正在初始化数据库: ${this.dbName}`);
        await this.db.initialize(finalConfig);
        this.initialized = true;
        console.log(`数据库 ${this.dbName} 初始化完成`);
      } else {
        console.log(`数据库 ${this.dbName} 已经初始化，跳过初始化`);
      }
    } catch (error) {
      console.error(`初始化数据库 ${config?.dbName || "graph_database"} 失败:`, error);
      // 确保重置初始化状态
      this.initialized = false;
      throw error;
    } finally {
      // 初始化完成后，清空initializationPromise
      this.initializationPromise = null;
    }
  }

  getDatabase(componentName: string = "unknown"): GraphDatabaseInterface {
    if (!this.initialized) {
      console.warn(`组件 [${componentName}] 在数据库 ${this.dbName} 初始化前尝试访问。可能导致问题。`);
    } else {
      console.log(`组件 [${componentName}] 访问数据库 ${this.dbName}`);
    }
    return this.db;
  }

  // 仅当外部需要强制关闭数据库时使用
  async closeDatabase(componentName: string = "unknown", force: boolean = false): Promise<void> {
    // 注销组件访问
    this.unregisterComponent(componentName);
    
    // 如果不是强制关闭且还有其他组件在使用数据库，就不关闭
    if (!force && this.referenceCount > 0) {
      console.log(`组件 [${componentName}] 请求关闭数据库，但还有其他组件在使用（引用计数: ${this.referenceCount}）。跳过关闭操作。`);
      return;
    }
    
    // 如果有初始化过程正在进行，可能有新组件正在等待初始化完成
    // 此时即使引用计数为0也不应关闭数据库
    if (!force && this.initializationPromise) {
      console.log(`组件 [${componentName}] 请求关闭数据库，但有初始化过程正在进行，跳过关闭操作防止影响等待中的组件。`);
      return;
    }
    
    // 真正的关闭逻辑
    return this._doCloseDatabase();
  }
  
  // 内部用于实际关闭数据库的方法
  private async _doCloseDatabase(): Promise<void> {
    // 防止并发关闭操作
    if (this.closingInProgress) {
      console.log(`数据库关闭操作已在进行中...`);
      return;
    }
    
    // 在关闭前再次检查引用计数，以防在等待初始化完成期间有新组件注册
    if (this.referenceCount > 0) {
      console.log(`检测到有 ${this.referenceCount} 个组件正在使用数据库，取消关闭操作`);
      return;
    }
    
    // 如果有初始化进行中，等待它完成再关闭
    if (this.initializationPromise) {
      try {
        console.log(`等待初始化完成后再关闭数据库...`);
        await this.initializationPromise;
        
        // 初始化完成后再次检查引用计数
        if (this.referenceCount > 0) {
          console.log(`初始化完成后检测到有 ${this.referenceCount} 个组件正在使用数据库，取消关闭操作`);
          return;
        }
      } catch (error) {
        // 忽略初始化错误，继续尝试关闭
        console.warn("在等待初始化完成时出错，继续尝试关闭数据库", error);
      }
    }
    
    if (this.initialized) {
      try {
        this.closingInProgress = true;
        console.log(`正在关闭数据库: ${this.dbName}`);
        await this.db.close();
        this.initialized = false;
        console.log(`数据库 ${this.dbName} 已关闭`);
        // 重置引用计数和访问组件列表
        this.referenceCount = 0;
        this.accessingComponents.clear();
      } catch (error) {
        console.error(`关闭数据库 ${this.dbName} 失败:`, error);
        // 即使关闭失败，也标记为未初始化，以便下次能重新初始化
        this.initialized = false;
        throw error;
      } finally {
        this.closingInProgress = false;
      }
    } else {
      console.log(`数据库尚未初始化，无需关闭`);
    }
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  getCurrentDbName(): string {
    return this.dbName;
  }
  
  // 获取当前引用计数
  getReferenceCount(): number {
    return this.referenceCount;
  }
  
  // 获取当前访问组件列表
  getAccessingComponents(): string[] {
    return Array.from(this.accessingComponents);
  }
}

export const graphDatabaseService = GraphDatabaseService.getInstance();

export default graphDatabaseService; 