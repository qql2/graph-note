const Database = require('better-sqlite3');
const SCHEMA = require('./schema');

class GraphDB {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  // 初始化数据库
  initializeDatabase() {
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

  // 创建节点
  async createNode(properties) {
    const { type, ...otherProps } = properties;

    const insertNode = this.db.prepare(`
      INSERT INTO nodes (type) VALUES (?)
    `);

    const insertProperty = this.db.prepare(`
      INSERT INTO node_properties (node_id, key, value)
      VALUES (?, ?, ?)
    `);

    try {
      const result = this.db.transaction(() => {
        const { lastInsertRowid } = insertNode.run(type);

        Object.entries(otherProps).forEach(([key, value]) => {
          const jsonValue = JSON.stringify(value);
          insertProperty.run(lastInsertRowid, key, jsonValue);
        });

        return this.getNodeById(lastInsertRowid);
      })();

      return result;
    } catch (error) {
      throw error;
    }
  }

  // 创建关系
  async createRelationship(sourceId, targetId, type, properties = {}) {
    const insertRelationship = this.db.prepare(`
      INSERT INTO relationships (source_id, target_id, type)
      VALUES (?, ?, ?)
    `);

    const insertProperty = this.db.prepare(`
      INSERT INTO relationship_properties (relationship_id, key, value)
      VALUES (?, ?, ?)
    `);

    try {
      return this.db.transaction(() => {
        const { lastInsertRowid } = insertRelationship.run(sourceId, targetId, type);

        Object.entries(properties).forEach(([key, value]) => {
          insertProperty.run(lastInsertRowid, key, JSON.stringify(value));
        });

        return this.getRelationshipById(lastInsertRowid);
      })();
    } catch (error) {
      throw error;
    }
  }

  // 获取节点
  getNodeById(id) {
    const node = this.db
      .prepare(
        `
      SELECT n.*, json_group_object(np.key, np.value) as properties
      FROM nodes n
      LEFT JOIN node_properties np ON n.id = np.node_id
      WHERE n.id = ?
      GROUP BY n.id
    `
      )
      .get(id);

    if (!node) {
      return null;
    }

    const properties = node.properties ? JSON.parse(node.properties) : {};

    const result = {
      id: node.id,
      type: node.type,
      ...Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, JSON.parse(v)])),
    };
    return result;
  }

  // 获取关系
  getRelationshipById(id) {
    const relationship = this.db
      .prepare(
        `
      SELECT r.*, json_group_object(rp.key, rp.value) as properties
      FROM relationships r
      LEFT JOIN relationship_properties rp ON r.id = rp.relationship_id
      WHERE r.id = ?
      GROUP BY r.id
    `
      )
      .get(id);

    if (!relationship) return null;

    const properties = relationship.properties ? JSON.parse(relationship.properties) : {};
    return {
      id: relationship.id,
      sourceId: relationship.source_id,
      targetId: relationship.target_id,
      type: relationship.type,
      ...Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, JSON.parse(v)])),
    };
  }

  // 关闭数据库连接
  close() {
    this.db.close();
  }

  // 查找两个节点之间的最短路径
  async findShortestPath(startNodeId, endNodeId, relationshipType = null) {
    const query = `
      WITH RECURSIVE
      path(source, target, path_nodes, depth) AS (
        -- 基本情况：直接连接
        SELECT 
          source_id,
          target_id,
          source_id || ',' || target_id,
          1
        FROM relationships
        WHERE source_id = ? 
        ${relationshipType ? 'AND type = ?' : ''}
        
        UNION ALL
        
        -- 递归情况：通过中间节点连接
        SELECT
          p.source,
          r.target_id,
          p.path_nodes || ',' || r.target_id,
          p.depth + 1
        FROM path p
        JOIN relationships r ON p.target = r.source_id
        WHERE r.target_id NOT IN (SELECT value FROM (
          SELECT CAST(value AS INTEGER) as value
          FROM json_each('["' || REPLACE(p.path_nodes, ',', '","') || '"]')
        ))
        AND p.depth < 10
        ${relationshipType ? 'AND r.type = ?' : ''}
      )
      SELECT path_nodes as path, depth
      FROM path
      WHERE target = ?
      ORDER BY depth ASC
      LIMIT 1;
    `;

    try {
      const params = relationshipType
        ? [startNodeId, relationshipType, relationshipType, endNodeId]
        : [startNodeId, endNodeId];

      const result = this.db.prepare(query).get(...params);

      if (!result) return null;

      const nodeIds = result.path.split(',').map(Number);
      const nodes = await Promise.all(nodeIds.map((id) => this.getNodeById(id)));

      return {
        nodes,
        length: result.depth,
      };
    } catch (error) {
      throw error;
    }
  }

  // 模式匹配查询
  async matchPattern(pattern) {
    // pattern 格式: { nodeType, relationshipType, targetType }
    const relationshipTypes = Array.isArray(pattern.relationshipType)
      ? pattern.relationshipType
      : [pattern.relationshipType];

    const relationshipCondition = relationshipTypes.map((type) => '?').join(' OR r.type = ');

    const query = `
      SELECT 
        n1.id as source_id,
        n2.id as target_id,
        r.id as relationship_id
      FROM nodes n1
      JOIN relationships r ON n1.id = r.source_id
      JOIN nodes n2 ON r.target_id = n2.id
      WHERE n1.type = ?
      AND (r.type = ${relationshipCondition})
      AND n2.type = ?
    `;

    try {
      const params = [pattern.nodeType, ...relationshipTypes, pattern.targetType];

      const results = this.db.prepare(query).all(...params);

      return await Promise.all(
        results.map(async (result) => ({
          source: await this.getNodeById(result.source_id),
          relationship: await this.getRelationshipById(result.relationship_id),
          target: await this.getNodeById(result.target_id),
        }))
      );
    } catch (error) {
      throw error;
    }
  }

  // 查找关系
  async findRelationships({ type = null, properties = {} } = {}) {
    let query = `
      SELECT r.id
      FROM relationships r
      LEFT JOIN relationship_properties rp ON r.id = rp.relationship_id
    `;

    const params = [];
    const conditions = [];

    if (type) {
      conditions.push('r.type = ?');
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
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY r.id';

    try {
      const relationships = this.db.prepare(query).all(...params);
      return await Promise.all(relationships.map((row) => this.getRelationshipById(row.id)));
    } catch (error) {
      throw error;
    }
  }

  // 聚合查询
  async aggregateRelationships(nodeType, relationshipType) {
    const query = `
      SELECT 
        n.type as node_type,
        r.type as relationship_type,
        COUNT(*) as count,
        COUNT(DISTINCT r.source_id) as unique_sources,
        COUNT(DISTINCT r.target_id) as unique_targets
      FROM nodes n
      JOIN relationships r ON n.id = r.source_id
      WHERE n.type = ?
      AND r.type = ?
      GROUP BY n.type, r.type
    `;

    try {
      return this.db.prepare(query).get(nodeType, relationshipType);
    } catch (error) {
      throw error;
    }
  }

  // 按类型和属性查询节点
  async findNodes({ type = null, properties = {} } = {}) {
    let query = `
      SELECT DISTINCT n.id
      FROM nodes n
    `;

    const params = [];
    const conditions = [];

    // 添加type条件
    if (type !== null) {
      conditions.push('n.type = ?');
      params.push(type);
    }

    // 添加属性条件
    if (Object.keys(properties).length > 0) {
      Object.entries(properties).forEach(([key, value]) => {
        conditions.push(`
          EXISTS (
            SELECT 1 FROM node_properties 
            WHERE node_id = n.id 
            AND key = ? 
            AND value = json(?)
          )
        `);
        params.push(key, JSON.stringify(value));
      });
    }

    // 如果有任何条件，添加WHERE子句
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    try {
      const results = this.db.prepare(query).all(params);

      if (!results || results.length === 0) {
        return [];
      }

      return await Promise.all(results.map((r) => this.getNodeById(r.id)));
    } catch (error) {
      console.error('Error in findNodes:', error.message);
      throw new Error(`Failed to find nodes: ${error.message}`);
    }
  }
}

module.exports = GraphDB;
