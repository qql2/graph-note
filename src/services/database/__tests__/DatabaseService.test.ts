import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DatabaseService } from "../DatabaseService";
import fs from "fs";
import path from "path";
import os from "os";

describe("DatabaseService", () => {
  const testDir = path.join(os.tmpdir(), "graph-note-test");
  const testDbPath = path.join(testDir, "graph-note.db");

  beforeAll(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // 清理测试目录
    const service = DatabaseService.getInstance();
    service.close();

    // 等待一段时间确保连接完全关闭
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn("清理测试文件时出错:", error);
    }
  });

  describe("单例模式", () => {
    it("应该返回相同的实例", () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("数据操作", () => {
    let service: DatabaseService;

    beforeAll(() => {
      service = DatabaseService.getInstance();
    });

    beforeEach(async () => {
      // 清理数据库
      await service.clearDatabase();
    });

    it("应该能创建和获取节点", async () => {
      const node = await service.createNode({
        type: "Note",
        title: "Test Note",
        content: "This is a test note",
      });

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.type).toBe("Note");
      expect(node.title).toBe("Test Note");
      expect(node.content).toBe("This is a test note");

      const retrieved = await service.getNodeById(node.id);
      expect(retrieved).toEqual(node);
    });

    it("应该能创建和获取关系", async () => {
      const note1 = await service.createNode({
        type: "Note",
        title: "Note 1",
      });

      const note2 = await service.createNode({
        type: "Note",
        title: "Note 2",
      });

      const relationship = await service.createRelationship(
        note1.id,
        note2.id,
        "REFERENCES",
        { description: "Note 1 references Note 2" }
      );

      expect(relationship).toBeDefined();
      expect(relationship.sourceId).toBe(note1.id);
      expect(relationship.targetId).toBe(note2.id);
      expect(relationship.type).toBe("REFERENCES");
      expect(relationship.description).toBe("Note 1 references Note 2");

      const retrieved = await service.getRelationshipById(relationship.id);
      expect(retrieved).toEqual(relationship);
    });

    it("应该能查找特定类型的节点", async () => {
      await service.createNode({
        type: "Note",
        title: "Note 3",
      });

      await service.createNode({
        type: "Tag",
        name: "Test Tag",
      });

      const notes = await service.findNodes({ type: "Note" });
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.every((n) => n.type === "Note")).toBe(true);

      const tags = await service.findNodes({ type: "Tag" });
      expect(tags.length).toBe(1);
      expect(tags[0].type).toBe("Tag");
    });

    it("应该能查找特定类型的关系", async () => {
      const note1 = await service.createNode({
        type: "Note",
        title: "Note 4",
      });

      const note2 = await service.createNode({
        type: "Note",
        title: "Note 5",
      });

      const tag = await service.createNode({
        type: "Tag",
        name: "Test Tag 2",
      });

      await service.createRelationship(note1.id, note2.id, "REFERENCES");
      await service.createRelationship(note1.id, tag.id, "HAS_TAG");

      const references = await service.findRelationships({
        type: "REFERENCES",
      });
      expect(references.length).toBeGreaterThan(0);
      expect(references.every((r) => r.type === "REFERENCES")).toBe(true);

      const tags = await service.findRelationships({ type: "HAS_TAG" });
      expect(tags.length).toBe(1);
      expect(tags[0].type).toBe("HAS_TAG");
    });

    it("应该能找到最短路径", async () => {
      const note1 = await service.createNode({
        type: "Note",
        title: "Start Note",
      });

      const note2 = await service.createNode({
        type: "Note",
        title: "Middle Note",
      });

      const note3 = await service.createNode({
        type: "Note",
        title: "End Note",
      });

      await service.createRelationship(note1.id, note2.id, "REFERENCES");
      await service.createRelationship(note2.id, note3.id, "REFERENCES");

      const path = await service.findShortestPath(
        note1.id,
        note3.id,
        "REFERENCES"
      );
      expect(path).toBeDefined();
      expect(path?.nodes).toHaveLength(3);
      expect(path?.length).toBe(2);
    });

    it("应该能进行模式匹配", async () => {
      const note = await service.createNode({
        type: "Note",
        title: "Tagged Note",
      });

      const tag = await service.createNode({
        type: "Tag",
        name: "Pattern Test Tag",
      });

      await service.createRelationship(note.id, tag.id, "HAS_TAG");

      const results = await service.matchPattern({
        nodeType: "Note",
        relationshipType: "HAS_TAG",
        targetType: "Tag",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.source.type === "Note")).toBe(true);
      expect(results.every((r) => r.target.type === "Tag")).toBe(true);
      expect(results.every((r) => r.relationship.type === "HAS_TAG")).toBe(
        true
      );
    });
  });
});
