// Graph Node Model

// Relationship types as specified in the design
export enum RelationshipType {
  FATHER = 'father',
  CHILD = 'child',
  BASE = 'base',
  BUILD = 'build',
}

// 关系类型的显示方式
export enum RelationshipLabelMode {
  NONE = 'none', // 不显示关系标签
  SIMPLE = 'simple', // 简单显示（F/C/B/B）
  FULL = 'full', // 完整显示关系名称
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
  relationshipType: RelationshipType;
  // Additional properties like creation date, description, etc.
  metadata?: Record<string, any>;
}

// Complete graph data model
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Configuration for the quadrant layout
export interface QuadrantConfig {
  top: RelationshipType;
  bottom: RelationshipType;
  left: RelationshipType; 
  right: RelationshipType;
}

// 深度配置，控制每种关系类型的最大深度
export interface DepthConfig {
  [RelationshipType.FATHER]: number;
  [RelationshipType.CHILD]: number;
  [RelationshipType.BASE]: number;
  [RelationshipType.BUILD]: number;
}

// 视图配置
export interface ViewConfig {
  showRelationshipLabels: RelationshipLabelMode; // 是否在连线上显示关系类型
}

// Default quadrant configuration
export const defaultQuadrantConfig: QuadrantConfig = {
  top: RelationshipType.FATHER,
  bottom: RelationshipType.CHILD,
  left: RelationshipType.BASE,
  right: RelationshipType.BUILD,
};

// 默认深度配置，最大深度为3
export const defaultDepthConfig: DepthConfig = {
  [RelationshipType.FATHER]: 3,
  [RelationshipType.CHILD]: 3,
  [RelationshipType.BASE]: 3,
  [RelationshipType.BUILD]: 3,
};

// 默认视图配置
export const defaultViewConfig: ViewConfig = {
  showRelationshipLabels: RelationshipLabelMode.SIMPLE, // 默认使用简洁模式显示关系标签
}; 