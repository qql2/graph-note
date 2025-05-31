# 故障排除指南

## Android Gradle Plugin (AGP) 与 Java 版本兼容性问题

### 问题描述
在使用 Java 21 或更高版本时，如果 Android Gradle Plugin (AGP) 版本低于 8.2.1，构建过程会失败。这是 AGP 的一个已知 bug。

错误信息：
```
This is likely due to a known bug in Android Gradle Plugin (AGP) versions less than 8.2.1, when
1. setting a value for SourceCompatibility and
2. using Java 21 or above.
```

### 原因
这是 AGP 在处理 Java 21+ 的 SourceCompatibility 设置时的一个已知问题。详见：
- [Google Issue Tracker #294137077](https://issuetracker.google.com/issues/294137077)
- [Flutter Issue #156304](https://github.com/flutter/flutter/issues/156304)

### 解决方案
在 `android/settings.gradle` 中更新 AGP 版本至 8.2.1 或更高：

```gradle
plugins {
    id "dev.flutter.flutter-plugin-loader" version "1.0.0"
    id "com.android.application" version "8.2.1" apply false  // 更新此版本
    id "org.jetbrains.kotlin.android" version "1.8.22" apply false
}
```

### 相关配置检查清单
确保以下文件的配置相互兼容：

1. **android/settings.gradle**
   - AGP 版本 >= 8.2.1
   - Kotlin 版本兼容性检查

2. **android/app/build.gradle**
   - Java 和 Kotlin 编译选项设置正确
   ```gradle
   compileOptions {
       sourceCompatibility JavaVersion.VERSION_17
       targetCompatibility JavaVersion.VERSION_17
   }
   kotlinOptions {
       jvmTarget = '17'
   }
   ```

3. **android/gradle/wrapper/gradle-wrapper.properties**
   - Gradle 版本与 AGP 版本兼容
   ```properties
   distributionUrl=https\://services.gradle.org/distributions/gradle-8.2.1-all.zip
   ```

### 其他可能需要的操作
如果更新后仍然遇到问题，可以尝试：

1. 清理项目缓存：
```bash
flutter clean
```

2. 删除 Gradle 缓存：
```bash
rm -rf $HOME/.gradle/caches/
```

3. 重新获取依赖并运行：
```bash
flutter pub get
flutter run
```

### 参考链接
- [AGP 版本兼容性文档](https://developer.android.com/studio/releases/gradle-plugin)
- [Gradle 与 AGP 兼容性矩阵](https://developer.android.com/studio/releases/gradle-plugin#updating-gradle)
- [Java 版本兼容性指南](https://docs.gradle.org/current/userguide/compatibility.html) 

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

# SQLite Graph Database 调试记录

## 1. JSON 解析错误

### 问题描述
在多个方法中出现 JSON 解析错误：
```
SyntaxError: Expected property name or '}' in JSON at position 15
```

### 问题原因
1. 使用 `LEFT JOIN` 和 `GROUP BY` 组合时，如果没有属性记录，`json_group_object` 可能返回不合法的 JSON

### 解决方案
1. 将属性聚合移到子查询中
2. 使用以下格式的查询：
```sql
SELECT 
  r.*,
  (
    SELECT json_object(
      'properties',
      json_group_object(key, value)
    )
    FROM relationship_properties
    WHERE relationship_id = r.id
  ) as props
FROM relationships r
```
3. 添加更多的错误处理和日志记录
4. 在解析 JSON 时使用 try-catch 包装

## 2. JSON 数组连接问题

### 问题描述
在 `findShortestPath` 方法中出现错误：
```
Error finding shortest path: SqliteError: no such function: json_array_extend
```

### 问题原因
1. SQLite 不支持 `json_array_extend` 函数
2. 直接使用字符串拼接可能导致 JSON 格式不正确

### 解决方案
1. 使用 `rtrim` 和字符串拼接来正确构建 JSON 数组：
```sql
json(
  substr(
    rtrim(p.path_nodes, ']'),
    1
  ) || ', ' || r.target_id || ']'
)
```

## 3. 数据库锁定问题

### 问题描述
在测试清理阶段出现 Windows 系统的文件锁定错误：
```
Error: EBUSY: resource busy or locked, unlink 'C:\Users\...\test-graph.db'
```

### 问题原因
1. 在尝试删除数据库文件时，数据库连接可能还未完全关闭
2. Windows 系统对文件锁定的处理比较严格

### 解决方案
1. 增加关闭数据库后的等待时间：
```typescript
await new Promise((resolve) => setTimeout(resolve, 500));
```
2. 使用 try-catch 包装文件删除操作，避免测试失败
3. 在删除文件前确保数据库连接已完全关闭

## 4. 属性解析问题

### 问题描述
在处理节点和关系的属性时，可能出现解析错误。

### 问题原因
1. 属性值可能不是有效的 JSON 字符串
2. 属性值可能为 null 或 undefined

### 解决方案
1. 在存储属性时确保使用 `JSON.stringify`
2. 在读取属性时添加多层错误处理：
```typescript
try {
  if (props) {
    const parsedProps = JSON.parse(props);
    properties = parsedProps.properties || {};
  }
} catch (error) {
  console.error("Error parsing properties:", error);
  properties = {};
}
```

## 5. 节点数据丢失问题

### 问题描述
在页面刷新时，节点数据会逐渐减少，直到完全消失：
```
Loaded nodes: (7) [{...}, {...}, {...}, {...}, {...}, {...}, {...}]
Loaded edges: []
Database saved to localStorage
Saved Nodes: (6) [{...}, {...}, {...}, {...}, {...}, {...}]
Saved Edges: []
Saved Nodes: (5) [{...}, {...}, {...}, {...}, {...}]
...
Saved Nodes: []
```

### 问题原因
1. 在`GraphEditor`组件中，`loadGraph`函数会调用`clearCells()`来清除现有图形
2. 每次调用`clearCells()`都会触发`cell:removed`事件
3. `cell:removed`事件处理器会调用`deleteNode`或`deleteEdge`方法，导致数据库中的节点被删除
4. 由于这个过程是在加载数据时发生的，导致每次刷新页面都会意外删除节点

### 解决方案
1. 使用`isLoadingRef`引用来跟踪数据加载状态：
```typescript
const isLoadingRef = useRef(false);

const loadGraph = async () => {
  setIsLoading(true);
  isLoadingRef.current = true;  // 设置加载状态
  try {
    // 加载数据...
  } finally {
    setIsLoading(false);
    isLoadingRef.current = false;  // 重置加载状态
  }
};
```

2. 在`cell:removed`事件处理器中检查加载状态：
```typescript
graph.on('cell:removed', async (args) => {
  // 如果正在加载数据，不处理删除事件
  if (isLoadingRef.current) {
    return;
  }

  const cell = args.cell;
  if (cell instanceof Node) {
    await databaseService.deleteNode(cell.id);
  } else if (cell instanceof Edge) {
    await databaseService.deleteEdge(cell.id);
  }
  onGraphChanged?.();
});
```

### 经验总结
1. 在处理图形组件的事件时，需要考虑事件触发的上下文
2. 对于可能影响数据库的操作，应该添加适当的状态检查
3. 使用引用（useRef）来跟踪异步操作的状态，避免状态更新导致的重渲染问题
4. 在组件的生命周期中，要注意区分用户操作和程序自动操作的区别

## 经验教训

1. **数据验证**：在存储和读取数据时都需要进行严格的验证和错误处理
2. **JSON 处理**：在 SQLite 中处理 JSON 需要特别注意格式和兼容性
3. **错误处理**：应该在每个可能失败的地方添加适当的错误处理和日志记录
4. **资源清理**：在处理数据库连接和文件操作时，需要确保资源被正确释放
5. **测试设计**：测试用例应该包含边界情况和错误情况的处理 