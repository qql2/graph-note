import { SQLiteGraphDB } from "./core/SQLiteGraphDB";
import {
  Node,
  Relationship,
  Pattern,
  PathResult,
  MatchResult,
  FindOptions,
} from "./core/types";
import path from "path";
import os from "os";
import fs from "fs";

export class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLiteGraphDB;

  private constructor() {
    const homeDir = os.homedir();
    const appDataDir = path.join(homeDir, ".graph-note");
    const dbPath = path.join(appDataDir, "graph-note.db");

    // 确保数据库目录存在
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }

    this.db = new SQLiteGraphDB(dbPath);
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // 节点操作
  async createNode(properties: Record<string, any>): Promise<Node> {
    return this.db.createNode(properties);
  }

  async getNodeById(id: number): Promise<Node | null> {
    return this.db.getNodeById(id);
  }

  async findNodes(options?: FindOptions): Promise<Node[]> {
    return this.db.findNodes(options);
  }

  // 关系操作
  async createRelationship(
    sourceId: number,
    targetId: number,
    type: string,
    properties?: Record<string, any>
  ): Promise<Relationship> {
    return this.db.createRelationship(sourceId, targetId, type, properties);
  }

  async getRelationshipById(id: number): Promise<Relationship | null> {
    return this.db.getRelationshipById(id);
  }

  async findRelationships(options?: FindOptions): Promise<Relationship[]> {
    return this.db.findRelationships(options);
  }

  // 图查询操作
  async findShortestPath(
    startNodeId: number,
    endNodeId: number,
    relationshipType?: string
  ): Promise<PathResult | null> {
    return this.db.findShortestPath(startNodeId, endNodeId, relationshipType);
  }

  async matchPattern(pattern: Pattern): Promise<MatchResult[]> {
    return this.db.matchPattern(pattern);
  }

  async clearDatabase(): Promise<void> {
    return this.db.clearDatabase();
  }

  // 关闭数据库连接
  close(): void {
    this.db.close();
  }
}
