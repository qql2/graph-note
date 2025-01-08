export interface GraphNode {
  id?: string;
  type: string;
  label: string;
  x: number;
  y: number;
  properties: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: Record<string, any>;
  created_at: string;
}

export interface DatabaseConfig {
  // 平台特定的配置选项
  platform: "web" | "desktop" | "mobile";
  storage_path?: string; // desktop和mobile平台需要
  wasm_path?: string; // web平台需要
}

export interface GraphDatabaseInterface {
  // 初始化和配置
  initialize(config: DatabaseConfig): Promise<void>;
  close(): Promise<void>;

  // 数据操作
  addNode(node: Omit<GraphNode, "created_at" | "updated_at">): Promise<string>;
  updateNode(id: string, updates: Partial<GraphNode>): Promise<void>;
  deleteNode(id: string): Promise<void>;
  getNodes(): Promise<GraphNode[]>;

  addEdge(edge: Omit<GraphEdge, "created_at">): Promise<string>;
  updateEdge(id: string, updates: Partial<GraphEdge>): Promise<void>;
  deleteEdge(id: string): Promise<void>;
  getEdges(): Promise<GraphEdge[]>;

  // 高级查询
  findPath(
    startId: string,
    endId: string,
    maxDepth?: number
  ): Promise<GraphEdge[]>;
  findConnectedNodes(nodeId: string, depth?: number): Promise<GraphNode[]>;

  // 数据导入导出
  exportData(): Promise<Uint8Array>;
  importData(data: Uint8Array): Promise<void>;

  // 备份管理
  createBackup(): Promise<string>; // 返回备份ID
  restoreFromBackup(backupId: string): Promise<void>;
  listBackups(): Promise<string[]>;

  // 事务支持
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

// 平台特定的存储引擎接口
export interface SQLiteEngine {
  // 基础数据库操作
  exec(sql: string, params?: any[]): any;
  prepare(sql: string): any;
  run(sql: string, params?: any[]): void;

  // 数据库状态
  isOpen(): boolean;
  close(): void;

  // 数据导出
  export(): Uint8Array;

  // 事务支持
  transaction<T>(operation: () => T | Promise<T>): T | Promise<T>;
}
