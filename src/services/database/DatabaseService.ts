import { WebGraphDB } from "./platforms/WebGraphDB";
import { GraphDatabaseInterface } from "./core/types";

export class DatabaseService {
  private static instance: DatabaseService;
  private db: GraphDatabaseInterface;

  private constructor() {
    this.db = new WebGraphDB();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    await this.db.initialize({
      platform: "web",
      wasm_path: "/sql-wasm.wasm",
    });
  }

  getDatabase(): GraphDatabaseInterface {
    return this.db;
  }
}

export const databaseService = DatabaseService.getInstance();
