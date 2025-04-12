// 定义节点和关系检索功能所需的数据类型

import { GraphEdge, GraphNode } from "./GraphNode";

// 过滤操作符
export enum FilterOperator {
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

// 排序方向
export enum SortDirection {
  ASC = "ASC",
  DESC = "DESC"
}

// 属性过滤
export interface PropertyFilter {
  key: string;                       // 属性名
  operator: FilterOperator;          // 过滤操作符
  value: any;                        // 属性值
}

// 排序条件
export interface SortCriteria {
  field: string;                     // 排序字段
  direction: SortDirection;          // 排序方向
}

// 节点搜索条件
export interface NodeSearchCriteria {
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
export interface EdgeSearchCriteria {
  ids?: string[];                    // 按ID搜索
  types?: string[];                  // 按关系类型搜索
  typeContains?: string;             // 关系类型文本包含
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

// 组合搜索条件
export interface CombinedSearchCriteria {
  nodes?: NodeSearchCriteria;        // 节点搜索条件
  edges?: EdgeSearchCriteria;        // 关系搜索条件
  maxResults?: number;               // 最大结果数
}

// 全文搜索选项
export interface FullTextSearchOptions {
  includeTitles?: boolean;           // 是否包含标题
  includeProperties?: boolean;       // 是否包含属性
  caseSensitive?: boolean;           // 是否区分大小写
  limit?: number;                    // 结果数量限制
  offset?: number;                   // 分页偏移量
}

// 搜索结果
export interface SearchResult {
  nodes: GraphNode[];                // 节点结果
  edges: GraphEdge[];                // 关系结果
  totalNodeCount: number;            // 节点总数（用于分页）
  totalEdgeCount: number;            // 关系总数（用于分页）
} 