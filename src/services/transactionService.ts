import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import sqliteService from './sqliteService';
import { GraphDatabaseService } from './graphDatabaseService';

/**
 * TransactionService - 提供批量数据库操作的事务 API
 * 
 * 本服务实现了基于队列的事务系统，用于将多个数据库操作作为单个原子单元执行。
 * 它确保操作按顺序执行，并在出错时提供自动回滚。
 * 
 * 事务 API 使用 Capacitor SQLite 插件的原生事务方法，确保事务的正确处理。
 */
export class TransactionService {
  private static instance: TransactionService;
  private readonly graphDbService: GraphDatabaseService;
  private readonly DB_NAME = 'graph-note.db';
  
  /**
   * 私有构造函数，确保单例模式
   */
  private constructor() {
    this.graphDbService = GraphDatabaseService.getInstance();
  }
  
  /**
   * 获取 TransactionService 的单例实例
   * @returns TransactionService 实例
   */
  public static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * 将一组数据库操作作为单个事务执行
   * 
   * 此方法实现了队列处理机制，事务被排队并按顺序执行以确保数据一致性。
   * 在事务回调中，您可以执行任意数量的数据库操作（非数据库操作也是被允许的，但不推荐），包括执行 SQL 语句和带参数的查询。
   * 注意 @capacitor-community/sqlite 数据库操作的transaction参数设置，以防止意外结束事务
   * 
   * @param operations 包含要在事务中执行的数据库操作的函数
   * @returns 事务操作的结果
   * @throws 如果事务失败则抛出错误
   */
  public async executeTransaction<T>(operations: (db: SQLiteDBConnection) => Promise<T>): Promise<T> {
    try {
      // 使用 SQLiteService 的事务方法执行操作
      return await sqliteService.transaction(this.DB_NAME, operations);
    } catch (error: any) {
      console.error('Transaction failed:', error);
      // 重新抛出错误以供调用方处理
      throw new Error(`Transaction failed: ${error.message || error}`);
    }
  }
}

export default TransactionService.getInstance(); 