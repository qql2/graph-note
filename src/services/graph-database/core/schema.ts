export const DATABASE_SCHEMA = {
  createTables: [
    // 节点表
    `CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    // 节点属性表
    `CREATE TABLE IF NOT EXISTS node_properties (
      node_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      FOREIGN KEY (node_id) REFERENCES nodes(id),
      PRIMARY KEY (node_id, key)
    )`,

    // 关系表
    `CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      target_id TEXT,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES nodes(id),
      FOREIGN KEY (target_id) REFERENCES nodes(id)
    )`,

    // 关系属性表
    `CREATE TABLE IF NOT EXISTS relationship_properties (
      relationship_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      FOREIGN KEY (relationship_id) REFERENCES relationships(id),
      PRIMARY KEY (relationship_id, key)
    )`,
  ],

  createIndexes: [
    `CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`,
    `CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type)`,
    `CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id)`,
    `CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id)`,
  ],
}; 