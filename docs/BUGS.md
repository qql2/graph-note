# 图数据库服务已知Bug

## 事务中调用persistData导致的事务提交失败

### 问题描述
在事务操作中调用`persistData()`方法会导致事务提交失败，出现"Transaction has been ended unexpectedly"错误。这是因为`persistData()`方法进行了数据持久化操作，而这个操作已经集成在事务API中，重复调用会导致冲突。

### 影响范围
- BaseGraphDB类中的以下方法受到影响：
  - `addEdge`
  - `updateNode`
  - `updateEdge`

### 解决方法
从事务操作中移除`persistData()`调用，因为它已经在事务API中的`transaction()`方法中自动执行了。修改如下：

```typescript
// 修改前
await this.db.transaction(async () => {
  try {
    const result = await operation(this.db!);
    await this.persistData(); // 这会导致事务提交失败
    return result;
  } catch (error) {
    // 错误处理...
  }
});

// 修改后
await this.withTransaction(async () => {
  try {
    const result = await operation(this.db!);
    // 移除persistData调用，因为它已经在事务API中自动执行了
    return result;
  } catch (error) {
    // 错误处理...
  }
});
```

### 修复时间
2025-04-05

### 其他说明
为了保持一致性，所有涉及数据库修改的操作都应该使用`withTransaction`方法而不是直接使用`db.transaction`方法。这样可以确保事务的正确处理和提交。 

## 安卓端切换页面导致新建数据消失

### 问题描述
在安卓端切换页面时，新建的数据会消失。

### 原因分析
在安卓端，如果页面切换时，有意外的事务处于活跃状态，则会导致新建的数据消失。这是因为安卓端的SQLite插件在页面切换时会自动关闭数据库连接，导致事务被意外回滚。

### 解决方法
更新`@capacitor-community/sqlite`插件到最新版本。解决beginTransaction并发的bug

### 修复时间
2025-04-17

## sql.js v13版本不兼容
### 问题描述
在使用sql.js v13版本时，会出现不兼容的问题。出现`Aborted(LinkError: WebAssembly.instantiate(): Import #34 "a" "I": function import requires a callable). Build with -sASSERTIONS for more info.`报错

### 原因分析
应该是jeep-sql的bug, 不支持sql.js v13版本, 但安装jeep-sql时会自动安装最新的sql.js v13版本, 导致不兼容

### 解决方法
直接指定顶层依赖sql.js版本未1.12.0

### 修复时间
2025-04-17