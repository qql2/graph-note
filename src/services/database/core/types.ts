export interface Node {
  id: number;
  type: string;
  [key: string]: any;
}

export interface Relationship {
  id: number;
  sourceId: number;
  targetId: number;
  type: string;
  [key: string]: any;
}

export interface Pattern {
  nodeType: string;
  relationshipType: string | string[];
  targetType: string;
}

export interface PathResult {
  nodes: Node[];
  relationships: Relationship[];
  length: number;
}

export interface MatchResult {
  source: Node;
  relationship: Relationship;
  target: Node;
}

export interface FindOptions {
  type?: string | null;
  properties?: Record<string, any>;
}

export interface GraphDatabaseInterface {
  createNode(properties: Record<string, any>): Promise<Node>;
  createRelationship(
    sourceId: number,
    targetId: number,
    type: string,
    properties?: Record<string, any>
  ): Promise<Relationship>;
  getNodeById(id: number): Promise<Node | null>;
  getRelationshipById(id: number): Promise<Relationship | null>;
  findShortestPath(
    startNodeId: number,
    endNodeId: number,
    relationshipType?: string | null
  ): Promise<PathResult | null>;
  matchPattern(pattern: Pattern): Promise<MatchResult[]>;
  findRelationships(options?: FindOptions): Promise<Relationship[]>;
  findNodes(options?: FindOptions): Promise<Node[]>;
  clearDatabase(): Promise<void>;
  close(): void;
}
