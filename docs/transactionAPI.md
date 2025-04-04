# 事务 API (Transaction API)

事务 API 提供了一种强大的机制，用于将多个数据库操作作为单个原子单元执行。这确保了数据的一致性和完整性，保证事务中的所有操作要么全部成功完成，要么在出现任何错误时全部回滚。

## 主要特点

1. **队列处理机制**
   - 事务按顺序排队和执行
   - 确保操作按顺序处理
   - 防止并发问题和竞态条件

2. **原子操作**
   - 事务中的所有操作要么一起成功，要么一起失败
   - 出错时自动回滚
   - 维护数据库完整性

3. **针对 Capacitor SQLite 优化**
   - 使用 Capacitor SQLite 插件的原生事务 API
   - 跨平台兼容 (Web, iOS, Android)
   - 提供可靠的事务处理

## 可用 API

事务 API 设计简洁明了，只提供核心功能，让开发者能够灵活地在事务中执行任何数据库操作：

### 事务执行

```typescript
// 在事务中执行多个数据库操作
const result = await graphDatabaseService.executeTransaction(async (db) => {
  // 执行任意多个数据库操作
  const result1 = await db.run(
    "INSERT INTO nodes (id, type, label) VALUES (?, ?, ?)", 
    ["id1", "note", "节点 1"]
  );
  
  const result2 = await db.run(
    "INSERT INTO nodes (id, type, label) VALUES (?, ?, ?)",
    ["id2", "note", "节点 2"]
  );
  
  const result3 = await db.run(
    "INSERT INTO relationships (id, source_id, target_id, type) VALUES (?, ?, ?, ?)",
    ["edge1", "id1", "id2", "reference"]
  );
  
  // 可以返回任何结果
  return { 
    changes: (result1.changes?.changes || 0) + 
             (result2.changes?.changes || 0) + 
             (result3.changes?.changes || 0)
  };
});

console.log(`变更数: ${result.changes}`);
```

### 批量节点和边创建

```typescript
// 在单个事务中添加多个节点
const nodes = [
  { id: 'node1', type: 'note', label: '节点 1', x: 100, y: 200, properties: { key1: 'value1' } },
  { id: 'node2', type: 'note', label: '节点 2', x: 300, y: 400, properties: { key2: 'value2' } }
];

const nodeIds = await graphDatabaseService.addNodes(nodes);

// 在单个事务中添加多个边
const edges = [
  { id: 'edge1', source_id: 'node1', target_id: 'node2', type: 'reference', properties: { weight: 1 } },
  { id: 'edge2', source_id: 'node2', target_id: 'node1', type: 'bidirectional', properties: { weight: 2 } }
];

const edgeIds = await graphDatabaseService.addEdges(edges);
```

### 使用 SQLite 插件原生事务 API

```typescript
// 直接使用 SQLite 数据库连接的原生事务 API
async function performTransaction(db: SQLiteDBConnection) {
  // 开始事务
  await db.beginTransaction();
  
  try {
    // 执行数据库操作
    await db.run('INSERT INTO nodes (id, type) VALUES (?, ?)', ['id1', 'note']);
    await db.run('INSERT INTO nodes (id, type) VALUES (?, ?)', ['id2', 'note']);
    
    // 如果所有操作都成功，提交事务
    await db.commitTransaction();
    return { success: true };
  } catch (error) {
    // 如果有任何错误，回滚事务
    await db.rollbackTransaction();
    throw error;
  }
}
```

## 实现细节

事务 API 由以下组件实现：

1. **SQLiteService 事务方法**
   - 处理低级事务操作
   - 管理事务队列
   - 使用 beginTransaction, commitTransaction 和 rollbackTransaction 确保正确的事务处理

2. **TransactionService**
   - 提供核心事务 API
   - 简化的 API 设计，专注于最基本的事务功能
   - 协调与 SQLiteService 的事务执行

3. **GraphDatabaseService 集成**
   - 通过 GraphDatabaseInterface 公开事务功能
   - 提供特定领域的事务方法 (addNodes, addEdges)
   - 与 GraphDatabaseService 的其余部分保持兼容

## 最佳实践

1. **分组相关操作**
   - 将逻辑相关的操作放在同一个事务中
   - 尽量减少事务数量以提高性能

2. **正确处理错误**
   - 捕获并记录事务错误
   - 提供有意义的错误消息
   - 考虑对临时错误使用重试机制

3. **优化事务大小**
   - 保持事务足够小以快速完成
   - 避免非常大的事务，这可能会影响性能
   - 对于非常大的操作，考虑分割成多个事务

4. **使用参数化查询**
   - 始终使用参数化查询提高安全性和性能
   - 使用 `db.run(sql, params)` 而不是拼接 SQL 字符串

## 示例用例

1. **导入大型数据集**
   - 使用事务批量处理数据
   - 确保跨导入的数据完整性

2. **图形操作**
   - 原子性地创建复杂图形结构
   - 确保关系一致性

3. **数据迁移**
   - 在表或结构之间移动数据
   - 维护引用完整性

4. **批量更新**
   - 对多条记录应用更改
   - 确保跨更新的一致状态 