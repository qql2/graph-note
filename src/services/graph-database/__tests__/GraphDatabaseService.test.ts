import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import graphDatabaseService from "../GraphDatabaseService";
import { SQLiteGraphDB } from "../platforms/SQLiteGraphDB";
import "./setup";

// 模拟SQLiteGraphDB
vi.mock("../platforms/SQLiteGraphDB", () => {
  return {
    SQLiteGraphDB: vi.fn().mockImplementation(() => {
      return {
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        addNode: vi.fn().mockImplementation(async (node) => {
          return node.id || "generated-id";
        }),
        getNodes: vi.fn().mockResolvedValue([
          {
            id: "node1",
            type: "person",
            label: "测试用户",
            x: 100,
            y: 200,
            properties: { age: 30 }
          }
        ]),
        addEdge: vi.fn().mockImplementation(async (edge) => {
          return edge.id || "generated-edge-id";
        }),
        getEdges: vi.fn().mockResolvedValue([
          {
            id: "edge1",
            source_id: "node1",
            target_id: "node2",
            type: "friend",
            properties: { since: "2023-01-01" }
          }
        ]),
      };
    })
  };
});

describe("GraphDatabaseService", () => {
  beforeEach(async () => {
    // 重置模拟
    vi.clearAllMocks();
    
    // 确保graphDatabaseService是新的实例
    (graphDatabaseService as any).initialized = false;
    (graphDatabaseService as any).db = new SQLiteGraphDB();
  });

  afterEach(async () => {
    // 清理
    await graphDatabaseService.closeDatabase();
  });

  describe("初始化", () => {
    it("应该用默认配置初始化数据库", async () => {
      await graphDatabaseService.initialize();
      
      const mockDb = (graphDatabaseService as any).db;
      expect(mockDb.initialize).toHaveBeenCalledWith(expect.objectContaining({
        dbName: "graph_database",
        version: 1
      }));
    });

    it("应该用自定义配置初始化数据库", async () => {
      const customConfig = {
        dbName: "custom_db",
        version: 2,
        verbose: true
      };
      
      await graphDatabaseService.initialize(customConfig);
      
      const mockDb = (graphDatabaseService as any).db;
      expect(mockDb.initialize).toHaveBeenCalledWith(expect.objectContaining(customConfig));
    });

    it("应该仅初始化一次数据库", async () => {
      await graphDatabaseService.initialize();
      await graphDatabaseService.initialize(); // 第二次调用
      
      const mockDb = (graphDatabaseService as any).db;
      expect(mockDb.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe("数据库操作", () => {
    beforeEach(async () => {
      await graphDatabaseService.initialize();
    });

    it("应该获取数据库实例", () => {
      const db = graphDatabaseService.getDatabase();
      expect(db).toBeDefined();
    });

    it("应该在未初始化时发出警告", () => {
      // 模拟console.warn
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      // 将initialized设为false
      (graphDatabaseService as any).initialized = false;
      
      graphDatabaseService.getDatabase();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Database accessed before initialization"));
      
      // 清理
      consoleWarnSpy.mockRestore();
    });

    it("应该关闭数据库", async () => {
      await graphDatabaseService.closeDatabase();
      
      const mockDb = (graphDatabaseService as any).db;
      expect(mockDb.close).toHaveBeenCalled();
      expect((graphDatabaseService as any).initialized).toBe(false);
    });

    it("应该执行数据库操作", async () => {
      const db = graphDatabaseService.getDatabase();
      
      // 测试添加节点
      const nodeId = await db.addNode({
        type: "person",
        label: "测试用户",
        x: 100,
        y: 200
      });
      
      expect(nodeId).toBeDefined();
      
      // 测试获取节点
      const nodes = await db.getNodes();
      expect(nodes).toHaveLength(1);
      
      // 测试添加边
      const edgeId = await db.addEdge({
        source_id: "node1",
        target_id: "node2",
        type: "friend"
      });
      
      expect(edgeId).toBeDefined();
      
      // 测试获取边
      const edges = await db.getEdges();
      expect(edges).toHaveLength(1);
    });
  });
}); 