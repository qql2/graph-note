import { SQLiteGraphDB } from "./platforms/SQLiteGraphDB";
import { GraphDatabaseInterface, DatabaseConfig } from "./core/types";

class GraphDatabaseService {
  private static instance: GraphDatabaseService;
  private db: GraphDatabaseInterface;
  private initialized = false;

  private constructor() {
    this.db = new SQLiteGraphDB();
  }

  static getInstance(): GraphDatabaseService {
    if (!GraphDatabaseService.instance) {
      GraphDatabaseService.instance = new GraphDatabaseService();
    }
    return GraphDatabaseService.instance;
  }

  async initialize(config?: DatabaseConfig): Promise<void> {
    if (this.initialized) return;

    const defaultConfig: DatabaseConfig = {
      dbName: "graph_database",
      version: 1,
      verbose: process.env.NODE_ENV === "development"
    };

    const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
    
    await this.db.initialize(finalConfig);
    this.initialized = true;
  }

  getDatabase(): GraphDatabaseInterface {
    if (!this.initialized) {
      console.warn("Database accessed before initialization. This may cause issues.");
    }
    return this.db;
  }

  async closeDatabase(): Promise<void> {
    if (this.initialized) {
      await this.db.close();
      this.initialized = false;
    }
  }
}

export const graphDatabaseService = GraphDatabaseService.getInstance();
export default graphDatabaseService; 