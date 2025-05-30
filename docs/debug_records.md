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