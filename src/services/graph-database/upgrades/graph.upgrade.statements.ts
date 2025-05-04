import { capSQLiteUpgradeOptions } from '@capacitor-community/sqlite';

// Define the structure for a single upgrade step based on examples
interface UpgradeStep {
  toVersion: number;
  statements: string[];
}

export const GraphUpgradeStatements: UpgradeStep[] = [
  {
    toVersion: 1,
    statements: [
      // Initial schema creation (assuming this happens elsewhere or version 1 is baseline)
      `CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS node_properties (
        node_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        FOREIGN KEY (node_id) REFERENCES nodes(id),
        PRIMARY KEY (node_id, key)
      );`,
      `CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        target_id TEXT,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (source_id) REFERENCES nodes(id),
        FOREIGN KEY (target_id) REFERENCES nodes(id)
      );`,
      `CREATE TABLE IF NOT EXISTS relationship_properties (
        relationship_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        FOREIGN KEY (relationship_id) REFERENCES relationships(id),
        PRIMARY KEY (relationship_id, key)
      );`,
      // Indexes for version 1
      `CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);`,
    ]
  },
  {
    toVersion: 2,
    statements: [
      `ALTER TABLE nodes ADD COLUMN is_independent INTEGER DEFAULT 1;`
    ]
  },
  // Add future upgrade statements here
  /*
  {
    toVersion: 3,
    statements: [
      `ALTER TABLE ...;`
    ]
  },
  */
];

// Helper function to get the latest version number
export const getLatestGraphDbVersion = (): number => {
  if (!GraphUpgradeStatements || GraphUpgradeStatements.length === 0) {
    return 0; // Or handle error appropriately
  }
  return GraphUpgradeStatements[GraphUpgradeStatements.length - 1].toVersion;
}; 