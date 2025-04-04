import { StorageServiceContext } from '../App';

// Node and edge types
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  properties: Record<string, any>;
  createdAt: number;
}

// Database operation types
export interface DatabaseOperation {
  type: 'CREATE_NODE' | 'UPDATE_NODE' | 'DELETE_NODE' | 'CREATE_EDGE' | 'UPDATE_EDGE' | 'DELETE_EDGE';
  data: any;
}

// Transaction result type
export interface TransactionResult {
  success: boolean;
  data?: any;
  error?: Error;
}

export class GraphDatabaseService {
  private static instance: GraphDatabaseService;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private initialized: boolean = false;
  private transactionQueue: Promise<any> = Promise.resolve();

  private constructor() {}

  public static getInstance(): GraphDatabaseService {
    if (!GraphDatabaseService.instance) {
      GraphDatabaseService.instance = new GraphDatabaseService();
    }
    return GraphDatabaseService.instance;
  }

  // Initialize the database
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Load data from persistent storage if available
    await this.loadData();
    
    this.initialized = true;
  }

  // Load data from persistent storage
  private async loadData(): Promise<void> {
    try {
      // In a real implementation, we would load from persistent storage
      // For now, we'll just initialize with empty data
      this.nodes = new Map();
      this.edges = new Map();
    } catch (error) {
      console.error('Failed to load graph data:', error);
      throw error;
    }
  }

  // Save data to persistent storage
  private async saveData(): Promise<void> {
    try {
      // In a real implementation, we would save to persistent storage
      // For now, this is a placeholder
      console.log('Saving graph data...');
    } catch (error) {
      console.error('Failed to save graph data:', error);
      throw error;
    }
  }

  // Execute a function as a transaction
  public async executeTransaction<T>(
    callback: (graphDb: GraphDatabaseService) => Promise<T>
  ): Promise<T> {
    return this.transactionQueue = this.transactionQueue.then(async () => {
      try {
        // Execute the callback with the database instance
        const result = await callback(this);
        
        // Save any changes made during the transaction
        await this.saveData();
        
        return result;
      } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
      }
    });
  }

  // Node operations
  public createNode(nodeData: Omit<GraphNode, 'createdAt' | 'updatedAt'>): GraphNode {
    const now = Date.now();
    const node: GraphNode = {
      ...nodeData,
      createdAt: now,
      updatedAt: now
    };
    
    this.nodes.set(node.id, node);
    return node;
  }

  public updateNode(nodeData: Pick<GraphNode, 'id'> & Partial<Omit<GraphNode, 'id' | 'createdAt'>>): GraphNode {
    const existingNode = this.nodes.get(nodeData.id);
    if (!existingNode) {
      throw new Error(`Node not found: ${nodeData.id}`);
    }
    
    const updatedNode: GraphNode = {
      ...existingNode,
      ...nodeData,
      updatedAt: Date.now()
    };
    
    this.nodes.set(updatedNode.id, updatedNode);
    return updatedNode;
  }

  public deleteNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    
    // Check if node has connected edges
    for (const [edgeId, edge] of this.edges.entries()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        this.edges.delete(edgeId);
      }
    }
    
    return this.nodes.delete(nodeId);
  }

  // Edge operations
  public createEdge(edgeData: Omit<GraphEdge, 'createdAt'>): GraphEdge {
    // Verify that source and target nodes exist
    if (!this.nodes.has(edgeData.source)) {
      throw new Error(`Source node not found: ${edgeData.source}`);
    }
    if (!this.nodes.has(edgeData.target)) {
      throw new Error(`Target node not found: ${edgeData.target}`);
    }
    
    const now = Date.now();
    const edge: GraphEdge = {
      ...edgeData,
      createdAt: now
    };
    
    this.edges.set(edge.id, edge);
    return edge;
  }

  public updateEdge(edgeData: Pick<GraphEdge, 'id'> & Partial<Omit<GraphEdge, 'id' | 'createdAt'>>): GraphEdge {
    const existingEdge = this.edges.get(edgeData.id);
    if (!existingEdge) {
      throw new Error(`Edge not found: ${edgeData.id}`);
    }
    
    const updatedEdge: GraphEdge = {
      ...existingEdge,
      ...edgeData
    };
    
    this.edges.set(updatedEdge.id, updatedEdge);
    return updatedEdge;
  }

  public deleteEdge(edgeId: string): boolean {
    if (!this.edges.has(edgeId)) {
      throw new Error(`Edge not found: ${edgeId}`);
    }
    
    return this.edges.delete(edgeId);
  }

  // Query methods
  public async getNode(nodeId: string): Promise<GraphNode | null> {
    return this.nodes.get(nodeId) || null;
  }

  public async getAllNodes(): Promise<GraphNode[]> {
    return Array.from(this.nodes.values());
  }

  public async getNodesByType(type: string): Promise<GraphNode[]> {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  public async getEdge(edgeId: string): Promise<GraphEdge | null> {
    return this.edges.get(edgeId) || null;
  }

  public async getAllEdges(): Promise<GraphEdge[]> {
    return Array.from(this.edges.values());
  }

  public async getEdgesByType(type: string): Promise<GraphEdge[]> {
    return Array.from(this.edges.values()).filter(edge => edge.type === type);
  }

  public async getNodeConnections(nodeId: string): Promise<{edges: GraphEdge[], connectedNodes: GraphNode[]}> {
    const connectedEdges = Array.from(this.edges.values()).filter(
      edge => edge.source === nodeId || edge.target === nodeId
    );
    
    const connectedNodeIds = new Set<string>();
    connectedEdges.forEach(edge => {
      if (edge.source === nodeId) {
        connectedNodeIds.add(edge.target);
      } else {
        connectedNodeIds.add(edge.source);
      }
    });
    
    const connectedNodes = Array.from(connectedNodeIds).map(id => this.nodes.get(id)!).filter(Boolean);
    
    return {
      edges: connectedEdges,
      connectedNodes
    };
  }

  // Graph traversal and path finding
  public async findPath(startNodeId: string, endNodeId: string, maxDepth = 5): Promise<GraphNode[]> {
    const visited = new Set<string>();
    const queue: Array<{node: string, path: string[]}> = [{node: startNodeId, path: [startNodeId]}];
    
    while (queue.length > 0) {
      const {node, path} = queue.shift()!;
      
      if (path.length > maxDepth) continue;
      
      if (node === endNodeId) {
        return path.map(id => this.nodes.get(id)!);
      }
      
      if (visited.has(node)) continue;
      visited.add(node);
      
      const {connectedNodes} = await this.getNodeConnections(node);
      for (const connectedNode of connectedNodes) {
        if (!visited.has(connectedNode.id)) {
          queue.push({
            node: connectedNode.id, 
            path: [...path, connectedNode.id]
          });
        }
      }
    }
    
    return []; // No path found
  }

  // Utility methods
  public async exportGraph(): Promise<{nodes: GraphNode[], edges: GraphEdge[]}> {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    };
  }

  public async importGraph(data: {nodes: GraphNode[], edges: GraphEdge[]}): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
    
    data.nodes.forEach(node => {
      this.nodes.set(node.id, node);
    });
    
    data.edges.forEach(edge => {
      this.edges.set(edge.id, edge);
    });
    
    await this.saveData();
  }

  public async clear(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
    await this.saveData();
  }
}

export default GraphDatabaseService.getInstance(); 