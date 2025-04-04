import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BaseGraphDB } from "../core/BaseGraphDB";
import { GraphNode, GraphEdge, DatabaseConfig, SQLiteEngine, DeleteMode } from "../core/types";
import { DatabaseError, NodeNotFoundError, EdgeNotFoundError } from "../core/errors";
import "./setup";

// 创建BaseGraphDB的具体实现用于测试
class TestGraphDB extends BaseGraphDB {
  private mockEngine: SQLiteEngine | null = null;

  constructor(mockEngine?: SQLiteEngine) {
    super();
    if (mockEngine) {
      this.mockEngine = mockEngine;
    }
  }

  protected async createEngine(_config: DatabaseConfig): Promise<SQLiteEngine> {
    if (this.mockEngine) {
      return this.mockEngine;
    }

    return {
      query: vi.fn().mockImplementation(function(sql: string, params?: any[]) {
        if (sql.includes("SELECT * FROM nodes")) {
          return {
            values: [
              {
                id: "node1",
                type: "person",
                label: "张三",
                x: 100,
                y: 200,
                created_at: "2023-01-01",
                updated_at: "2023-01-01"
              }
            ]
          };
        } else if (sql.includes("SELECT key, value FROM node_properties")) {
          return {
            values: [
              { key: "age", value: "30" },
              { key: "occupation", value: "\"软件工程师\"" }
            ]
          };
        } else if (sql.includes("SELECT * FROM relationships")) {
          return {
            values: [
              {
                id: "edge1",
                source_id: "node1",
                target_id: "node2",
                type: "friend",
                created_at: "2023-01-01"
              }
            ]
          };
        } else if (sql.includes("SELECT key, value FROM relationship_properties")) {
          return {
            values: [
              { key: "since", value: "\"2020-01-01\"" }
            ]
          };
        } else if (sql.includes("SELECT 1 FROM")) {
          return {
            values: [{ "1": 1 }]
          };
        }
        return { values: [] };
      }),
      run: vi.fn(),
      isOpen: vi.fn().mockReturnValue(true),
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      export: vi.fn().mockReturnValue(new Uint8Array(0)),
      transaction: vi.fn().mockImplementation(async (operation) => {
        return await operation();
      }),
    };
  }

  protected async persistData(): Promise<void> {
    // 在测试实现中不需要实际持久化数据
    return Promise.resolve();
  }
}

describe("BaseGraphDB", () => {
  let db: TestGraphDB;
  
  beforeEach(async () => {
    db = new TestGraphDB();
    await db.initialize({});
  });
  
  afterEach(async () => {
    await db.close();
    vi.clearAllMocks();
  });
  
  describe("基本数据库操作", () => {
    it("应该成功初始化数据库", async () => {
      const newDb = new TestGraphDB();
      await newDb.initialize({});
      expect((newDb as any).initialized).toBe(true);
      expect((newDb as any).db).not.toBeNull();
    });
    
    it("初始化两次不应该重复设置", async () => {
      const createEngineSpy = vi.spyOn(db as any, "createEngine");
      await db.initialize({}); // 第二次调用
      expect(createEngineSpy).not.toHaveBeenCalled();
    });
    
    it("应该成功关闭数据库", async () => {
      await db.close();
      expect((db as any).db).toBeNull();
      expect((db as any).initialized).toBe(false);
    });
  });
  
  describe("事务操作", () => {
    it("应该使用数据库的事务API执行操作", async () => {
      const mockRun = vi.fn();
      const mockTransaction = vi.fn().mockImplementation(async (operation) => {
        return await operation();
      });
      
      const mockDb = {
        query: vi.fn(),
        run: mockRun,
        isOpen: vi.fn().mockReturnValue(true),
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
        export: vi.fn().mockReturnValue(new Uint8Array(0)),
        transaction: mockTransaction,
      };
      
      // 创建一个新的实例，使用我们的自定义mock
      const testDb = new TestGraphDB(mockDb);
      await testDb.initialize({});
      
      const persistDataSpy = vi.spyOn(testDb as any, "persistData");
      
      await (testDb as any).withTransaction(async () => {
        await mockDb.run("INSERT INTO test_table VALUES (1)");
        return true;
      });
      
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
      expect(persistDataSpy).toHaveBeenCalled();
    });
    
    it("应该处理事务中的错误", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (operation) => {
        try {
          return await operation();
        } catch (error) {
          throw error;
        }
      });
      
      const mockDb = {
        query: vi.fn(),
        run: vi.fn().mockRejectedValue(new Error("测试DB错误")),
        isOpen: vi.fn().mockReturnValue(true),
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
        export: vi.fn().mockReturnValue(new Uint8Array(0)),
        transaction: mockTransaction,
      };
      
      // 创建一个新的实例，使用我们的自定义mock
      const testDb = new TestGraphDB(mockDb);
      await testDb.initialize({});
      
      // 操作将抛出错误
      await expect((testDb as any).withTransaction(async () => {
        await mockDb.run("INSERT INTO test_table VALUES (1)");
        return true;
      })).rejects.toThrow();
      
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockDb.run).toHaveBeenCalled();
    });
    
    it("应该能够支持兼容性的事务方法", async () => {
      // 测试传统的事务方法是否仍然可用
      const beginTransactionSpy = vi.spyOn(db as any, "beginTransaction");
      const commitTransactionSpy = vi.spyOn(db as any, "commitTransaction");
      const rollbackTransactionSpy = vi.spyOn(db as any, "rollbackTransaction");
      
      // 手动开始和提交事务
      await (db as any).beginTransaction();
      await (db as any).commitTransaction();
      
      expect(beginTransactionSpy).toHaveBeenCalled();
      expect(commitTransactionSpy).toHaveBeenCalled();
      
      // 测试回滚
      await (db as any).beginTransaction();
      await (db as any).rollbackTransaction();
      
      expect(rollbackTransactionSpy).toHaveBeenCalled();
    });
  });
  
  describe("节点操作", () => {
    it("应该添加节点", async () => {
      const runSpy = vi.spyOn((db as any).db, "run");
      
      const node: GraphNode = {
        type: "person",
        label: "测试用户",
        x: 100,
        y: 200,
        properties: {
          age: 30,
          occupation: "工程师"
        }
      };
      
      const id = await db.addNode(node);
      expect(id).toBeDefined();
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO nodes"),
        expect.arrayContaining([id, "person", "测试用户", 100, 200])
      );
    });
    
    it("应该更新节点", async () => {
      const querySpy = vi.spyOn((db as any).db, "query");
      const runSpy = vi.spyOn((db as any).db, "run");
      
      await db.updateNode("node1", {
        label: "新名称",
        properties: {
          age: 31
        }
      });
      
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["node1"]
      );
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE nodes SET"),
        expect.arrayContaining(["新名称", expect.any(String), "node1"])
      );
    });
    
    it("删除不存在的节点应该抛出错误", async () => {
      const db2 = new TestGraphDB();
      await db2.initialize({});
      
      // 使用类型安全的方式创建和设置mock
      const queryMock = vi.fn().mockReturnValue({ values: [] });
      (db2 as any).db = {
        ...(db2 as any).db,
        query: queryMock
      };
      
      await expect(db2.deleteNode("not-exists")).rejects.toThrow(NodeNotFoundError);
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["not-exists"]
      );
    });
    
    it("应该级联删除节点", async () => {
      const runSpy = vi.spyOn((db as any).db, "run");
      
      await db.deleteNode("node1", DeleteMode.CASCADE);
      
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM relationship_properties"),
        expect.arrayContaining(["node1", "node1"])
      );
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM relationships"),
        expect.arrayContaining(["node1", "node1"])
      );
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM node_properties"),
        ["node1"]
      );
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM nodes"),
        ["node1"]
      );
    });
    
    it("应该保留连接删除节点", async () => {
      const runSpy = vi.spyOn((db as any).db, "run");
      
      await db.deleteNode("node1", DeleteMode.KEEP_CONNECTED);
      
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM node_properties"),
        ["node1"]
      );
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE relationships"),
        ["node1"]
      );
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM nodes"),
        ["node1"]
      );
    });
  });
  
  describe("边操作", () => {
    it("应该添加边", async () => {
      const runSpy = vi.spyOn((db as any).db, "run");
      
      const edge: GraphEdge = {
        source_id: "node1",
        target_id: "node2",
        type: "friend",
        properties: {
          since: "2023-01-01"
        }
      };
      
      const id = await db.addEdge(edge);
      expect(id).toBeDefined();
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO relationships"),
        expect.arrayContaining([id, "node1", "node2", "friend"])
      );
    });
    
    it("添加边时源节点不存在应该抛出错误", async () => {
      const db2 = new TestGraphDB();
      await db2.initialize({});
      
      // 使用类型安全的方式创建和设置mock
      const queryMock = vi.fn().mockImplementation(function(sql: string, params?: any[]) {
        if (sql.includes("SELECT 1 FROM nodes") && params?.[0] === "not-exists") {
          return { values: [] };
        }
        return { values: [{ "1": 1 }] };
      });
      
      (db2 as any).db = {
        ...(db2 as any).db,
        query: queryMock
      };
      
      const edge: GraphEdge = {
        source_id: "not-exists",
        target_id: "node2",
        type: "friend"
      };
      
      await expect(db2.addEdge(edge)).rejects.toThrow(NodeNotFoundError);
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["not-exists"]
      );
    });
    
    it("应该更新边", async () => {
      const runSpy = vi.spyOn((db as any).db, "run");
      
      await db.updateEdge("edge1", {
        type: "close_friend",
        properties: {
          since: "2023-01-01"
        }
      });
      
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE relationships SET"),
        expect.arrayContaining(["close_friend", "edge1"])
      );
    });
    
    it("删除不存在的边应该抛出错误", async () => {
      const db2 = new TestGraphDB();
      await db2.initialize({});
      
      // 使用类型安全的方式创建和设置mock
      const queryMock = vi.fn().mockReturnValue({ values: [] });
      (db2 as any).db = {
        ...(db2 as any).db,
        query: queryMock
      };
      
      await expect(db2.deleteEdge("not-exists")).rejects.toThrow(EdgeNotFoundError);
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM relationships"),
        ["not-exists"]
      );
    });
  });
  
  describe("查询操作", () => {
    it("应该查找连接的节点", async () => {
      const db2 = new TestGraphDB();
      await db2.initialize({});
      
      // 使用类型安全的方式创建和设置mock
      const queryMock = vi.fn().mockImplementation(function(sql: string, params?: any[]) {
        if (sql.includes("SELECT * FROM nodes")) {
          return {
            values: [
              {
                id: "node1",
                type: "person",
                label: "张三",
                x: 100,
                y: 200,
                created_at: "2023-01-01",
                updated_at: "2023-01-01"
              },
              {
                id: "node2",
                type: "person",
                label: "李四",
                x: 300,
                y: 200,
                created_at: "2023-01-01",
                updated_at: "2023-01-01"
              },
              {
                id: "node3",
                type: "project",
                label: "项目",
                x: 200,
                y: 100,
                created_at: "2023-01-01",
                updated_at: "2023-01-01"
              }
            ]
          };
        } else if (sql.includes("SELECT * FROM relationships")) {
          return {
            values: [
              {
                id: "edge1",
                source_id: "node1",
                target_id: "node3",
                type: "works_on",
                created_at: "2023-01-01"
              },
              {
                id: "edge2",
                source_id: "node2",
                target_id: "node3",
                type: "manages",
                created_at: "2023-01-01"
              }
            ]
          };
        } else if (sql.includes("SELECT 1 FROM")) {
          return { values: [{ "1": 1 }] };
        }
        return { values: [] };
      });
      
      (db2 as any).db = {
        ...(db2 as any).db,
        query: queryMock
      };
      
      const connectedNodes = await db2.findConnectedNodes("node1");
      expect(connectedNodes.length).toBeGreaterThan(0);
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["node1"]
      );
    });
    
    it("源节点不存在时查找路径应该抛出错误", async () => {
      const db2 = new TestGraphDB();
      await db2.initialize({});
      
      // 使用类型安全的方式创建和设置mock
      const queryMock = vi.fn().mockImplementation(function(sql: string, params?: any[]) {
        if (sql.includes("SELECT 1 FROM nodes") && params?.[0] === "not-exists") {
          return { values: [] };
        }
        return { values: [{ "1": 1 }] };
      });
      
      (db2 as any).db = {
        ...(db2 as any).db,
        query: queryMock
      };
      
      await expect(db2.findPath("not-exists", "node2")).rejects.toThrow(NodeNotFoundError);
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["not-exists"]
      );
    });
    
    it("目标节点不存在时查找路径应该抛出错误", async () => {
      const db2 = new TestGraphDB();
      await db2.initialize({});
      
      // 使用类型安全的方式创建和设置mock
      const queryMock = vi.fn().mockImplementation(function(sql: string, params?: any[]) {
        if (sql.includes("SELECT 1 FROM nodes") && params?.[0] === "not-exists") {
          return { values: [] };
        }
        return { values: [{ "1": 1 }] };
      });
      
      (db2 as any).db = {
        ...(db2 as any).db,
        query: queryMock
      };
      
      await expect(db2.findPath("node1", "not-exists")).rejects.toThrow(NodeNotFoundError);
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["not-exists"]
      );
    });
  });
  
  describe("抽象方法", () => {
    it("importData应该抛出错误", async () => {
      await expect(db.importData(new Uint8Array(0))).rejects.toThrow(DatabaseError);
    });
    
    it("createBackup应该抛出错误", async () => {
      await expect(db.createBackup()).rejects.toThrow(DatabaseError);
    });
    
    it("restoreFromBackup应该抛出错误", async () => {
      await expect(db.restoreFromBackup("backup-id")).rejects.toThrow(DatabaseError);
    });
    
    it("listBackups应该抛出错误", async () => {
      await expect(db.listBackups()).rejects.toThrow(DatabaseError);
    });
  });
}); 