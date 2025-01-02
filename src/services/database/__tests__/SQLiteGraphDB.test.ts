import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteGraphDB } from "../core/SQLiteGraphDB";
import path from "path";
import fs from "fs";
import os from "os";

describe("SQLiteGraphDB", () => {
  let db: SQLiteGraphDB;
  const testDir = path.join(os.tmpdir(), "graph-note-test");
  const testDbPath = path.join(testDir, "test-graph.db");

  beforeEach(() => {
    // 确保测试目录存在
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // 每个测试前创建新的数据库实例
    db = new SQLiteGraphDB(testDbPath);
  });

  afterEach(() => {
    // 每个测试后关闭数据库连接并删除测试数据库文件
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("节点操作", () => {
    it("应该能创建节点", async () => {
      const node = await db.createNode({
        type: "Person",
        name: "Alice",
        age: 30,
      });

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.type).toBe("Person");
      expect(node.name).toBe("Alice");
      expect(node.age).toBe(30);
    });

    it("应该能获取节点", async () => {
      const created = await db.createNode({
        type: "Person",
        name: "Bob",
        age: 25,
      });

      const retrieved = await db.getNodeById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.type).toBe("Person");
      expect(retrieved?.name).toBe("Bob");
      expect(retrieved?.age).toBe(25);
    });

    it("应该能按类型查找节点", async () => {
      await db.createNode({
        type: "Person",
        name: "Alice",
      });

      await db.createNode({
        type: "Person",
        name: "Bob",
      });

      await db.createNode({
        type: "Company",
        name: "Tech Corp",
      });

      const persons = await db.findNodes({ type: "Person" });
      expect(persons).toHaveLength(2);
      expect(persons.every((p) => p.type === "Person")).toBe(true);
    });

    it("应该能按属性查找节点", async () => {
      await db.createNode({
        type: "Person",
        name: "Alice",
        age: 30,
      });

      await db.createNode({
        type: "Person",
        name: "Bob",
        age: 30,
      });

      await db.createNode({
        type: "Person",
        name: "Charlie",
        age: 25,
      });

      const thirtyYearOlds = await db.findNodes({
        type: "Person",
        properties: { age: 30 },
      });

      expect(thirtyYearOlds).toHaveLength(2);
      expect(thirtyYearOlds.every((p) => p.age === 30)).toBe(true);
    });
  });

  describe("关系操作", () => {
    it("应该能创建关系", async () => {
      const alice = await db.createNode({
        type: "Person",
        name: "Alice",
      });

      const bob = await db.createNode({
        type: "Person",
        name: "Bob",
      });

      const relationship = await db.createRelationship(
        alice.id,
        bob.id,
        "KNOWS",
        { since: 2023 }
      );

      expect(relationship).toBeDefined();
      expect(relationship.sourceId).toBe(alice.id);
      expect(relationship.targetId).toBe(bob.id);
      expect(relationship.type).toBe("KNOWS");
      expect(relationship.since).toBe(2023);
    });

    it("应该能获取关系", async () => {
      const alice = await db.createNode({
        type: "Person",
        name: "Alice",
      });

      const bob = await db.createNode({
        type: "Person",
        name: "Bob",
      });

      const created = await db.createRelationship(alice.id, bob.id, "KNOWS", {
        since: 2023,
      });

      const retrieved = await db.getRelationshipById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.sourceId).toBe(alice.id);
      expect(retrieved?.targetId).toBe(bob.id);
      expect(retrieved?.type).toBe("KNOWS");
      expect(retrieved?.since).toBe(2023);
    });

    it("应该能按类型查找关系", async () => {
      const alice = await db.createNode({
        type: "Person",
        name: "Alice",
      });

      const bob = await db.createNode({
        type: "Person",
        name: "Bob",
      });

      const charlie = await db.createNode({
        type: "Person",
        name: "Charlie",
      });

      await db.createRelationship(alice.id, bob.id, "KNOWS");
      await db.createRelationship(bob.id, charlie.id, "KNOWS");
      await db.createRelationship(alice.id, charlie.id, "WORKS_WITH");

      const knowsRelationships = await db.findRelationships({ type: "KNOWS" });
      expect(knowsRelationships).toHaveLength(2);
      expect(knowsRelationships.every((r) => r.type === "KNOWS")).toBe(true);
    });
  });

  describe("图查询", () => {
    it("应该能找到最短路径", async () => {
      const alice = await db.createNode({
        type: "Person",
        name: "Alice",
      });

      const bob = await db.createNode({
        type: "Person",
        name: "Bob",
      });

      const charlie = await db.createNode({
        type: "Person",
        name: "Charlie",
      });

      await db.createRelationship(alice.id, bob.id, "KNOWS");
      await db.createRelationship(bob.id, charlie.id, "KNOWS");

      const path = await db.findShortestPath(alice.id, charlie.id, "KNOWS");
      expect(path).toBeDefined();
      expect(path?.nodes).toHaveLength(3);
      expect(path?.length).toBe(2);
    });

    it("应该能进行模式匹配", async () => {
      const alice = await db.createNode({
        type: "Person",
        name: "Alice",
      });

      const bob = await db.createNode({
        type: "Person",
        name: "Bob",
      });

      const techCorp = await db.createNode({
        type: "Company",
        name: "Tech Corp",
      });

      await db.createRelationship(alice.id, techCorp.id, "WORKS_AT");
      await db.createRelationship(bob.id, techCorp.id, "WORKS_AT");

      const results = await db.matchPattern({
        nodeType: "Person",
        relationshipType: "WORKS_AT",
        targetType: "Company",
      });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.source.type === "Person")).toBe(true);
      expect(results.every((r) => r.target.type === "Company")).toBe(true);
      expect(results.every((r) => r.relationship.type === "WORKS_AT")).toBe(
        true
      );
    });
  });

  describe("错误处理", () => {
    it("获取不存在的节点应该返回null", async () => {
      const node = await db.getNodeById(999);
      expect(node).toBeNull();
    });

    it("获取不存在的关系应该返回null", async () => {
      const relationship = await db.getRelationshipById(999);
      expect(relationship).toBeNull();
    });

    it("创建关系时使用不存在的节点ID应该抛出错误", async () => {
      await expect(
        db.createRelationship(999, 1000, "INVALID")
      ).rejects.toThrow();
    });
  });
});
