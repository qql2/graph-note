import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SQLiteGraphDB } from "../platforms/SQLiteGraphDB";
import { GraphNode, GraphEdge, DeleteMode } from "../core/types";
import sqliteService from "../../sqliteService";
import "./setup";

// Access the mocked connection through the module's mock implementation
let mockConnection: any;

// Create a direct mock for the sqliteService
vi.mock("../../sqliteService", () => {
  mockConnection = {
    query: vi.fn(),
    run: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    isDBOpen: vi.fn().mockResolvedValue(true),
  };

  return {
    default: {
      getPlatform: vi.fn().mockReturnValue("web"),
      initWebStore: vi.fn().mockResolvedValue(undefined),
      openDatabase: vi.fn().mockResolvedValue(mockConnection),
      closeDatabase: vi.fn().mockResolvedValue(undefined),
      saveToStore: vi.fn().mockResolvedValue(undefined),
      saveToLocalDisk: vi.fn().mockResolvedValue(undefined),
      isConnection: vi.fn().mockResolvedValue({ result: true }),
      transaction: vi.fn().mockImplementation(async (_, cb) => {
        return await cb(mockConnection);
      }),
    },
  };
});

describe("SQLiteGraphDB", () => {
  let db: SQLiteGraphDB;

  beforeEach(async () => {
    // 清理模拟状态
    vi.clearAllMocks();
    
    // 为了测试getNodes，我们预设query的返回值
    mockConnection.query.mockImplementation((sql: string) => {
      if (sql.includes("SELECT * FROM nodes")) {
        return {
          values: [
            // id, type, label, x, y, created_at, updated_at
            ["node1", "person", "张三", 100, 200, "2023-01-01", "2023-01-01"],
          ]
        };
      } else if (sql.includes("SELECT key, value FROM node_properties")) {
        return {
          values: [
            ["age", "30"],
            ["occupation", "\"软件工程师\""]
          ]
        };
      } else if (sql.includes("SELECT * FROM relationships")) {
        return {
          values: [
            // id, source_id, target_id, type, created_at
            ["edge1", "node1", "node2", "friend", "2023-01-01"]
          ]
        };
      } else if (sql.includes("SELECT key, value FROM relationship_properties")) {
        return {
          values: [
            ["since", "\"2020-01-01\""]
          ]
        };
      } else if (sql.includes("SELECT 1 FROM")) {
        // 用于检查节点或边是否存在
        return {
          values: [["1"]]
        };
      }
      return { values: [] };
    });

    db = new SQLiteGraphDB();
    await db.initialize({
      dbName: "test_graph_db",
      version: 1,
      verbose: true
    });
  });

  afterEach(async () => {
    await db.close();
  });

  describe("初始化和关闭", () => {
    it("应该正确初始化数据库", async () => {
      expect(sqliteService.openDatabase).toHaveBeenCalledWith(
        "test_graph_db", 1, false
      );
      expect(mockConnection.run).toHaveBeenCalled();
    });

    it("应该正确关闭数据库", async () => {
      await db.close();
      expect(sqliteService.closeDatabase).toHaveBeenCalledWith("test_graph_db", false);
    });
  });

  describe("节点操作", () => {
    it("应该创建节点", async () => {
      const node: Omit<GraphNode, "created_at" | "updated_at"> = {
        id: "test-node",
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
      expect(id).toBe("test-node");
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO nodes"),
        expect.arrayContaining([id, "person", "测试用户", 100, 200])
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO node_properties"),
        expect.arrayContaining([id, "age", expect.any(String)])
      );
    });

    it("应该读取所有节点", async () => {
      const nodes = await db.getNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        id: "node1",
        type: "person",
        label: "张三",
        x: 100,
        y: 200,
        properties: {
          age: 30,
          occupation: "软件工程师"
        }
      });
    });

    it("应该更新节点", async () => {
      await db.updateNode("node1", {
        label: "新名字",
        properties: {
          age: 31,
          skills: ["编程", "设计"]
        }
      });

      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE nodes SET"),
        expect.arrayContaining(["新名字", expect.any(String), "node1"])
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM node_properties"),
        ["node1"]
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO node_properties"),
        expect.arrayContaining(["node1", "age", "31"])
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO node_properties"),
        expect.arrayContaining(["node1", "skills", expect.stringContaining("[\"编程\",\"设计\"]")])
      );
    });

    it("应该删除节点（级联删除模式）", async () => {
      await db.deleteNode("node1", DeleteMode.CASCADE);
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM relationship_properties"),
        expect.arrayContaining(["node1", "node1"])
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM relationships"),
        expect.arrayContaining(["node1", "node1"])
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM node_properties"),
        ["node1"]
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM nodes"),
        ["node1"]
      );
    });
  });

  describe("边操作", () => {
    it("应该创建边", async () => {
      const edge: Omit<GraphEdge, "created_at"> = {
        id: "test-edge",
        source_id: "node1",
        target_id: "node2",
        type: "friend",
        properties: {
          since: "2023-01-01"
        }
      };

      const id = await db.addEdge(edge);
      expect(id).toBe("test-edge");
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO relationships"),
        expect.arrayContaining([id, "node1", "node2", "friend"])
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO relationship_properties"),
        expect.arrayContaining([id, "since", expect.any(String)])
      );
    });

    it("应该读取所有边", async () => {
      const edges = await db.getEdges();
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        id: "edge1",
        source_id: "node1",
        target_id: "node2",
        type: "friend",
        properties: {
          since: "2020-01-01"
        }
      });
    });

    it("应该更新边", async () => {
      await db.updateEdge("edge1", {
        type: "close_friend",
        properties: {
          since: "2020-01-01",
          relation: "好友"
        }
      });

      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE relationships SET"),
        expect.arrayContaining(["close_friend", "edge1"])
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM relationship_properties"),
        ["edge1"]
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO relationship_properties"),
        expect.arrayContaining(["edge1", "since", expect.any(String)])
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO relationship_properties"),
        expect.arrayContaining(["edge1", "relation", expect.any(String)])
      );
    });

    it("应该删除边", async () => {
      await db.deleteEdge("edge1");
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM relationship_properties"),
        ["edge1"]
      );
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM relationships"),
        ["edge1"]
      );
    });
  });

  describe("图查询操作", () => {
    // 为查询操作设置模拟数据
    beforeEach(() => {
      mockConnection.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT * FROM nodes")) {
          return {
            values: [
              ["node1", "person", "张三", 100, 200, "2023-01-01", "2023-01-01"],
              ["node2", "person", "李四", 300, 200, "2023-01-01", "2023-01-01"],
              ["node3", "project", "项目", 200, 100, "2023-01-01", "2023-01-01"],
            ]
          };
        } else if (sql.includes("SELECT * FROM relationships")) {
          return {
            values: [
              ["edge1", "node1", "node3", "works_on", "2023-01-01"],
              ["edge2", "node2", "node3", "manages", "2023-01-01"],
            ]
          };
        } else if (sql.includes("SELECT 1 FROM")) {
          return {
            values: [["1"]]
          };
        }
        return { values: [] };
      });
    });

    it("应该查找两个节点之间的路径", async () => {
      const path = await db.findPath("node1", "node2");
      // 由于我们的模拟实现非常简单，我们不能完全测试路径查找的结果
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["node1"]
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["node2"]
      );
    });

    it("应该查找与节点相连的节点", async () => {
      const connectedNodes = await db.findConnectedNodes("node1");
      // 与路径查找类似，我们只测试部分功能
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1 FROM nodes"),
        ["node1"]
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM nodes"),
        undefined
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM relationships"),
        undefined
      );
    });
  });

  describe("事务操作", () => {
    it("应该使用SQLite事务API执行操作", async () => {
      const transactionSpy = vi.spyOn(sqliteService, 'transaction');
      
      await db.addNode({
        id: "transaction-test-node",
        type: "test",
        label: "事务测试",
        x: 100,
        y: 100
      });
      
      expect(transactionSpy).toHaveBeenCalled();
      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO nodes"),
        expect.arrayContaining(["transaction-test-node"])
      );
    });
    
    it("应该在事务失败时抛出错误", async () => {
      // 模拟失败的运行情况
      mockConnection.run.mockImplementationOnce(() => {
        throw new Error("模拟的数据库错误");
      });
      
      // 期望在调用addNode时抛出错误
      await expect(db.addNode({
        id: "error-node",
        type: "test",
        label: "错误测试",
        x: 200,
        y: 200
      })).rejects.toThrow();
    });
  });
}); 