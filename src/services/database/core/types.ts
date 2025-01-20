export interface GraphNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  properties?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties?: Record<string, any>;
  created_at?: string;
}

export interface DatabaseConfig {
  storage_path?: string;
  verbose?: boolean;
  wasm_path?: string;
  platform?: "web" | "desktop";
}

export interface Operation {
  type: "query" | "run";
  sql: string;
  params?: any[];
}

export interface SQLiteEngine {
  exec(sql: string, params?: any[]): any;
  prepare(sql: string): any;
  run(sql: string, params?: any[]): void;
  isOpen(): boolean;
  close(): void;
  export(): Uint8Array;
  transaction<T>(operation: () => T | Promise<T>): Promise<T>;
}

export enum DeleteMode {
  CASCADE = "CASCADE",
  KEEP_CONNECTED = "KEEP_CONNECTED",
}

export interface GraphDatabaseInterface {
  initialize(config: DatabaseConfig): void;
  close(): Promise<void>;
  addNode(node: Omit<GraphNode, "created_at" | "updated_at">): Promise<string>;
  updateNode(id: string, updates: Partial<GraphNode>): Promise<void>;
  deleteNode(id: string, mode?: DeleteMode): Promise<void>;
  getNodes(): Promise<GraphNode[]>;
  findNodes(conditions?: {
    type?: string;
    properties?: Record<string, any>;
  }): Promise<GraphNode[]>;
  addEdge(edge: Omit<GraphEdge, "created_at">): Promise<string>;
  deleteEdge(id: string): Promise<void>;
  getEdges(): Promise<GraphEdge[]>;
  findEdges(conditions?: {
    type?: string;
    source_id?: string;
    target_id?: string;
    properties?: Record<string, any>;
  }): Promise<GraphEdge[]>;
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
  isReady(): Promise<boolean>;
}

export interface DatabaseAPI {
  query: (sql: string, params?: any[]) => Promise<any>;
  backup: () => Promise<string>;
  restore: (backupPath: string) => Promise<void>;
  listBackups: () => Promise<string[]>;
  reload: () => Promise<void>;
  initialize: () => Promise<void>;
  isReady: () => Promise<boolean>;
}

export interface ElectronAPI {
  database: DatabaseAPI;
}
