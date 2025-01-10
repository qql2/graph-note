import { DesktopGraphDB } from "../DesktopGraphDB";
import { GraphNode } from "../../core/types";
import fs from "fs";
import path from "path";
import os from "os";

describe("DesktopGraphDB", () => {
  let db: DesktopGraphDB;
  let dbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = path.join(
      os.tmpdir(),
      "graph-note-test-" + Math.random().toString(36).slice(2)
    );
    fs.mkdirSync(tempDir, { recursive: true });
    dbPath = path.join(tempDir, "test.db");

    db = new DesktopGraphDB();
    await db.initialize({
      platform: "desktop",
      storage_path: dbPath,
    });
  });

  afterEach(async () => {
    await db.close();
    // 清理测试文件
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Basic Operations", () => {
    it("should create and retrieve nodes", async () => {
      const node: Omit<GraphNode, "created_at" | "updated_at"> = {
        id: "test-node",
        type: "test",
        label: "Test Node",
        x: 100,
        y: 100,
        properties: { key: "value" },
      };

      await db.addNode(node);
      const nodes = await db.getNodes();

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        ...node,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it("should update nodes", async () => {
      const node: Omit<GraphNode, "created_at" | "updated_at"> = {
        id: "test-node",
        type: "test",
        label: "Test Node",
        x: 100,
        y: 100,
        properties: { key: "value" },
      };

      await db.addNode(node);
      await db.updateNode("test-node", {
        label: "Updated Node",
        properties: { key: "new-value" },
      });

      const nodes = await db.getNodes();
      expect(nodes[0].label).toBe("Updated Node");
      expect(nodes[0].properties.key).toBe("new-value");
    });
  });

  describe("Backup Operations", () => {
    it("should create and restore backups", async () => {
      // 添加一些测试数据
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
      expect(fs.existsSync(backupId)).toBe(true);

      // 修改数据
      await db.updateNode("test-node", { label: "Modified Node" });
      let nodes = await db.getNodes();
      expect(nodes[0].label).toBe("Modified Node");

      // 恢复备份
      await db.restoreFromBackup(backupId);
      nodes = await db.getNodes();
      expect(nodes[0].label).toBe("Test Node");
    });

    it("should list backups", async () => {
      // 创建多个备份
      const backupId1 = await db.createBackup();
      const backupId2 = await db.createBackup();

      const backups = await db.listBackups();
      expect(backups).toHaveLength(2);
      expect(backups).toContain(backupId1);
      expect(backups).toContain(backupId2);
      // 确保按时间倒序排列
      expect(backups[0]).toBe(backupId2);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid backup restoration", async () => {
      await expect(db.restoreFromBackup("non-existent-backup")).rejects.toThrow(
        "Backup not found"
      );
    });

    it("should handle database initialization without storage path", async () => {
      const newDb = new DesktopGraphDB();
      await expect(newDb.initialize({ platform: "desktop" })).rejects.toThrow(
        "storage_path is required for desktop platform"
      );
    });
  });
});
