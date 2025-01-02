const path = require('path');
const GraphDB = require('../src/core/GraphDB');

describe('GraphDB', () => {
  let db;
  const dbPath = path.join(__dirname, 'test.sqlite');

  beforeEach(() => {
    db = new GraphDB(dbPath);
  });

  afterEach(() => {
    db.close();
  });

  describe('Node Operations', () => {
    test('should create a node with properties', async () => {
      const nodeData = {
        type: 'Person',
        name: 'Alice',
        age: 30,
      };

      const node = await db.createNode(nodeData);

      expect(node).toMatchObject({
        id: expect.any(Number),
        type: 'Person',
        name: 'Alice',
        age: 30,
      });
    });

    test('should retrieve a node by id', async () => {
      const nodeData = {
        type: 'Person',
        name: 'Bob',
        age: 25,
      };

      const created = await db.createNode(nodeData);
      const retrieved = await db.getNodeById(created.id);

      expect(retrieved).toEqual(created);
    });
  });

  describe('Relationship Operations', () => {
    test('should create a relationship between nodes', async () => {
      const person1 = await db.createNode({ type: 'Person', name: 'Alice' });
      const person2 = await db.createNode({ type: 'Person', name: 'Bob' });

      const relationship = await db.createRelationship(person1.id, person2.id, 'KNOWS', {
        since: 2020,
      });

      expect(relationship).toMatchObject({
        id: expect.any(Number),
        sourceId: person1.id,
        targetId: person2.id,
        type: 'KNOWS',
        since: 2020,
      });
    });

    test('should retrieve a relationship by id', async () => {
      const person1 = await db.createNode({ type: 'Person', name: 'Alice' });
      const person2 = await db.createNode({ type: 'Person', name: 'Bob' });

      const created = await db.createRelationship(person1.id, person2.id, 'KNOWS', { since: 2020 });

      const retrieved = await db.getRelationshipById(created.id);
      expect(retrieved).toEqual(created);
    });
  });

  describe('Advanced Queries', () => {
    let person1, person2, person3, movie1;

    beforeEach(async () => {
      // 创建测试数据
      person1 = await db.createNode({ type: 'Person', name: 'Alice', age: 30 });
      person2 = await db.createNode({ type: 'Person', name: 'Bob', age: 25 });
      person3 = await db.createNode({ type: 'Person', name: 'Charlie', age: 35 });
      movie1 = await db.createNode({ type: 'Movie', title: 'The Matrix', year: 1999 });

      // 创建关系
      await db.createRelationship(person1.id, person2.id, 'KNOWS', { since: 2020 });
      await db.createRelationship(person2.id, person3.id, 'KNOWS', { since: 2021 });
      await db.createRelationship(person1.id, movie1.id, 'WATCHED', { rating: 5 });
      await db.createRelationship(person2.id, movie1.id, 'WATCHED', { rating: 4 });
    });

    test('should find shortest path between nodes', async () => {
      const path = await db.findShortestPath(person1.id, person3.id, 'KNOWS');

      expect(path).toMatchObject({
        nodes: expect.arrayContaining([
          expect.objectContaining({ name: 'Alice' }),
          expect.objectContaining({ name: 'Bob' }),
          expect.objectContaining({ name: 'Charlie' }),
        ]),
        length: 2,
      });
    });

    test('should match pattern between nodes', async () => {
      const pattern = {
        nodeType: 'Person',
        relationshipType: 'WATCHED',
        targetType: 'Movie',
      };

      const matches = await db.matchPattern(pattern);

      expect(matches).toHaveLength(2);
      expect(matches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: expect.objectContaining({ name: 'Alice' }),
            target: expect.objectContaining({ title: 'The Matrix' }),
          }),
          expect.objectContaining({
            source: expect.objectContaining({ name: 'Bob' }),
            target: expect.objectContaining({ title: 'The Matrix' }),
          }),
        ])
      );
    });

    test('should aggregate relationships', async () => {
      const stats = await db.aggregateRelationships('Person', 'WATCHED');

      expect(stats).toMatchObject({
        node_type: 'Person',
        relationship_type: 'WATCHED',
        count: 2,
        unique_sources: 2,
        unique_targets: 1,
      });
    });

    describe('findNodes', () => {
      test('should find nodes by type only', async () => {
        const nodes = await db.findNodes({ type: 'Person' });
        expect(nodes).toHaveLength(3);
        expect(nodes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'Person', name: 'Alice' }),
            expect.objectContaining({ type: 'Person', name: 'Bob' }),
            expect.objectContaining({ type: 'Person', name: 'Charlie' }),
          ])
        );
      });

      test('should find nodes by properties only', async () => {
        const nodes = await db.findNodes({
          properties: { age: 30 },
        });
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({
          type: 'Person',
          name: 'Alice',
          age: 30,
        });
      });

      test('should find nodes by both type and properties', async () => {
        const nodes = await db.findNodes({
          type: 'Person',
          properties: { age: 25 },
        });
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({
          type: 'Person',
          name: 'Bob',
          age: 25,
        });
      });

      test('should find nodes by multiple properties', async () => {
        const nodes = await db.findNodes({
          properties: {
            name: 'Alice',
            age: 30,
          },
        });
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({
          type: 'Person',
          name: 'Alice',
          age: 30,
        });
      });

      test('should return empty array when no nodes match', async () => {
        const nodes = await db.findNodes({
          type: 'Person',
          properties: { age: 99 },
        });
        expect(nodes).toHaveLength(0);
      });

      test('should return all nodes when no criteria provided', async () => {
        const nodes = await db.findNodes();
        expect(nodes).toHaveLength(4); // 3 persons + 1 movie
        expect(nodes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'Person' }),
            expect.objectContaining({ type: 'Movie' }),
          ])
        );
      });
    });

    describe('Error Handling', () => {
      test('should handle invalid node id in getNodeById', async () => {
        const result = await db.getNodeById(999999);
        expect(result).toBeNull();
      });

      test('should handle invalid relationship id in getRelationshipById', async () => {
        const result = await db.getRelationshipById(999999);
        expect(result).toBeNull();
      });

      test('should handle malformed JSON in node properties', async () => {
        const nodeData = {
          type: 'Test',
          circular: {},
        };
        // 创建循环引用
        nodeData.circular.self = nodeData.circular;

        await expect(db.createNode(nodeData)).rejects.toThrow();
      });

      test('should handle non-existent relationship type in findShortestPath', async () => {
        const path = await db.findShortestPath(person1.id, person3.id, 'NON_EXISTENT');
        expect(path).toBeNull();
      });

      test('should handle invalid pattern in matchPattern', async () => {
        const invalidPattern = {
          nodeType: 'NonExistentType',
          relationshipType: 'NON_EXISTENT',
          targetType: 'NonExistentType',
        };
        const result = await db.matchPattern(invalidPattern);
        expect(result).toEqual([]);
      });

      test('should handle non-existent node type in aggregateRelationships', async () => {
        const result = await db.aggregateRelationships('NonExistentType', 'KNOWS');
        expect(result).toBeUndefined();
      });

      test('should handle invalid SQL in property values', async () => {
        const nodeData = {
          type: 'Test',
          prop: "value'; DROP TABLE nodes; --",
        };

        const node = await db.createNode(nodeData);
        expect(node.prop).toBe("value'; DROP TABLE nodes; --");

        // 验证表没有被删除
        const result = await db.findNodes({ type: 'Test' });
        expect(result).toHaveLength(1);
      });

      test('should handle malformed JSON in relationship properties', async () => {
        const circular = {};
        circular.self = circular;

        await expect(
          db.createRelationship(person1.id, person2.id, 'TEST', { circular })
        ).rejects.toThrow();
      });
    });

    describe('Relationship Search', () => {
      test('should find relationships by type only', async () => {
        const relationships = await db.findRelationships({ type: 'KNOWS' });
        expect(relationships).toHaveLength(2);
        expect(relationships).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'KNOWS', since: 2020 }),
            expect.objectContaining({ type: 'KNOWS', since: 2021 }),
          ])
        );
      });

      test('should find relationships by properties only', async () => {
        const relationships = await db.findRelationships({
          properties: { since: 2020 },
        });
        expect(relationships).toHaveLength(1);
        expect(relationships[0]).toMatchObject({
          type: 'KNOWS',
          since: 2020,
        });
      });

      test('should find relationships by both type and properties', async () => {
        const relationships = await db.findRelationships({
          type: 'WATCHED',
          properties: { rating: 5 },
        });
        expect(relationships).toHaveLength(1);
        expect(relationships[0]).toMatchObject({
          type: 'WATCHED',
          rating: 5,
        });
      });

      test('should return empty array when no relationships match', async () => {
        const relationships = await db.findRelationships({
          type: 'UNKNOWN',
          properties: { since: 9999 },
        });
        expect(relationships).toHaveLength(0);
      });

      test('should return all relationships when no criteria provided', async () => {
        const relationships = await db.findRelationships();
        expect(relationships).toHaveLength(4); // 2 KNOWS + 2 WATCHED
        expect(relationships).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'KNOWS' }),
            expect.objectContaining({ type: 'WATCHED' }),
          ])
        );
      });

      test('should handle SQL injection attempts in properties', async () => {
        const relationships = await db.findRelationships({
          properties: {
            "rating': 5 OR '1'='1": 'malicious value',
          },
        });
        expect(relationships).toHaveLength(0);
      });

      test('should handle multiple property conditions', async () => {
        await db.createRelationship(person1.id, person2.id, 'COMPLEX', {
          prop1: 'value1',
          prop2: 'value2',
        });

        const relationships = await db.findRelationships({
          type: 'COMPLEX',
          properties: {
            prop1: 'value1',
            prop2: 'value2',
          },
        });

        expect(relationships).toHaveLength(1);
        expect(relationships[0]).toMatchObject({
          type: 'COMPLEX',
          prop1: 'value1',
          prop2: 'value2',
        });
      });
    });

    describe('Edge Cases', () => {
      test('should handle circular relationships in findShortestPath', async () => {
        // 创建循环关系
        await db.createRelationship(person3.id, person1.id, 'KNOWS', { since: 2022 });
        const path = await db.findShortestPath(person1.id, person3.id, 'KNOWS');
        expect(path.length).toBe(2); // 应该找到最短路径，而不是循环
      });

      test('should handle multiple relationship types in matchPattern', async () => {
        const pattern = {
          nodeType: 'Person',
          relationshipType: ['KNOWS', 'WATCHED'],
          targetType: 'Movie',
        };
        const matches = await db.matchPattern(pattern);
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((m) => m.relationship.type === 'WATCHED')).toBe(true);
      });

      test('should handle special characters in property values', async () => {
        const specialNode = await db.createNode({
          type: 'Test',
          special: '!@#$%^&*()',
          quote: '"quoted"',
          sql: 'SELECT * FROM table',
        });

        const result = await db.findNodes({
          type: 'Test',
          properties: { special: '!@#$%^&*()' },
        });

        expect(result).toHaveLength(1);
        expect(result[0].special).toBe('!@#$%^&*()');
      });

      test('should handle large property values', async () => {
        const largeString = 'a'.repeat(1000);
        const largeNode = await db.createNode({
          type: 'Test',
          largeProperty: largeString,
        });

        const result = await db.findNodes({
          properties: { largeProperty: largeString },
        });

        expect(result).toHaveLength(1);
        expect(result[0].largeProperty).toBe(largeString);
      });
    });
  });
});
