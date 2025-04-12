# 节点与关系检索功能设计文档

## 项目概述

当前项目是一个基于图数据库的知识图谱应用，使用Ionic React框架开发，支持跨平台部署。项目已实现了图数据库的基本功能，包括节点和关系的增删改查。根据README.md文件，实现知识图谱的检索功能是项目的待办事项之一。

## 功能目标

设计并实现一个全面的图数据检索功能，使用户能够：

1. 基于各种条件检索节点
2. 基于各种条件检索关系
3. 使用高级查询条件组合检索
4. 提供直观的用户界面支持检索操作
5. 返回结果可视化显示

## 数据模型

从现有代码分析，项目使用以下主要数据结构：

1. **GraphNode**：表示图中的节点
   - id: 唯一标识符
   - type: 节点类型
   - label: 节点标签/名称
   - properties: 自定义属性集合
   - created_at/updated_at: 时间戳

2. **GraphEdge**：表示节点间的关系
   - id: 唯一标识符
   - source_id: 源节点ID
   - target_id: 目标节点ID
   - type: 关系类型
   - properties: 自定义属性集合
   - created_at: 创建时间戳

## 技术设计

### 1. 后端服务设计

创建一个新的`GraphSearchService`类来处理搜索相关功能，该服务将提供以下主要方法：

```typescript
class GraphSearchService {
  // 按条件搜索节点
  async searchNodes(criteria: NodeSearchCriteria): Promise<GraphNode[]>;
  
  // 按条件搜索关系
  async searchEdges(criteria: EdgeSearchCriteria): Promise<GraphEdge[]>;
  
  // 组合搜索（同时搜索节点和关系）
  async combinedSearch(criteria: CombinedSearchCriteria): Promise<SearchResult>;
  
  // 全文搜索（搜索节点和关系的所有文本内容）
  async fullTextSearch(query: string): Promise<SearchResult>;
}
```

### 2. 搜索条件数据结构

定义以下搜索相关的数据结构：

```typescript
// 节点搜索条件
interface NodeSearchCriteria {
  ids?: string[];                    // 按ID搜索
  types?: string[];                  // 按节点类型搜索
  labels?: string[];                 // 按节点标签搜索
  labelContains?: string;            // 标签文本包含
  properties?: PropertyFilter[];     // 属性过滤条件
  createdBefore?: Date;              // 创建时间早于
  createdAfter?: Date;               // 创建时间晚于
  updatedBefore?: Date;              // 更新时间早于
  updatedAfter?: Date;               // 更新时间晚于
  limit?: number;                    // 结果数量限制
  offset?: number;                   // 分页偏移量
  sortBy?: SortCriteria;             // 排序条件
}

// 关系搜索条件
interface EdgeSearchCriteria {
  ids?: string[];                    // 按ID搜索
  types?: string[];                  // 按关系类型搜索
  sourceIds?: string[];              // 按源节点ID搜索
  targetIds?: string[];              // 按目标节点ID搜索
  properties?: PropertyFilter[];     // 属性过滤条件
  createdBefore?: Date;              // 创建时间早于
  createdAfter?: Date;               // 创建时间晚于
  sourceNodeCriteria?: NodeSearchCriteria; // 源节点条件
  targetNodeCriteria?: NodeSearchCriteria; // 目标节点条件
  limit?: number;                    // 结果数量限制
  offset?: number;                   // 分页偏移量
  sortBy?: SortCriteria;             // 排序条件
}

// 属性过滤
interface PropertyFilter {
  key: string;                       // 属性名
  operator: FilterOperator;          // 过滤操作符
  value: any;                        // 属性值
}

// 过滤操作符
enum FilterOperator {
  EQUALS = "=",
  NOT_EQUALS = "!=",
  GREATER_THAN = ">",
  GREATER_THAN_OR_EQUAL = ">=",
  LESS_THAN = "<",
  LESS_THAN_OR_EQUAL = "<=",
  CONTAINS = "CONTAINS",
  STARTS_WITH = "STARTS_WITH",
  ENDS_WITH = "ENDS_WITH",
  IN = "IN",
  NOT_IN = "NOT_IN",
  EXISTS = "EXISTS",
  NOT_EXISTS = "NOT_EXISTS"
}

// 排序条件
interface SortCriteria {
  field: string;                     // 排序字段
  direction: SortDirection;          // 排序方向
}

// 排序方向
enum SortDirection {
  ASC = "ASC",
  DESC = "DESC"
}

// 组合搜索条件
interface CombinedSearchCriteria {
  nodes?: NodeSearchCriteria;        // 节点搜索条件
  edges?: EdgeSearchCriteria;        // 关系搜索条件
  maxResults?: number;               // 最大结果数
}

// 搜索结果
interface SearchResult {
  nodes: GraphNode[];                // 节点结果
  edges: GraphEdge[];                // 关系结果
  totalNodeCount: number;            // 节点总数（用于分页）
  totalEdgeCount: number;            // 关系总数（用于分页）
}
```

### 3. 数据库查询实现

在`BaseGraphDB`类中增加搜索相关方法：

```typescript
// 在BaseGraphDB.ts中添加以下方法

// 搜索节点
async searchNodes(criteria: NodeSearchCriteria): Promise<{ nodes: GraphNode[]; totalCount: number }>;

// 搜索关系
async searchEdges(criteria: EdgeSearchCriteria): Promise<{ edges: GraphEdge[]; totalCount: number }>;

// 全文搜索
async fullTextSearch(query: string, options?: FullTextSearchOptions): Promise<SearchResult>;
```

这些方法将使用SQL查询实现，针对SQLite的优化，以确保搜索性能。

### 4. 前端用户界面设计

#### 4.1 检索组件

创建一个新的`SearchPanel`组件，用于构建检索界面：

```typescript
// 检索面板组件
const SearchPanel = () => {
  // 状态管理和处理逻辑
  
  return (
    <div className="search-panel">
      {/* 搜索表单 */}
      <SearchForm onSearch={handleSearch} />
      
      {/* 搜索结果展示 */}
      <SearchResults results={results} onSelectItem={handleSelectItem} />
    </div>
  );
};
```

#### 4.2 节点搜索表单

```typescript
// 节点搜索表单
const NodeSearchForm = ({ onSearch }) => {
  // 表单状态和处理逻辑
  
  return (
    <div className="node-search-form">
      {/* 基本搜索字段 */}
      <input type="text" placeholder="节点标签或ID" />
      
      {/* 类型选择 */}
      <select>
        <option value="">全部类型</option>
        {/* 动态加载节点类型选项 */}
      </select>
      
      {/* 属性过滤器 */}
      <PropertyFilterBuilder />
      
      {/* 高级选项切换 */}
      <AdvancedOptions>
        {/* 时间范围 */}
        <DateRangeFilter label="创建时间" />
        <DateRangeFilter label="更新时间" />
        
        {/* 排序选项 */}
        <SortOptionsSelector />
      </AdvancedOptions>
      
      {/* 搜索按钮 */}
      <button onClick={handleSearch}>搜索</button>
    </div>
  );
};
```

#### 4.3 关系搜索表单

```typescript
// 关系搜索表单
const EdgeSearchForm = ({ onSearch }) => {
  // 表单状态和处理逻辑
  
  return (
    <div className="edge-search-form">
      {/* 关系类型选择 */}
      <select>
        <option value="">全部关系类型</option>
        {/* 动态加载关系类型选项 */}
      </select>
      
      {/* 源节点和目标节点过滤 */}
      <input type="text" placeholder="源节点标签或ID" />
      <input type="text" placeholder="目标节点标签或ID" />
      
      {/* 属性过滤器 */}
      <PropertyFilterBuilder />
      
      {/* 高级选项 */}
      <AdvancedOptions>
        {/* 时间范围 */}
        <DateRangeFilter label="创建时间" />
        
        {/* 排序选项 */}
        <SortOptionsSelector />
      </AdvancedOptions>
      
      {/* 搜索按钮 */}
      <button onClick={handleSearch}>搜索</button>
    </div>
  );
};
```

#### 4.4 搜索结果展示

```typescript
// 搜索结果展示
const SearchResults = ({ results, onSelectItem }) => {
  // 状态和处理逻辑
  
  return (
    <div className="search-results">
      {/* 结果统计 */}
      <div className="results-summary">
        找到 {results.totalNodeCount} 个节点和 {results.totalEdgeCount} 个关系
      </div>
      
      {/* 结果选项卡 */}
      <Tabs>
        <Tab label={`节点 (${results.nodes.length})`}>
          <NodeResultsList 
            nodes={results.nodes} 
            onSelect={node => onSelectItem('node', node)} 
          />
        </Tab>
        <Tab label={`关系 (${results.edges.length})`}>
          <EdgeResultsList 
            edges={results.edges} 
            onSelect={edge => onSelectItem('edge', edge)} 
          />
        </Tab>
      </Tabs>
      
      {/* 分页控件 */}
      <Pagination 
        totalItems={results.totalNodeCount + results.totalEdgeCount} 
        itemsPerPage={20} 
        onPageChange={handlePageChange} 
      />
    </div>
  );
};
```

### 5. 集成到主界面

在应用的主界面中集成搜索功能：

```typescript
// 在App.tsx或主内容页面中
const MainPage = () => {
  // 状态和处理逻辑
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>知识图谱</IonTitle>
          {/* 添加搜索按钮/图标 */}
          <IonButtons slot="end">
            <IonButton onClick={() => setShowSearchPanel(true)}>
              <IonIcon icon={searchOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        {/* 知识图谱主视图 */}
        <GraphVisualizer data={graphData} />
        
        {/* 搜索面板 - 可以作为模态框或侧边栏 */}
        <IonModal isOpen={showSearchPanel} onDidDismiss={() => setShowSearchPanel(false)}>
          <SearchPanel 
            onSearch={handleSearch} 
            onClose={() => setShowSearchPanel(false)} 
            onSelectResult={handleSelectSearchResult}
          />
        </IonModal>
      </IonContent>
    </IonPage>
  );
};
```

## 实现路线图

1. **第一阶段：基础搜索功能**
   - 实现GraphSearchService的基本方法
   - 开发节点搜索功能
   - 开发关系搜索功能
   - 创建基本搜索界面

2. **第二阶段：高级搜索功能**
   - 实现属性过滤
   - 实现高级排序
   - 添加时间范围过滤
   - 扩展搜索界面支持高级功能

3. **第三阶段：全文搜索与优化**
   - 实现全文搜索功能
   - 性能优化
   - 搜索结果高亮

## 性能考虑

1. 使用索引优化搜索查询
2. 实现分页以处理大量结果
3. 缓存频繁搜索的结果
4. 为复杂查询预先计算和缓存数据

## 后续拓展可能性

1. 实现搜索历史记录
2. 支持保存搜索查询
3. 添加自然语言查询接口
4. 集成机器学习提供搜索建议

## 文档

详细的API文档和用户指南将在功能实现过程中同步更新。 