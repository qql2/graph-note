import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";
import { WebGraphDB } from "../WebGraphDB";
import { GraphNode, GraphEdge, DeleteMode } from "../../core/types";

// 禁用sql.js的mock
vi.unmock("sql.js");

describe("WebGraphDB Integration Tests", () => {
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

  describe("Data Persistence", () => {
    it("should persist and restore data across sessions", async () => {
      // 第一个会话：创建数据
      const node1: Omit<GraphNode, "created_at" | "updated_at"> = {
        id: "node1",
        type: "test",
        label: "Test Node 1",
        x: 100,
        y: 100,
        properties: { key1: "value1" },
      };

      await db.addNode(node1);
      await db.close();

      // 第二个会话：验证数据恢复
      const newDb = new WebGraphDB();
      await newDb.initialize({
        platform: "web",
        wasm_path: "node_modules/sql.js/dist/sql-wasm.wasm",
      });

      const nodes = await newDb.getNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        ...node1,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      await newDb.close();
    });

    it("should handle large datasets and storage quota", async () => {
      // 创建大量数据以触发存储配额处理
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        id: `node${i}`,
        type: "test",
        label: `Test Node ${i}`,
        x: i * 10,
        y: i * 10,
        properties: {
          data: "x".repeat(1000), // 添加大量数据
        },
      }));

      for (const node of nodes) {
        await db.addNode(node);
      }

      // 创建一些边
      for (let i = 0; i < 99; i++) {
        await db.addEdge({
          id: `edge${i}`,
          source_id: `node${i}`,
          target_id: `node${i + 1}`,
          type: "test",
          properties: {
            weight: i,
          },
        });
      }

      // 验证数据是否正确保存
      const savedNodes = await db.getNodes();
      expect(savedNodes).toHaveLength(100);

      const savedEdges = await db.getEdges();
      expect(savedEdges).toHaveLength(99);
    });
  });

  describe("Backup and Restore", () => {
    it("should manage backup history", async () => {
      // 先创建一些数据
      for (let i = 0; i < 5; i++) {
        await db.addNode({
          id: `node${i}`,
          type: "test",
          label: `Node ${i}`,
          x: i * 100,
          y: i * 100,
          properties: {},
        });
        // 每添加一个节点后创建一个备份
        await db.createBackup();
      }

      // 检查备份列表
      console.log("localStorage length:", localStorage.length);
      console.log("localStorage keys:", Object.keys(localStorage));
      const backups = await db.listBackups();
      console.log("Filtered backups:", backups);
      expect(backups.length).toBeGreaterThanOrEqual(3); // 应该至少保留3个最新的备份
      expect(backups.every((b) => b.startsWith("graphDb_backup_"))).toBe(true);
    });

    it("should create and restore from backup", async () => {
      // 创建初始数据
      const node = {
        id: "test-node",
        type: "test",
        label: "Test Node",
        x: 100,
        y: 100,
        properties: { initial: "value" },
      };
      await db.addNode(node);

      // 创建备份
      const backupId = await db.createBackup();
      expect(backupId).toMatch(/graphDb_backup_/);

      // 修改数据
      await db.updateNode("test-node", {
        label: "Modified Node",
        properties: { modified: "value" },
      });

      // 从备份恢复
      await db.restoreFromBackup(backupId);

      // 验证数据是否恢复到备份时的状态
      const nodes = await db.getNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        ...node,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });
  });

  describe("Complex Graph Operations", () => {
    it("should handle complex graph operations with real data", async () => {
      // 创建一个复杂的图结构
      const nodeIds = await Promise.all([
        db.addNode({
          id: "A",
          type: "test",
          label: "Node A",
          x: 0,
          y: 0,
          properties: { value: 1 },
        }),
        db.addNode({
          id: "B",
          type: "test",
          label: "Node B",
          x: 100,
          y: 0,
          properties: { value: 2 },
        }),
        db.addNode({
          id: "C",
          type: "test",
          label: "Node C",
          x: 50,
          y: 100,
          properties: { value: 3 },
        }),
        db.addNode({
          id: "D",
          type: "test",
          label: "Node D",
          x: -50,
          y: 100,
          properties: { value: 4 },
        }),
      ]);

      // 创建边形成一个环
      await Promise.all([
        db.addEdge({
          id: "e1",
          source_id: "A",
          target_id: "B",
          type: "test",
          properties: { weight: 1 },
        }),
        db.addEdge({
          id: "e2",
          source_id: "B",
          target_id: "C",
          type: "test",
          properties: { weight: 2 },
        }),
        db.addEdge({
          id: "e3",
          source_id: "C",
          target_id: "D",
          type: "test",
          properties: { weight: 3 },
        }),
        db.addEdge({
          id: "e4",
          source_id: "D",
          target_id: "A",
          type: "test",
          properties: { weight: 4 },
        }),
      ]);

      // 测试路径查找
      const path = await db.findPath("A", "C");
      expect(path).toHaveLength(2); // A -> B -> C

      // 测试连接节点查找
      const connected = await db.findConnectedNodes("A", 2);
      expect(connected).toHaveLength(4); // 应该找到所有节点，因为它们都在距离2步以内

      // 测试默认删除模式（保留连接）
      await db.deleteNode("A");
      let remainingNodes = await db.getNodes();
      expect(remainingNodes).toHaveLength(3);

      let remainingEdges = await db.getEdges();
      expect(remainingEdges).toHaveLength(4);
      // 检查与A相关的边是否正确更新为null
      expect(remainingEdges.filter((e) => e.source_id === null)).toHaveLength(
        1
      );
      expect(remainingEdges.filter((e) => e.target_id === null)).toHaveLength(
        1
      );

      // 测试级联删除模式
      await db.deleteNode("B", DeleteMode.CASCADE);
      remainingNodes = await db.getNodes();
      expect(remainingNodes).toHaveLength(2); // 只剩下C和D

      remainingEdges = await db.getEdges();
      expect(remainingEdges).toHaveLength(2); // C-D的边和D-null的边
      // 检查C-D的边
      expect(
        remainingEdges.find((e) => e.source_id === "C" && e.target_id === "D")
      ).toBeTruthy();
      // 检查D-null的边（原来的D-A边）
      expect(
        remainingEdges.find((e) => e.source_id === "D" && e.target_id === null)
      ).toBeTruthy();
    });
  });
});
