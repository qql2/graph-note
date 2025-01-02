export interface DatabaseSchema {
  nodes: string;
  node_properties: string;
  relationships: string;
  relationship_properties: string;
  indices: string[];
}

export const SCHEMA: DatabaseSchema = {
  // 节点表 - 存储所有节点
  nodes: `
    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // 节点属性表 - 存储节点的属性
  node_properties: `
    CREATE TABLE IF NOT EXISTS node_properties (
      node_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      PRIMARY KEY (node_id, key)
    )
  `,

  // 关系表 - 存储节点之间的关系
  relationships: `
    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `,

  // 关系属性表 - 存储关系的属性
  relationship_properties: `
    CREATE TABLE IF NOT EXISTS relationship_properties (
      relationship_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
      PRIMARY KEY (relationship_id, key)
    )
  `,

  // 索引
  indices: [
    "CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)",
    "CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type)",
    "CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id)",
    "CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id)",
  ],
};
