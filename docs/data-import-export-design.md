# 数据导入导出功能设计

## 功能概述

本文档描述了Graph Note应用的数据导入导出功能设计。该功能允许用户：

1. 导出整个图数据库以便备份或分享
2. 导入之前导出的数据，或从其他来源导入兼容数据

## 技术方案设计

### 1. 数据格式选择

使用JSON格式作为导入导出的标准格式：
- 优点：人类可读、广泛支持、易于解析、不需要额外依赖
- 结构：
  ```json
  {
    "metadata": {
      "version": "1.0",
      "created_at": "ISO时间戳",
      "app_version": "应用版本"
    },
    "data": {
      "nodes": [节点数组],
      "edges": [边数组]
    }
  }
  ```

### 2. 导出功能设计

**导出流程**：
1. 系统从数据库提取全部数据
2. 转换为JSON格式
3. 提供下载选项

### 3. 导入功能设计

**导入流程**：
1. 用户选择JSON文件
2. 系统验证文件格式和兼容性
3. 提供导入选项（合并或替换）
4. 执行导入操作
5. 反馈导入结果（成功/失败信息）

**导入选项**：
- 替换模式：清空当前数据库后导入新数据
- 合并模式：将新数据与现有数据合并（处理ID冲突）

### 4. 用户界面设计

**导出UI**：
- 在应用导航或设置中添加"导出数据"按钮
- 导出进度指示器
- 成功后提供下载链接

**导入UI**：
- 在应用导航或设置中添加"导入数据"选项
- 文件选择器（支持拖放）
- 导入模式选择（合并/替换）
- 导入进度指示器和结果反馈

## 实现步骤

### 第一阶段：后端服务

1. 在GraphDatabaseService中扩展导出功能：
   - 实现完整数据导出函数
   - 数据格式转换和验证

2. 实现导入功能：
   - 数据验证及版本兼容性检查
   - 处理ID冲突策略
   - 实现导入事务（确保原子性）

### 第二阶段：UI组件

1. 创建导出按钮和处理器：
   - 调用后端导出函数
   - 导出进度指示器
   - 结果显示和下载按钮

2. 创建导入对话框组件：
   - 文件选择界面
   - 导入选项配置
   - 进度和结果展示

### 第三阶段：集成与测试

1. 将导入导出功能集成到应用导航/菜单
2. 实现错误处理和用户反馈
3. 测试不同场景下的导入导出功能
4. 优化性能（对于大型数据集）

## 技术细节

### 数据库接口扩展

在GraphDatabaseInterface中添加额外的方法：
```typescript
// 导出相关
exportToJson(options?: ExportOptions): Promise<string>;

// 导入相关
importFromJson(jsonData: string, mode: ImportMode): Promise<ImportResult>;
validateImportData(jsonData: string): Promise<ValidationResult>;

// 类型定义
interface ExportOptions {
  prettyPrint?: boolean;
  includeMetadata?: boolean;
}

enum ImportMode {
  REPLACE = "replace",
  MERGE = "merge"
}

interface ImportResult {
  success: boolean;
  nodesImported: number;
  edgesImported: number;
  errors: string[];
}

interface ValidationResult {
  valid: boolean;
  version?: string;
  nodeCount: number;
  edgeCount: number;
  errors: string[];
}
```

### 文件处理

使用浏览器的File API和Blob对象处理文件：
- 导出时创建Blob并提供下载链接
- 导入时读取上传的文件内容

### 安全考虑

- 导入前验证数据以防止恶意数据
- 添加文件大小限制
- 在导入前提供数据预览

## 实现示例

### 导出功能示例代码

```typescript
// 导出服务
async function exportAllData(): Promise<string> {
  const db = graphDatabaseService.getDatabase();
  
  // 获取所有节点和边
  const nodes = await db.getNodes();
  const edges = await db.getEdges();
  
  // 构建导出数据
  const exportData = {
    metadata: {
      version: "1.0",
      created_at: new Date().toISOString(),
      app_version: APP_VERSION
    },
    data: {
      nodes,
      edges
    }
  };
  
  // 转换为JSON字符串
  return JSON.stringify(exportData, null, 2);
}

// UI组件中的调用
async function handleExport() {
  setExporting(true);
  try {
    const jsonData = await exportAllData();
    
    // 创建Blob和下载链接
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 创建下载元素
    const a = document.createElement('a');
    a.href = url;
    a.download = `graph-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    setExportSuccess(true);
  } catch (error) {
    console.error("Export failed:", error);
    setExportError(error.message);
  } finally {
    setExporting(false);
  }
}
```

### 导入功能示例代码

```typescript
// 导入服务
async function importFromJson(jsonData: string, mode: ImportMode): Promise<ImportResult> {
  // 解析JSON数据
  let parsedData;
  try {
    parsedData = JSON.parse(jsonData);
  } catch (error) {
    return {
      success: false,
      nodesImported: 0,
      edgesImported: 0,
      errors: ["Invalid JSON format"]
    };
  }
  
  // 验证数据结构
  if (!parsedData.data || !Array.isArray(parsedData.data.nodes) || !Array.isArray(parsedData.data.edges)) {
    return {
      success: false,
      nodesImported: 0,
      edgesImported: 0,
      errors: ["Invalid data structure"]
    };
  }
  
  const db = graphDatabaseService.getDatabase();
  
  // 根据模式处理导入
  if (mode === ImportMode.REPLACE) {
    // 清空当前数据库
    // 注意：这需要在数据库接口中实现清空操作
    await db.clear();
  }
  
  // 导入节点
  const importedNodes = [];
  const errors = [];
  
  for (const node of parsedData.data.nodes) {
    try {
      // 处理ID冲突
      if (mode === ImportMode.MERGE) {
        // 检查节点是否已存在
        try {
          await db.getNode(node.id);
          // 如果存在则更新
          await db.updateNode(node.id, node);
        } catch {
          // 不存在则添加
          const newId = await db.addNode(node);
          importedNodes.push(newId);
        }
      } else {
        // 替换模式直接添加
        const newId = await db.addNode(node);
        importedNodes.push(newId);
      }
    } catch (error) {
      errors.push(`Failed to import node ${node.id}: ${error.message}`);
    }
  }
  
  // 导入边
  const importedEdges = [];
  
  for (const edge of parsedData.data.edges) {
    try {
      // 确保源节点和目标节点存在
      if (importedNodes.includes(edge.source_id) && importedNodes.includes(edge.target_id)) {
        const newId = await db.addEdge(edge);
        importedEdges.push(newId);
      }
    } catch (error) {
      errors.push(`Failed to import edge ${edge.id}: ${error.message}`);
    }
  }
  
  return {
    success: errors.length === 0,
    nodesImported: importedNodes.length,
    edgesImported: importedEdges.length,
    errors
  };
}
```

## 总结

这个简单而实用的导入导出功能设计满足了以下要求：
1. **够用**：提供了完整的导入导出功能，支持全量数据操作
2. **简单**：使用JSON作为通用格式，界面操作直观
3. **容易实现**：基于现有的数据库接口扩展，不需要复杂的额外依赖

实现过程分为三个阶段：后端服务扩展、UI组件开发、集成测试，可以逐步完成。 