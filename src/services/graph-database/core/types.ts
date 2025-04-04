export interface GraphNode {
  id?: string;
  type: string;
  label: string;
  properties?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface GraphEdge {
  id?: string;
  source_id: string;
  target_id: string;
  type: string;
  properties?: Record<string, any>;
  created_at?: string;
}

export interface DatabaseConfig {
  storage_path?: string;
  verbose?: boolean;
  dbName?: string;
  version?: number;
}

export interface Operation {
  type: "query" | "run";
  sql: string;
  params?: any[];
}

export interface SQLiteEngine {
  query(sql: string, params?: any[]): Promise<{ values?: any[] }>;
  run(sql: string, params?: any[]): Promise<void>;
  isOpen(): boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  transaction<T>(operation: () => T | Promise<T>): Promise<T>;
  export(): Uint8Array;
}

export enum DeleteMode {
  CASCADE = "CASCADE",
  KEEP_CONNECTED = "KEEP_CONNECTED",
}

export interface GraphDatabaseInterface {
  initialize(config: DatabaseConfig): Promise<void>;
  close(): Promise<void>;
  addNode(node: Omit<GraphNode, "created_at" | "updated_at">): Promise<string>;
  updateNode(id: string, updates: Partial<GraphNode>): Promise<void>;
  deleteNode(id: string, mode?: DeleteMode): Promise<void>;
  getNodes(): Promise<GraphNode[]>;
  addEdge(edge: Omit<GraphEdge, "created_at">): Promise<string>;
  deleteEdge(id: string): Promise<void>;
  getEdges(): Promise<GraphEdge[]>;
  updateEdge(id: string, updates: Partial<GraphEdge>): Promise<void>;
  findPath(
    startId: string,
    endId: string,
    maxDepth?: number
  ): Promise<GraphEdge[]>;
  findConnectedNodes(nodeId: string, depth?: number): Promise<GraphNode[]>;
  exportData(): Promise<Uint8Array>;
  importData(data: Uint8Array): Promise<void>;
  createBackup(): Promise<string>;
  restoreFromBackup(backupId: string): Promise<void>;
  listBackups(): Promise<string[]>;
} 