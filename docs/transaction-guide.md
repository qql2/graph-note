# SQL.js 事务使用指南

## 事务基础

事务是数据库操作的基本单位，具有 ACID 特性：
- 原子性（Atomicity）：事务中的所有操作要么全部完成，要么全部不完成
- 一致性（Consistency）：事务执行前后数据库状态保持一致
- 隔离性（Isolation）：多个事务并发执行时互不干扰
- 持久性（Durability）：事务完成后的修改永久保存

## SQL.js 事务特点

1. 单连接限制
   - SQL.js 在同一个数据库连接上不支持并发事务
   - 每个连接同一时间只能有一个活动事务

2. 事务状态
   - 开始：BEGIN TRANSACTION
   - 提交：COMMIT
   - 回滚：ROLLBACK

## 异步函数中使用事务的正确方式

### 方法一：合并 SQL 语句（推荐）

```javascript
async function performTransaction(db) {
    try {
        // 在一个 exec 调用中执行完整事务
        // 避免事务执行期间出现异步操作
        const transactionSQL = `
            BEGIN TRANSACTION;
            
            UPDATE accounts 
            SET balance = balance - 100 
            WHERE id = 1;
            
            COMMIT;
        `;
        
        db.exec(transactionSQL);
    } catch (error) {
        try {
            db.exec('ROLLBACK;');
        } catch (rollbackError) {
            console.error('回滚失败:', rollbackError);
        }
        throw error;
    }
}
```

### 方法二：分步执行（不推荐用于并发场景）

```javascript
async function performTransaction(db) {
    try {
        // 警告：这种方式在并发场景下可能会出现问题
        // 因为异步操作期间事务保持活动状态，阻止其他事务执行
        db.exec('BEGIN TRANSACTION;');
        
        // 危险：异步操作期间事务处于活动状态
        await someAsyncOperation();  // 这里会阻塞其他事务
        
        db.exec(`
            UPDATE accounts 
            SET balance = balance - 100 
            WHERE id = 1;
        `);
        
        db.exec('COMMIT;');
    } catch (error) {
        try {
            db.exec('ROLLBACK;');
        } catch (rollbackError) {
            console.error('回滚失败:', rollbackError);
        }
        throw error;
    }
}
```

## 并发事务的正确处理方式

### 1. 使用多个数据库连接（推荐）

```javascript
async function runConcurrentTransactions() {
    const db1 = new SQL.Database();
    const db2 = new SQL.Database();
    
    try {
        // 每个事务使用独立的数据库连接
        await Promise.all([
            performTransaction(db1),
            performTransaction(db2)
        ]);
    } finally {
        db1.close();
        db2.close();
    }
}
```

### 2. 使用事务队列（单连接场景）

```javascript
class TransactionQueue {
    constructor(db) {
        this.db = db;
        this.queue = [];
        this.isProcessing = false;
    }
    
    async addTransaction(transaction) {
        // 将事务加入队列，确保顺序执行
        return new Promise((resolve, reject) => {
            this.queue.push({ transaction, resolve, reject });
            this.processQueue();
        });
    }
    
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        const { transaction, resolve, reject } = this.queue.shift();
        
        try {
            // 执行事务时使用合并 SQL 的方式
            const result = await transaction(this.db);
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.isProcessing = false;
            this.processQueue();
        }
    }
}
```

## 最佳实践

1. 事务原则
   - 避免在事务中包含异步操作
   - 保持事务简短，减少锁定时间
   - 优先使用合并 SQL 的方式
   - 需要并发时使用多个数据库连接

2. 错误处理
   ```javascript
   try {
       // 使用单个 exec 调用执行完整事务
       db.exec(`
           BEGIN TRANSACTION;
           -- 数据库操作
           COMMIT;
       `);
   } catch (error) {
       try {
           db.exec('ROLLBACK;');
       } catch (rollbackError) {
           console.error('回滚失败:', rollbackError);
       }
       throw error;
   }
   ```

3. 资源清理
   ```javascript
   const db = new SQL.Database();
   try {
       await performTransaction(db);
   } finally {
       db.close();
   }
   ```

4. 性能优化
   ```javascript
   // 批量操作使用单个事务和单个 exec 调用
   db.exec(`
       BEGIN TRANSACTION;
       ${Array(1000).fill(0).map((_, i) => `
           INSERT INTO items (name, value) 
           VALUES ('item${i}', ${i});
       `).join('\n')}
       COMMIT;
   `);
   ```

## 常见问题

1. "cannot start a transaction within a transaction"
   - 原因：在已有事务未结束时尝试开启新事务
   - 解决：使用合并 SQL 方式或确保事务完成后再开启新事务

2. "cannot commit - no transaction is active"
   - 原因：尝试提交不存在的事务
   - 解决：确保 BEGIN TRANSACTION 和 COMMIT 在同一个 exec 调用中

3. 并发事务冲突
   - 原因：在同一连接上同时执行多个事务
   - 解决：使用多个数据库连接或事务队列

## 调试技巧

1. 事务状态日志
   ```javascript
   function logTransaction(phase, details) {
       console.log(`[${new Date().toISOString()}] Transaction ${phase}:`, details);
   }
   ```

2. 事务监控
   ```javascript
   class TransactionMonitor {
       static async wrap(db, operation) {
           const startTime = performance.now();
           try {
               await operation(db);
           } finally {
               const duration = performance.now() - startTime;
               console.log(`Transaction completed in ${duration}ms`);
           }
       }
   }
   ``` 