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

// Default quadrant configuration
export const defaultQuadrantConfig: QuadrantConfig = {
  top: RelationshipType.FATHER,
  bottom: RelationshipType.CHILD,
  left: RelationshipType.BASE,
  right: RelationshipType.BUILD,
}; 