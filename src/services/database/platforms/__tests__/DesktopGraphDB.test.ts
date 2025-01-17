import { test, expect } from "@playwright/test";
import { _electron as electron } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";
import { GraphNode } from "../../core/types";
import { databaseService, DatabaseService } from "../../DatabaseService";

// 扩展 Playwright 的 Window 类型
declare global {
  interface Window {
    electronAPI: {
      database: {
        query: (sql: string, params?: any[]) => Promise<any>;
        backup: () => Promise<string>;
        restore: (backupPath: string) => Promise<void>;
        listBackups: () => Promise<string[]>;
      };
    };
  }
}

// 扩展 Playwright 的 Page 类型
declare module "@playwright/test" {
  interface Page {
    electronAPI: Window["electronAPI"];
  }
}

test.describe("DesktopGraphDB", () => {
  let electronApp: Awaited<ReturnType<typeof electron.launch>>;
  let tempDir: string;
  let dbPath: string;

  test.beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = path.join(
      os.tmpdir(),
      "graph-note-test-" + Math.random().toString(36).slice(2)
    );
    fs.mkdirSync(tempDir, { recursive: true });
    dbPath = path.join(tempDir, "test.db");

    // 启动 Electron 应用
    electronApp = await electron.launch({
      args: ["."],
      env: {
        ...process.env,
        ELECTRON_ENABLE_LOGGING: "true",
        ELECTRON_ENABLE_STACK_DUMPING: "true",
        NODE_ENV: "test",
        TEST_DB_PATH: dbPath,
      },
    });

    // 初始化数据库表
    const window = await electronApp.firstWindow();
    
    await window.evaluate(async () => {
      const { database } = window.electronAPI;
      
      // 创建节点表
      await database.query(`
        CREATE TABLE IF NOT EXISTS nodes (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          label TEXT NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // 创建节点属性表
      await database.query(`
        CREATE TABLE IF NOT EXISTS node_properties (
          node_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
          PRIMARY KEY (node_id, key)
        )
      `);

      // 创建关系表
      await database.query(`
        CREATE TABLE IF NOT EXISTS relationships (
          id TEXT PRIMARY KEY,
          source_id TEXT,
          target_id TEXT,
          type TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
        )
      `);

      // 创建关系属性表
      await database.query(`
        CREATE TABLE IF NOT EXISTS relationship_properties (
          relationship_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
          PRIMARY KEY (relationship_id, key)
        )
      `);

      // 创建索引
      await database.query(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`);
      await database.query(`CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type)`);
      await database.query(`CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id)`);
      await database.query(`CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id)`);
    });
  });

  test.afterEach(async () => {
    const window = await electronApp.firstWindow();
    
    // 清理数据库
    await window.evaluate(async () => {
      const { database } = window.electronAPI;
      await database.query("DROP TABLE IF EXISTS relationship_properties");
      await database.query("DROP TABLE IF EXISTS relationships");
      await database.query("DROP TABLE IF EXISTS node_properties");
      await database.query("DROP TABLE IF EXISTS nodes");
    });

    // 关闭应用
    await electronApp.close();

    // 清理测试文件
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("should create and retrieve nodes", async () => {
    const window = await electronApp.firstWindow();
    const testNode: Omit<GraphNode, "created_at" | "updated_at"> = {
      id: "test-node",
      type: "test",
      label: "Test Node",
      x: 100,
      y: 100,
      properties: { key: "value" },
    };

    // 添加节点
    const addNodeResult = await window.evaluate(async (node: typeof testNode) => {
      const { database } = window.electronAPI;
      await database.query(`
        INSERT INTO nodes (id, type, label, x, y, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [node.id, node.type, node.label, node.x, node.y]);

      if (node.properties) {
        for (const [key, value] of Object.entries(node.properties)) {
          await database.query(`
            INSERT INTO node_properties (node_id, key, value)
            VALUES (?, ?, ?)
          `, [node.id, key, JSON.stringify(value)]);
        }
      }
      return node.id;
    }, testNode);

    // 获取节点
    const nodes = await window.evaluate(async () => {
      const { database } = window.electronAPI;
      return await database.query(`
        SELECT 
          n.*,
          (
            SELECT json_group_object(key, value)
            FROM node_properties
            WHERE node_id = n.id
          ) as props
        FROM nodes n
      `);
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: testNode.id,
      type: testNode.type,
      label: testNode.label,
      x: testNode.x,
      y: testNode.y,
    });
  });

  test("should handle backup operations", async () => {
    const window = await electronApp.firstWindow();

    // 创建备份
    const backupPath = await window.evaluate(async () => {
      return await window.electronAPI.database.backup();
    });

    expect(fs.existsSync(backupPath)).toBe(true);

    // 列出备份
    const backups = await window.evaluate(async () => {
      return await window.electronAPI.database.listBackups();
    });

    expect(backups).toContain(backupPath);

    // 恢复备份
    await window.evaluate(async (path: string) => {
      await window.electronAPI.database.restore(path);
    }, backupPath);
  });

  test("should handle errors gracefully", async () => {
    const window = await electronApp.firstWindow();

    // 测试无效的备份恢复
    const restorePromise = window.evaluate(async () => {
      try {
        await window.electronAPI.database.restore("non-existent-backup");
      } catch (error: unknown) {
        if (error instanceof Error) {
          return error.message;
        }
        return String(error);
      }
    });

    const errorMessage = await restorePromise;
    expect(errorMessage).toContain("DatabaseError: Backup file not found");
  });
});
