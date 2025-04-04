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
      exec: vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes("SELECT * FROM nodes")) {
          return [
            ["node1", "person", "张三", 100, 200, "2023-01-01", "2023-01-01"]
          ];
        } else if (sql.includes("SELECT key, value FROM node_properties")) {
          return [
            ["age", "30"],
            ["occupation", "\"软件工程师\""]
          ];
        } else if (sql.includes("SELECT * FROM relationships")) {
          return [
            ["edge1", "node1", "node2", "friend", "2023-01-01"]
          ];
        } else if (sql.includes("SELECT key, value FROM relationship_properties")) {
          return [
            ["since", "\"2020-01-01\""]
          ];
        } else if (sql.includes("SELECT 1 FROM")) {
          return [["1"]];
        }
        return [];
      }),
      prepare: vi.fn(),
      run: vi.fn(),
      isOpen: vi.fn().mockReturnValue(true),
      close: vi.fn(),
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
    it("应该在事务中执行操作", async () => {
      const mockRun = vi.fn();
      const mockDb = {
        exec: vi.fn(),
        prepare: vi.fn(),
        run: mockRun,
        isOpen: vi.fn().mockReturnValue(true),
        close: vi.fn(),
        export: vi.fn().mockReturnValue(new Uint8Array(0)),
        transaction: vi.fn().mockImplementation(async (operation) => {
          return await operation();
        }),
      };
      
      // 创建一个新的实例，使用我们的自定义mock
      const testDb = new TestGraphDB(mockDb);
      await testDb.initialize({});
      
      // 测试事务方法
      const beginTransactionSpy = vi.spyOn(testDb as any, "beginTransaction");
      const commitTransactionSpy = vi.spyOn(testDb as any, "commitTransaction");
      const rollbackTransactionSpy = vi.spyOn(testDb as any, "rollbackTransaction");
      
      await (testDb as any).withTransaction(async () => {
        await mockDb.run("INSERT INTO test_table VALUES (1)");
        return true;
      });
      
      expect(beginTransactionSpy).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
      expect(commitTransactionSpy).toHaveBeenCalled();
      expect(rollbackTransactionSpy).not.toHaveBeenCalled();
    });
    
    it("应该在事务失败时回滚", async () => {
      const mockRun = vi.fn();
      const mockDb = {
        exec: vi.fn(),
        prepare: vi.fn(),
        run: mockRun,
        isOpen: vi.fn().mockReturnValue(true),
        close: vi.fn(),
        export: vi.fn().mockReturnValue(new Uint8Array(0)),
        transaction: vi.fn().mockImplementation(async (operation) => {
          return await operation();
        }),
      };
      
      // 创建一个新的实例，使用我们的自定义mock
      const testDb = new TestGraphDB(mockDb);
      await testDb.initialize({});
      
      // 测试事务方法
      const beginTransactionSpy = vi.spyOn(testDb as any, "beginTransaction");
      const commitTransactionSpy = vi.spyOn(testDb as any, "commitTransaction");
      const rollbackTransactionSpy = vi.spyOn(testDb as any, "rollbackTransaction");
      
      // 操作将抛出错误
      await expect((testDb as any).withTransaction(async () => {
        throw new Error("测试错误");
      })).rejects.toThrow("测试错误");
      
      expect(beginTransactionSpy).toHaveBeenCalled();
      expect(commitTransactionSpy).not.toHaveBeenCalled();
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
      const execSpy = vi.spyOn((db as any).db, "exec");
      const runSpy = vi.spyOn((db as any).db, "run");
      
      await db.updateNode("node1", {
        label: "新名称",
        properties: {
          age: 31
        }
      });
      
      expect(execSpy).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["node1"]
      );
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE nodes SET"),
        expect.arrayContaining(["新名称", expect.any(String), "node1"])
      );
    });
    
    it("删除不存在的节点应该抛出错误", async () => {
      const execSpy = vi.spyOn((db as any).db, "exec");
      execSpy.mockReturnValue([]);
      
      await expect(db.deleteNode("not-exists")).rejects.toThrow(NodeNotFoundError);
      expect(execSpy).toHaveBeenCalledWith(
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
      const execSpy = vi.spyOn((db as any).db, "exec");
      execSpy.mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes("SELECT 1 FROM nodes") && params?.[0] === "not-exists") {
          return [];
        }
        return [["1"]];
      });
      
      const edge: GraphEdge = {
        source_id: "not-exists",
        target_id: "node2",
        type: "friend"
      };
      
      await expect(db.addEdge(edge)).rejects.toThrow(NodeNotFoundError);
      expect(execSpy).toHaveBeenCalledWith(
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
      const execSpy = vi.spyOn((db as any).db, "exec");
      execSpy.mockReturnValue([]);
      
      await expect(db.deleteEdge("not-exists")).rejects.toThrow(EdgeNotFoundError);
      expect(execSpy).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM relationships"),
        ["not-exists"]
      );
    });
  });
  
  describe("查询操作", () => {
    it("应该查找连接的节点", async () => {
      const execSpy = vi.spyOn((db as any).db, "exec");
      execSpy.mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes("SELECT * FROM nodes")) {
          return [
            ["node1", "person", "张三", 100, 200, "2023-01-01", "2023-01-01"],
            ["node2", "person", "李四", 300, 200, "2023-01-01", "2023-01-01"],
            ["node3", "project", "项目", 200, 100, "2023-01-01", "2023-01-01"]
          ];
        } else if (sql.includes("SELECT * FROM relationships")) {
          return [
            ["edge1", "node1", "node3", "works_on", "2023-01-01"],
            ["edge2", "node2", "node3", "manages", "2023-01-01"]
          ];
        } else if (sql.includes("SELECT 1 FROM")) {
          return [["1"]];
        }
        return [];
      });
      
      const connectedNodes = await db.findConnectedNodes("node1");
      expect(connectedNodes).toHaveLength(1);
      expect(connectedNodes[0].id).toBe("node3");
      expect(execSpy).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["node1"]
      );
    });
    
    it("源节点不存在时查找路径应该抛出错误", async () => {
      const execSpy = vi.spyOn((db as any).db, "exec");
      execSpy.mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes("SELECT 1 FROM nodes") && params?.[0] === "not-exists") {
          return [];
        }
        return [["1"]];
      });
      
      await expect(db.findPath("not-exists", "node2")).rejects.toThrow(NodeNotFoundError);
      expect(execSpy).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["not-exists"]
      );
    });
    
    it("目标节点不存在时查找路径应该抛出错误", async () => {
      const execSpy = vi.spyOn((db as any).db, "exec");
      execSpy.mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes("SELECT 1 FROM nodes") && params?.[0] === "not-exists") {
          return [];
        }
        return [["1"]];
      });
      
      await expect(db.findPath("node1", "not-exists")).rejects.toThrow(NodeNotFoundError);
      expect(execSpy).toHaveBeenCalledWith(
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