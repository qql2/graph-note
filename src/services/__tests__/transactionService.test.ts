import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sqliteService from '../sqliteService';
import transactionService from '../transactionService';
import { graphDatabaseService } from '../graph-database';

// Create mock connection object
const mockDb = {
  execute: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
  run: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
  query: vi.fn(),
  beginTransaction: vi.fn().mockResolvedValue(undefined),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  rollbackTransaction: vi.fn().mockResolvedValue(undefined)
};

// Mock the sqliteService
vi.mock('../sqliteService', () => ({
  default: {
    transaction: vi.fn(),
    isConnection: vi.fn(),
    retrieveConnection: vi.fn()
  }
}));

// Mock the graphDatabaseService
vi.mock('../graph-database', () => ({
  graphDatabaseService: {
    getDatabase: vi.fn()
  }
}));

describe('TransactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock for isConnection
    (sqliteService.isConnection as any) = vi.fn().mockResolvedValue(true);
    
    // Setup mock for transaction to simulate successful execution
    (sqliteService.transaction as any) = vi.fn().mockImplementation(async (dbName, cb) => {
      return await cb(mockDb);
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should execute a transaction successfully', async () => {
    const mockOperation = vi.fn().mockResolvedValue({ success: true });
    
    const result = await transactionService.executeTransaction(mockOperation);
    
    expect(sqliteService.transaction).toHaveBeenCalledTimes(1);
    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });
  
  it('should execute multiple SQL statements in a transaction', async () => {
    await transactionService.executeTransaction(async (db) => {
      await db.run('INSERT INTO nodes (id, type) VALUES ("test1", "note")');
      await db.run('INSERT INTO nodes (id, type) VALUES ("test2", "note")');
      return { changes: 2 };
    });
    
    expect(sqliteService.transaction).toHaveBeenCalledTimes(1);
  });
  
  it('should handle errors during transaction execution', async () => {
    // Override the transaction mock to simulate an error
    (sqliteService.transaction as any) = vi.fn().mockImplementation(async () => {
      throw new Error('Test transaction error');
    });
    
    const mockOperation = vi.fn();
    
    await expect(transactionService.executeTransaction(mockOperation))
      .rejects.toThrow('Transaction failed: Test transaction error');
    
    expect(sqliteService.transaction).toHaveBeenCalledTimes(1);
  });
  
  it('should work with graph database operations', async () => {
    // 准备一个mock数据库对象
    const mockGraphDb = {
      addNode: vi.fn().mockResolvedValue('node-id'),
      getNodes: vi.fn().mockResolvedValue([])
    };
    
    // 将getDatabase替换为返回mock的函数
    (graphDatabaseService.getDatabase as any) = vi.fn().mockReturnValue(mockGraphDb);
    
    // 执行一个图数据库操作
    await transactionService.executeTransaction(async () => {
      const db = graphDatabaseService.getDatabase();
      await db.addNode({
        type: "test",
        label: "Test Node",
        x: 100,
        y: 200
      });
      return { success: true };
    });
    
    expect(sqliteService.transaction).toHaveBeenCalledTimes(1);
    expect(graphDatabaseService.getDatabase).toHaveBeenCalled();
  });
  
  it('should use native transaction API correctly', async () => {
    const mockDb = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue({ changes: { changes: 1 } })
    };
    
    // 创建一个使用原生事务 API 的函数
    const testNativeTransaction = async (db: any) => {
      await db.beginTransaction();
      try {
        await db.run('INSERT INTO test VALUES (1)');
        await db.commitTransaction();
        return { success: true };
      } catch (error) {
        await db.rollbackTransaction();
        throw error;
      }
    };
    
    await testNativeTransaction(mockDb);
    
    expect(mockDb.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
    expect(mockDb.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.rollbackTransaction).not.toHaveBeenCalled();
  });
  
  it('should rollback transaction on error using native API', async () => {
    const mockDb = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockRejectedValue(new Error('Test DB error'))
    };
    
    // 创建一个使用原生事务 API 的函数，但会触发错误
    const testFailingTransaction = async (db: any) => {
      await db.beginTransaction();
      try {
        await db.run('INSERT INTO test VALUES (1)');
        await db.commitTransaction();
        return { success: true };
      } catch (error) {
        await db.rollbackTransaction();
        throw error;
      }
    };
    
    await expect(testFailingTransaction(mockDb)).rejects.toThrow('Test DB error');
    
    expect(mockDb.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.run).toHaveBeenCalledTimes(1);
    expect(mockDb.commitTransaction).not.toHaveBeenCalled();
    expect(mockDb.rollbackTransaction).toHaveBeenCalledTimes(1);
  });
}); 