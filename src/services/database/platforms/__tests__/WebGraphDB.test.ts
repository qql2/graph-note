import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebGraphDB } from "../WebGraphDB";
import { GraphNode, GraphEdge, DeleteMode } from "../../core/types";

describe("WebGraphDB", () => {
  let db: WebGraphDB;

  beforeEach(async () => {
    // 清理localStorage
    localStorage.clear();
    db = new WebGraphDB();
    await db.initialize({
      platform: "web",
      wasm_path: "node_modules/sql.js/dist/sql-wasm.wasm",
    });
  });

  afterEach(async () => {
    await db.close();
    localStorage.clear();
  });

  describe("Node Operations", () => {
    it("should create a node", async () => {
      const node: Omit<GraphNode, "created_at" | "updated_at"> = {
        id: "test-node",
        type: "test",
        label: "Test Node",
        x: 100,
        y: 100,
        properties: {
          key1: "value1",
          key2: 2,
        },
      };

      const id = await db.addNode(node);
      expect(id).toBe("test-node");

      const nodes = await db.getNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        ...node,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it("should update a node", async () => {
      const node = {
        id: "test-node",
        type: "test",
        label: "Test Node",
        x: 100,
        y: 100,
        properties: { key1: "value1" },
      };

      await db.addNode(node);

      const updates = {
        label: "Updated Node",
        x: 200,
        properties: { key2: "value2" },
      };

      await db.updateNode("test-node", updates);

      const nodes = await db.getNodes();
      expect(nodes[0]).toMatchObject({
        ...node,
        ...updates,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    describe("Node Deletion", () => {
      let sourceNode: string;
      let targetNode: string;

      beforeEach(async () => {
        // 创建两个节点和一条连接它们的边
        sourceNode = await db.addNode({
          id: "source",
          type: "test",
          label: "Source Node",
          x: 0,
          y: 0,
          properties: {},
        });

        targetNode = await db.addNode({
          id: "target",
          type: "test",
          label: "Target Node",
          x: 100,
          y: 100,
          properties: {},
        });

        await db.addEdge({
          id: "test-edge",
          source_id: sourceNode,
          target_id: targetNode,
          type: "test",
          properties: { weight: 1 },
        });
      });

      it("should delete node and keep connected edges (default mode)", async () => {
        await db.deleteNode(sourceNode);

        // 检查节点是否被删除
        const nodes = await db.getNodes();
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe(targetNode);

        // 检查边是否保留但source_id为null
        const edges = await db.getEdges();
        expect(edges).toHaveLength(1);
        expect(edges[0].source_id).toBeNull();
        expect(edges[0].target_id).toBe(targetNode);
      });

      it("should cascade delete node and related edges", async () => {
        await db.deleteNode(sourceNode, DeleteMode.CASCADE);

        // 检查节点是否被删除
        const nodes = await db.getNodes();
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe(targetNode);

        // 检查相关的边是否也被删除
        const edges = await db.getEdges();
        expect(edges).toHaveLength(0);
      });

      it("should handle deletion of node with multiple connected edges", async () => {
        // 添加另一个连接到源节点的边
        await db.addEdge({
          id: "test-edge-2",
          source_id: targetNode,
          target_id: sourceNode,
          type: "test",
          properties: {},
        });

        // 使用默认模式删除节点
        await db.deleteNode(sourceNode);

        // 检查边是否正确更新
        const edges = await db.getEdges();
        expect(edges).toHaveLength(2);
        expect(edges.filter((e) => e.target_id === null)).toHaveLength(1);
        expect(edges.filter((e) => e.source_id === null)).toHaveLength(1);
      });
    });
  });

  describe("Edge Operations", () => {
    let sourceNode: string;
    let targetNode: string;

    beforeEach(async () => {
      sourceNode = await db.addNode({
        type: "test",
        label: "Source Node",
        x: 0,
        y: 0,
        properties: {},
      });

      targetNode = await db.addNode({
        type: "test",
        label: "Target Node",
        x: 100,
        y: 100,
        properties: {},
      });
    });

    it("should create an edge", async () => {
      const edge: Omit<GraphEdge, "created_at"> = {
        id: "test-edge",
        source_id: sourceNode,
        target_id: targetNode,
        type: "test",
        properties: {
          weight: 1,
        },
      };

      const id = await db.addEdge(edge);
      expect(id).toBe("test-edge");

      const edges = await db.getEdges();
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        ...edge,
        created_at: expect.any(String),
      });
    });

    it("should update an edge", async () => {
      const edge = {
        id: "test-edge",
        source_id: sourceNode,
        target_id: targetNode,
        type: "test",
        properties: { weight: 1 },
      };

      await db.addEdge(edge);

      const updates = {
        type: "updated",
        properties: { weight: 2 },
      };

      await db.updateEdge("test-edge", updates);

      const edges = await db.getEdges();
      expect(edges[0]).toMatchObject({
        ...edge,
        ...updates,
        created_at: expect.any(String),
      });
    });

    it("should delete an edge", async () => {
      const edge = {
        id: "test-edge",
        source_id: sourceNode,
        target_id: targetNode,
        type: "test",
        properties: {},
      };

      await db.addEdge(edge);
      let edges = await db.getEdges();
      expect(edges).toHaveLength(1);

      await db.deleteEdge("test-edge");
      edges = await db.getEdges();
      expect(edges).toHaveLength(0);
    });
  });

  describe("Graph Queries", () => {
    let nodes: string[];

    beforeEach(async () => {
      // 创建一个简单的图：A -> B -> C
      await db.beginTransaction();
      try {
        nodes = [];
        nodes.push(
          await db.addNode({
            id: "A",
            type: "test",
            label: "A",
            x: 0,
            y: 0,
            properties: {},
          })
        );
        nodes.push(
          await db.addNode({
            id: "B",
            type: "test",
            label: "B",
            x: 50,
            y: 0,
            properties: {},
          })
        );
        nodes.push(
          await db.addNode({
            id: "C",
            type: "test",
            label: "C",
            x: 100,
            y: 0,
            properties: {},
          })
        );

        await db.addEdge({
          id: "edge1",
          source_id: nodes[0],
          target_id: nodes[1],
          type: "test",
          properties: {},
        });

        await db.addEdge({
          id: "edge2",
          source_id: nodes[1],
          target_id: nodes[2],
          type: "test",
          properties: {},
        });

        await db.commitTransaction();
      } catch (error) {
        await db.rollbackTransaction();
        throw error;
      }
    });

    it("should find path between nodes", async () => {
      const path = await db.findPath(nodes[0], nodes[2]);
      expect(path).toHaveLength(2);
      expect(path[0].source_id).toBe(nodes[0]);
      expect(path[1].target_id).toBe(nodes[2]);
    });

    it("should find connected nodes", async () => {
      const connected = await db.findConnectedNodes(nodes[1], 1);
      expect(connected).toHaveLength(3); // 应该找到所有节点，因为B与A和C都相连
    });
  });

  describe("Backup and Restore", () => {
    it("should create and restore from backup", async () => {
      // 创建一些测试数据
      await db.addNode({
        id: "test-node",
        type: "test",
        label: "Test Node",
        x: 100,
        y: 100,
        properties: { key: "value" },
      });

      // 创建备份
      const backupId = await db.createBackup();
      expect(backupId).toMatch(/graphDb_backup_/);

      // 清除当前数据
      await db.deleteNode("test-node");
      let nodes = await db.getNodes();
      expect(nodes).toHaveLength(0);

      // 从备份恢复
      await db.restoreFromBackup(backupId);
      nodes = await db.getNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        id: "test-node",
        type: "test",
        label: "Test Node",
      });
    });

    it("should list backups", async () => {
      await db.createBackup();
      await db.createBackup();

      const backups = await db.listBackups();
      expect(backups).toHaveLength(2);
      expect(backups[0]).toMatch(/graphDb_backup_/);
    });
  });

  describe("Transaction Support", () => {
    it("should handle successful transaction", async () => {
      await db.beginTransaction();

      await db.addNode({
        id: "node1",
        type: "test",
        label: "Node 1",
        x: 0,
        y: 0,
        properties: {},
      });

      await db.addNode({
        id: "node2",
        type: "test",
        label: "Node 2",
        x: 100,
        y: 0,
        properties: {},
      });

      await db.commitTransaction();

      const nodes = await db.getNodes();
      expect(nodes).toHaveLength(2);
    });

    it("should rollback failed transaction", async () => {
      await db.beginTransaction();

      await db.addNode({
        id: "node1",
        type: "test",
        label: "Node 1",
        x: 0,
        y: 0,
        properties: {},
      });

      // 模拟错误
      try {
        await db.addNode({
          id: "node1", // 重复的ID会导致错误
          type: "test",
          label: "Node 2",
          x: 100,
          y: 0,
          properties: {},
        });
      } catch {
        await db.rollbackTransaction();
      }

      const nodes = await db.getNodes();
      expect(nodes).toHaveLength(0); // 事务回滚后应该没有节点
    });
  });

  describe("Node Queries", () => {
    beforeEach(async () => {
      // 创建测试节点
      await db.addNode({
        id: "node1",
        type: "person",
        label: "Alice",
        x: 0,
        y: 0,
        properties: {
          age: 25,
          city: "Shanghai"
        }
      });

      await db.addNode({
        id: "node2",
        type: "person",
        label: "Bob",
        x: 100,
        y: 0,
        properties: {
          age: 30,
          city: "Beijing"
        }
      });

      await db.addNode({
        id: "node3",
        type: "company",
        label: "Tech Corp",
        x: 50,
        y: 50,
        properties: {
          industry: "IT",
          city: "Shanghai"
        }
      });
    });

    it("should find nodes without conditions", async () => {
      const nodes = await db.findNodes();
      expect(nodes).toHaveLength(3);
    });

    it("should find nodes by type", async () => {
      const personNodes = await db.findNodes({ type: "person" });
      expect(personNodes).toHaveLength(2);
      expect(personNodes.map(n => n.label)).toContain("Alice");
      expect(personNodes.map(n => n.label)).toContain("Bob");
    });

    it("should find nodes by property", async () => {
      const shanghaiNodes = await db.findNodes({
        properties: { city: "Shanghai" }
      });
      expect(shanghaiNodes).toHaveLength(2);
      expect(shanghaiNodes.map(n => n.label)).toContain("Alice");
      expect(shanghaiNodes.map(n => n.label)).toContain("Tech Corp");
    });

    it("should find nodes by type and property", async () => {
      const shanghaiPersons = await db.findNodes({
        type: "person",
        properties: { city: "Shanghai" }
      });
      expect(shanghaiPersons).toHaveLength(1);
      expect(shanghaiPersons[0].label).toBe("Alice");
    });
  });

  describe("Edge Queries", () => {
    let personId1: string;
    let personId2: string;
    let companyId: string;

    beforeEach(async () => {
      // 创建测试节点
      personId1 = await db.addNode({
        id: "person1",
        type: "person",
        label: "Alice",
        x: 0,
        y: 0,
        properties: {}
      });

      personId2 = await db.addNode({
        id: "person2",
        type: "person",
        label: "Bob",
        x: 100,
        y: 0,
        properties: {}
      });

      companyId = await db.addNode({
        id: "company1",
        type: "company",
        label: "Tech Corp",
        x: 50,
        y: 50,
        properties: {}
      });

      // 创建测试边
      await db.addEdge({
        id: "edge1",
        source_id: personId1,
        target_id: companyId,
        type: "WORKS_AT",
        properties: {
          since: 2020,
          role: "Engineer"
        }
      });

      await db.addEdge({
        id: "edge2",
        source_id: personId2,
        target_id: companyId,
        type: "WORKS_AT",
        properties: {
          since: 2021,
          role: "Manager"
        }
      });

      await db.addEdge({
        id: "edge3",
        source_id: personId1,
        target_id: personId2,
        type: "KNOWS",
        properties: {
          since: 2019
        }
      });
    });

    it("should find edges without conditions", async () => {
      const edges = await db.findEdges();
      expect(edges).toHaveLength(3);
    });

    it("should find edges by type", async () => {
      const worksAtEdges = await db.findEdges({ type: "WORKS_AT" });
      expect(worksAtEdges).toHaveLength(2);
    });

    it("should find edges by source node", async () => {
      const aliceEdges = await db.findEdges({ source_id: personId1 });
      expect(aliceEdges).toHaveLength(2);
    });

    it("should find edges by target node", async () => {
      const toCompanyEdges = await db.findEdges({ target_id: companyId });
      expect(toCompanyEdges).toHaveLength(2);
    });

    it("should find edges by property", async () => {
      const edges2020 = await db.findEdges({
        properties: { since: 2020 }
      });
      expect(edges2020).toHaveLength(1);
      expect(edges2020[0].properties?.role).toBe("Engineer");
    });

    it("should find edges by multiple conditions", async () => {
      const aliceWorksAtEdges = await db.findEdges({
        type: "WORKS_AT",
        source_id: personId1,
        properties: { since: 2020 }
      });
      expect(aliceWorksAtEdges).toHaveLength(1);
      expect(aliceWorksAtEdges[0].target_id).toBe(companyId);
    });
  });
});
