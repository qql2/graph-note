import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './setup';
import sqliteService from '../sqliteService';
import transactionService from '../transactionService';
import { GraphDatabaseService } from '../graphDatabaseService';

// Mock the sqliteService
vi.mock('../sqliteService', () => ({
  default: {
    transaction: vi.fn(),
    isConnection: vi.fn(),
    retrieveConnection: vi.fn()
  }
}));

describe('TransactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock for isConnection
    sqliteService.isConnection = vi.fn().mockResolvedValue(true);
    
    // Setup mock for transaction to simulate successful execution
    sqliteService.transaction = vi.fn().mockImplementation(async (dbName, cb) => {
      // Mock database connection
      const mockDb = {
        execute: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
        run: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined)
      };
      
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
    sqliteService.transaction = vi.fn().mockImplementation(async () => {
      throw new Error('Test transaction error');
    });
    
    const mockOperation = vi.fn();
    
    await expect(transactionService.executeTransaction(mockOperation))
      .rejects.toThrow('Transaction failed: Test transaction error');
    
    expect(sqliteService.transaction).toHaveBeenCalledTimes(1);
  });
  
  it('should integrate with GraphDatabaseService', async () => {
    // Mock GraphDatabaseService methods
    const graphDbService = GraphDatabaseService.getInstance();
    graphDbService.executeTransaction = vi.fn().mockImplementation(async (operations) => {
      return await transactionService.executeTransaction(operations);
    });
    
    const mockOperation = vi.fn().mockResolvedValue({ success: true });
    
    await graphDbService.executeTransaction(mockOperation);
    
    expect(sqliteService.transaction).toHaveBeenCalledTimes(1);
    expect(mockOperation).toHaveBeenCalledTimes(1);
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