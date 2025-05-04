// Graph Node Model

// 关系组位置枚举
export enum QuadrantPosition {
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right',
}

// 常见的关系类型常量，用于参考，但系统应该支持任意关系类型
export const CommonRelationshipTypes = {
  FATHER: 'father',
  CHILD: 'child',
  BASE: 'base',
  BUILD: 'build',
  MENTION: 'mention',
  MENTIONED_BY: 'mentioned_by',
};

// 关系类型的显示方式
export enum RelationshipLabelMode {
  NONE = 'none', // 不显示关系标签
  SIMPLE = 'simple', // 简单显示（首字母）
  FULL = 'full', // 完整显示关系名称
}

// 关系类型相对性定义
export interface RelationshipTypeConfig {
  // 关系类型到其相对/反转类型的映射
  oppositeTypes: Record<string, string>;
}

// Graph node model
export interface GraphNode {
  id: string;
  label: string;
  // Additional properties like description, created date, etc. can be added here
  description?: string;
  metadata?: Record<string, any>;
  // 节点在关系图中的深度层级
  depth?: number;
  // 节点是否独立，独立节点可以独立显示，非独立节点需要依赖其他节点进行阐述
  is_independent?: boolean;
}

// 带有层级信息的节点，用于布局
export interface GraphNodeWithDepth extends GraphNode {
  depth: number;
}

// Edge/connection between nodes
export interface GraphEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  relationshipType: string; // 使用字符串表示关系类型，直接对应数据库中的类型
  // Additional properties like creation date, description, etc.
  metadata?: Record<string, any>;
}

// Complete graph data model
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  // 非独立节点的父独立节点映射，key是非独立节点ID，value是父独立节点
  parentNodes?: Record<string, GraphNode | null>;
}

// 配置关系组布局
export interface QuadrantConfig {
  [QuadrantPosition.TOP]: string[];
  [QuadrantPosition.BOTTOM]: string[];
  [QuadrantPosition.LEFT]: string[];
  [QuadrantPosition.RIGHT]: string[];
  unconfiguredTypesPosition: QuadrantPosition;  // 明确指定未分配关系类型显示的位置
  relationshipTypeConfig: RelationshipTypeConfig; // 添加关系类型相对性配置
}

// 深度配置，控制各关系类型的最大深度
export interface DepthConfig {
  [relationshipType: string]: number;
}

// 视图配置
export interface ViewConfig {
  showRelationshipLabels: RelationshipLabelMode; // 是否在连线上显示关系类型
  autoFocusNewNode: boolean; // 是否在创建新节点时自动聚焦于该节点
  developerMode: boolean; // 是否启用开发者模式
}

// 默认关系类型相对性配置
export const defaultRelationshipTypeConfig: RelationshipTypeConfig = {
  oppositeTypes: {
    [CommonRelationshipTypes.FATHER]: CommonRelationshipTypes.CHILD,
    [CommonRelationshipTypes.CHILD]: CommonRelationshipTypes.FATHER,
    [CommonRelationshipTypes.BASE]: CommonRelationshipTypes.BUILD,
    [CommonRelationshipTypes.BUILD]: CommonRelationshipTypes.BASE,
    [CommonRelationshipTypes.MENTION]: CommonRelationshipTypes.MENTIONED_BY,
    [CommonRelationshipTypes.MENTIONED_BY]: CommonRelationshipTypes.MENTION,
  }
};

// 默认关系组配置
export const defaultQuadrantConfig: QuadrantConfig = {
  [QuadrantPosition.TOP]: [CommonRelationshipTypes.FATHER],
  [QuadrantPosition.BOTTOM]: [CommonRelationshipTypes.CHILD],
  [QuadrantPosition.LEFT]: [CommonRelationshipTypes.BASE, CommonRelationshipTypes.MENTIONED_BY],
  [QuadrantPosition.RIGHT]: [CommonRelationshipTypes.BUILD, CommonRelationshipTypes.MENTION],
  unconfiguredTypesPosition: QuadrantPosition.LEFT, // 默认未指定关系组用于未配置的关系类型
  relationshipTypeConfig: defaultRelationshipTypeConfig, // 使用默认关系类型相对性配置
};

// 默认深度配置，最大深度为3
export const defaultDepthConfig: DepthConfig = {
  [CommonRelationshipTypes.FATHER]: 3,
  [CommonRelationshipTypes.CHILD]: 3,
  [CommonRelationshipTypes.BASE]: 3,
  [CommonRelationshipTypes.BUILD]: 3,
  [CommonRelationshipTypes.MENTION]: 3,
  [CommonRelationshipTypes.MENTIONED_BY]: 3,
};

// 默认视图配置
export const defaultViewConfig: ViewConfig = {
  showRelationshipLabels: RelationshipLabelMode.SIMPLE, // 默认使用简洁模式显示关系标签
  autoFocusNewNode: true, // 默认创建新节点时自动聚焦于该节点
  developerMode: false, // 默认不启用开发者模式
};