// Graph Node Model

// Relationship types as specified in the design
export enum RelationshipType {
  FATHER = 'father',
  CHILD = 'child',
  BASE = 'base',
  BUILD = 'build',
}

// Graph node model
export interface GraphNode {
  id: string;
  label: string;
  // Additional properties like description, created date, etc. can be added here
  description?: string;
  metadata?: Record<string, any>;
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