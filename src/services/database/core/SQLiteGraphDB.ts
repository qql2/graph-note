import Database from "better-sqlite3";
import { SCHEMA } from "./schema";
import {
  Node,
  Relationship,
  Pattern,
  PathResult,
  MatchResult,
  FindOptions,
  GraphDatabaseInterface,
} from "./types";

interface NodeRow {
  id: number | bigint;
  type: string;
  properties: string | null;
}

interface RelationshipRow {
  id: number | bigint;
  source_id: number | bigint;
  target_id: number | bigint;
  type: string;
  properties: string | null;
}

interface PathRow {
  path: string;
  depth: number;
}

interface IdRow {
  id: number | bigint;
}

interface QueryResult {
  source_id: number | bigint;
  target_id: number | bigint;
  relationship_id: number | bigint;
}

interface PathQueryResult {
  nodes: string;
  relationships: string;
  length: number;
}

export class SQLiteGraphDB implements GraphDatabaseInterface {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    const tables = [
      SCHEMA.nodes,
      SCHEMA.node_properties,
      SCHEMA.relationships,
      SCHEMA.relationship_properties,
    ];

    tables.forEach((table) => {
      this.db.exec(table);
    });

    SCHEMA.indices.forEach((index) => {
      this.db.exec(index);
    });
  }

  async createNode(properties: Record<string, any>): Promise<Node> {
    const { type, ...otherProps } = properties;

    const insertNode = this.db.prepare(`
      INSERT INTO nodes (type) VALUES (?)
    `);

    const insertProperty = this.db.prepare(`
      INSERT INTO node_properties (node_id, key, value)
      VALUES (?, ?, ?)
    `);

    try {
      const nodeResult = await this.db.transaction(() => {
        const { lastInsertRowid } = insertNode.run(type);

        Object.entries(otherProps).forEach(([key, value]) => {
          insertProperty.run(
            Number(lastInsertRowid),
            key,
            JSON.stringify(value)
          );
        });

        return this.getNodeById(Number(lastInsertRowid));
      })();

      if (!nodeResult) {
        throw new Error("Failed to create node");
      }

      return nodeResult;
    } catch (error) {
      throw error;
    }
  }

  async createRelationship(
    sourceId: number,
    targetId: number,
    type: string,
    properties: Record<string, any> = {}
  ): Promise<Relationship> {
    const insertRelationship = this.db.prepare(`
      INSERT INTO relationships (source_id, target_id, type)
      VALUES (?, ?, ?)
    `);

    const insertProperty = this.db.prepare(`
      INSERT INTO relationship_properties (relationship_id, key, value)
      VALUES (?, ?, ?)
    `);

    try {
      const relationshipResult = await this.db.transaction(() => {
        const { lastInsertRowid } = insertRelationship.run(
          sourceId,
          targetId,
          type
        );

        Object.entries(properties).forEach(([key, value]) => {
          insertProperty.run(
            Number(lastInsertRowid),
            key,
            JSON.stringify(value)
          );
        });

        return this.getRelationshipById(Number(lastInsertRowid));
      })();

      if (!relationshipResult) {
        throw new Error("Failed to create relationship");
      }

      return relationshipResult;
    } catch (error) {
      console.error("Error creating relationship:", error);
      throw error;
    }
  }

  async getNodeById(id: number): Promise<Node | null> {
    const node = this.db
      .prepare(
        `
      SELECT n.*, json_object(
        'properties', json_group_object(np.key, np.value)
      ) as props
      FROM nodes n
      LEFT JOIN node_properties np ON n.id = np.node_id
      WHERE n.id = ?
      GROUP BY n.id
    `
      )
      .get(id) as (NodeRow & { props: string }) | undefined;

    if (!node) {
      return null;
    }

    const { props, ...nodeData } = node;
    let properties = {};

    try {
      if (props) {
        const parsedProps = JSON.parse(props);
        properties = parsedProps.properties || {};
      }
    } catch (error) {
      console.error("Error parsing node properties:", error);
      properties = {};
    }

    return {
      id: Number(nodeData.id),
      type: nodeData.type,
      ...Object.fromEntries(
        Object.entries(properties).map(([k, v]) => {
          try {
            return [k, JSON.parse(v as string)];
          } catch (error) {
            console.error(`Error parsing property value for key ${k}:`, error);
            return [k, v];
          }
        })
      ),
    };
  }

  async getRelationshipById(id: number): Promise<Relationship | null> {
    const relationship = this.db
      .prepare(
        `
      SELECT 
        r.*,
        (
          SELECT json_object(
            'properties',
            json_group_object(key, value)
          )
          FROM relationship_properties
          WHERE relationship_id = r.id
        ) as props
      FROM relationships r
      WHERE r.id = ?
    `
      )
      .get(id) as (RelationshipRow & { props: string }) | undefined;

    if (!relationship) return null;

    const { props, ...relationshipData } = relationship;
    let properties = {};

    try {
      if (props) {
        const parsedProps = JSON.parse(props);
        properties = parsedProps.properties || {};
      }
    } catch (error) {
      console.error("Error parsing relationship properties:", error);
      properties = {};
    }

    return {
      id: Number(relationshipData.id),
      sourceId: Number(relationshipData.source_id),
      targetId: Number(relationshipData.target_id),
      type: relationshipData.type,
      ...Object.fromEntries(
        Object.entries(properties).map(([k, v]) => {
          try {
            return [k, JSON.parse(v as string)];
          } catch (error) {
            console.error(`Error parsing property value for key ${k}:`, error);
            return [k, v];
          }
        })
      ),
    };
  }

  async findShortestPath(
    startNodeId: number,
    endNodeId: number,
    relationshipType: string | null = null
  ): Promise<PathResult | null> {
    const query = `
      WITH RECURSIVE
      path(source, target, path_nodes, path_rels, depth) AS (
        -- 基本情况：直接连接
        SELECT 
          source_id,
          target_id,
          json_array(source_id, target_id),
          json_array(id),
          1
        FROM relationships
        WHERE source_id = ? 
        ${relationshipType ? "AND type = ?" : ""}
        
        UNION ALL
        
        -- 递归情况：通过中间节点连接
        SELECT
          p.source,
          r.target_id,
          json(
            substr(
              rtrim(p.path_nodes, ']'),
              1
            ) || ', ' || r.target_id || ']'
          ),
          json(
            substr(
              rtrim(p.path_rels, ']'),
              1
            ) || ', ' || r.id || ']'
          ),
          p.depth + 1
        FROM path p
        JOIN relationships r ON p.target = r.source_id
        WHERE r.target_id NOT IN (
          SELECT value FROM json_each(p.path_nodes)
        )
        AND p.depth < 10
        ${relationshipType ? "AND r.type = ?" : ""}
      )
      SELECT 
        path_nodes as nodes,
        path_rels as relationships,
        depth as length
      FROM path
      WHERE target = ?
      ORDER BY depth ASC
      LIMIT 1;
    `;

    try {
      const params = relationshipType
        ? [startNodeId, relationshipType, relationshipType, endNodeId]
        : [startNodeId, endNodeId];

      const result = this.db.prepare(query).get(...params) as
        | PathQueryResult
        | undefined;

      if (!result) {
        return null;
      }

      const nodeIds = JSON.parse(result.nodes);
      const relationshipIds = JSON.parse(result.relationships);

      const nodes = await Promise.all(
        nodeIds.map((id: number) => this.getNodeById(id))
      );
      const relationships = await Promise.all(
        relationshipIds.map((id: number) => this.getRelationshipById(id))
      );

      if (
        nodes.some((n) => n === null) ||
        relationships.some((r) => r === null)
      ) {
        return null;
      }

      return {
        nodes: nodes as Node[],
        relationships: relationships as Relationship[],
        length: result.length,
      };
    } catch (error) {
      console.error("Error finding shortest path:", error);
      return null;
    }
  }

  async matchPattern(pattern: Pattern): Promise<MatchResult[]> {
    const { nodeType, relationshipType, targetType } = pattern;
    const relationshipTypes = Array.isArray(relationshipType)
      ? relationshipType
      : [relationshipType];

    const query = `
      SELECT 
        n1.id as source_id,
        r.id as relationship_id,
        n2.id as target_id
      FROM nodes n1
      JOIN relationships r ON n1.id = r.source_id
      JOIN nodes n2 ON r.target_id = n2.id
      WHERE n1.type = ?
      AND n2.type = ?
      AND r.type IN (${relationshipTypes.map(() => "?").join(",")})
    `;

    try {
      const params = [nodeType, targetType, ...relationshipTypes];
      const results = this.db.prepare(query).all(...params) as QueryResult[];

      const matchResults = await Promise.all(
        results.map(async (result) => {
          const source = await this.getNodeById(Number(result.source_id));
          const relationship = await this.getRelationshipById(
            Number(result.relationship_id)
          );
          const target = await this.getNodeById(Number(result.target_id));

          if (!source || !relationship || !target) {
            throw new Error(
              "Invalid pattern match: missing node or relationship"
            );
          }

          return {
            source,
            relationship,
            target,
          };
        })
      );

      return matchResults;
    } catch (error) {
      console.error("Error matching pattern:", error);
      return [];
    }
  }

  async findRelationships(options: FindOptions = {}): Promise<Relationship[]> {
    const { type, properties = {} } = options;
    let query = `
      SELECT 
        r.*,
        (
          SELECT json_object(
            'properties',
            json_group_object(key, value)
          )
          FROM relationship_properties
          WHERE relationship_id = r.id
        ) as props
      FROM relationships r
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (type) {
      conditions.push("r.type = ?");
      params.push(type);
    }

    if (Object.keys(properties).length > 0) {
      Object.entries(properties).forEach(([key, value]) => {
        conditions.push(`EXISTS (
          SELECT 1 FROM relationship_properties
          WHERE relationship_id = r.id
          AND key = ?
          AND value = ?
        )`);
        params.push(key, JSON.stringify(value));
      });
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    try {
      const rows = this.db.prepare(query).all(...params) as (RelationshipRow & {
        props: string;
      })[];

      return rows.map((row) => {
        const { props, ...relationshipData } = row;
        let properties = {};

        try {
          if (props) {
            const parsedProps = JSON.parse(props);
            properties = parsedProps.properties || {};
          }
        } catch (error) {
          console.error("Error parsing relationship properties:", error);
          properties = {};
        }

        return {
          id: Number(relationshipData.id),
          sourceId: Number(relationshipData.source_id),
          targetId: Number(relationshipData.target_id),
          type: relationshipData.type,
          ...Object.fromEntries(
            Object.entries(properties).map(([k, v]) => {
              try {
                return [k, JSON.parse(v as string)];
              } catch (error) {
                console.error(
                  `Error parsing property value for key ${k}:`,
                  error
                );
                return [k, v];
              }
            })
          ),
        };
      });
    } catch (error) {
      console.error("Error finding relationships:", error);
      throw error;
    }
  }

  async findNodes(options: FindOptions = {}): Promise<Node[]> {
    const { type = null, properties = {} } = options;
    let query = `
      SELECT n.*, json_object(
        'properties', json_group_object(np.key, np.value)
      ) as props
      FROM nodes n
      LEFT JOIN node_properties np ON n.id = np.node_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (type) {
      conditions.push("n.type = ?");
      params.push(type);
    }

    if (Object.keys(properties).length > 0) {
      Object.entries(properties).forEach(([key, value]) => {
        conditions.push(`EXISTS (
          SELECT 1 FROM node_properties
          WHERE node_id = n.id
          AND key = ?
          AND value = ?
        )`);
        params.push(key, JSON.stringify(value));
      });
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " GROUP BY n.id";

    try {
      const rows = this.db.prepare(query).all(...params) as (NodeRow & {
        props: string;
      })[];

      return rows.map((row) => {
        const { props, ...nodeData } = row;
        const parsedProps = JSON.parse(props);
        const properties = parsedProps.properties || {};

        return {
          id: Number(nodeData.id),
          type: nodeData.type,
          ...Object.fromEntries(
            Object.entries(properties).map(([k, v]) => [
              k,
              JSON.parse(v as string),
            ])
          ),
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async clearDatabase(): Promise<void> {
    const tables = [
      "relationship_properties",
      "node_properties",
      "relationships",
      "nodes",
    ];

    this.db.transaction(() => {
      tables.forEach((table) => {
        this.db.prepare(`DELETE FROM ${table}`).run();
      });
    })();
  }

  close(): void {
    this.db.close();
  }
}
