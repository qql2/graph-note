import { GraphData, GraphNode, GraphEdge, QuadrantConfig, RelationshipType } from '../models/GraphNode';

/**
 * Graph Layout Service - Handles the layout calculations for displaying nodes in quadrants
 */
export class GraphLayoutService {
  /**
   * Organizes nodes into quadrants based on their relationship types to the central node
   * @param graphData Complete graph data
   * @param centralNodeId ID of the central (focus) node
   * @param config Quadrant configuration (which relationship types go to which quadrants)
   * @returns A processed data structure with nodes organized by quadrant
   */
  static organizeByQuadrants(
    graphData: GraphData, 
    centralNodeId: string, 
    config: QuadrantConfig
  ) {
    if (!graphData || !centralNodeId) {
      return {
        centralNode: null,
        quadrants: {
          top: [],
          bottom: [],
          left: [],
          right: []
        }
      };
    }

    // Find the central node
    const centralNode = graphData.nodes.find(node => node.id === centralNodeId);
    if (!centralNode) {
      return {
        centralNode: null,
        quadrants: {
          top: [],
          bottom: [],
          left: [],
          right: []
        }
      };
    }

    // Organize related nodes by relationship type
    const relatedNodes = {
      [RelationshipType.FATHER]: [] as GraphNode[],
      [RelationshipType.CHILD]: [] as GraphNode[],
      [RelationshipType.BASE]: [] as GraphNode[],
      [RelationshipType.BUILD]: [] as GraphNode[],
    };

    // Identify the connected nodes and their relationship types
    graphData.edges.forEach(edge => {
      if (edge.source === centralNodeId) {
        // Outgoing relationship
        const targetNode = graphData.nodes.find(node => node.id === edge.target);
        if (targetNode) {
          relatedNodes[edge.relationshipType].push(targetNode);
        }
      } else if (edge.target === centralNodeId) {
        // Incoming relationship
        const sourceNode = graphData.nodes.find(node => node.id === edge.source);
        if (sourceNode) {
          // For incoming edges, we might need to invert the relationship
          // E.g., if A is the CHILD of B, then B is the FATHER of A
          let invertedRelationship = edge.relationshipType;
          
          // Invert relationship if necessary
          if (edge.relationshipType === RelationshipType.FATHER) {
            invertedRelationship = RelationshipType.CHILD;
          } else if (edge.relationshipType === RelationshipType.CHILD) {
            invertedRelationship = RelationshipType.FATHER;
          } else if (edge.relationshipType === RelationshipType.BASE) {
            invertedRelationship = RelationshipType.BUILD;
          } else if (edge.relationshipType === RelationshipType.BUILD) {
            invertedRelationship = RelationshipType.BASE;
          }
          
          relatedNodes[invertedRelationship].push(sourceNode);
        }
      }
    });

    // Map relationship types to quadrants according to the configuration
    return {
      centralNode,
      quadrants: {
        top: relatedNodes[config.top],
        bottom: relatedNodes[config.bottom],
        left: relatedNodes[config.left],
        right: relatedNodes[config.right]
      }
    };
  }

  /**
   * Calculates the position for each node in the quadrant layout
   * @param organizedData Data organized by quadrants
   * @param containerWidth Width of the container
   * @param containerHeight Height of the container
   * @returns Layout data with positions for each node
   */
  static calculateQuadrantLayout(
    organizedData: any, 
    containerWidth: number, 
    containerHeight: number
  ) {
    const { centralNode, quadrants } = organizedData;
    if (!centralNode) return [];

    // Center position of the container
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    // Node size and spacing (can be customized)
    const nodeWidth = 100;
    const nodeHeight = 50;
    const horizontalSpacing = 120; // 同一象限中节点的水平间距
    const verticalSpacing = 80;    // 同一象限中节点的垂直间距
    
    // 象限距离中心的偏移量
    const quadrantOffsetX = 250;   // 水平象限（左/右）与中心的距离
    const quadrantOffsetY = 180;   // 垂直象限（上/下）与中心的距离

    // Result will contain node data with their positions
    const result: any[] = [
      {
        ...centralNode,
        x: centerX - nodeWidth / 2,
        y: centerY - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
        isCentralNode: true
      }
    ];

    // 上方象限：节点水平排列
    quadrants.top.forEach((node: GraphNode, index: number) => {
      const totalWidth = quadrants.top.length * (nodeWidth + horizontalSpacing) - horizontalSpacing;
      const startX = centerX - totalWidth / 2;
      
      result.push({
        ...node,
        x: startX + index * (nodeWidth + horizontalSpacing),
        y: centerY - quadrantOffsetY - nodeHeight,
        width: nodeWidth,
        height: nodeHeight,
        quadrant: 'top'
      });
    });

    // 下方象限：节点水平排列
    quadrants.bottom.forEach((node: GraphNode, index: number) => {
      const totalWidth = quadrants.bottom.length * (nodeWidth + horizontalSpacing) - horizontalSpacing;
      const startX = centerX - totalWidth / 2;
      
      result.push({
        ...node,
        x: startX + index * (nodeWidth + horizontalSpacing),
        y: centerY + quadrantOffsetY,
        width: nodeWidth,
        height: nodeHeight,
        quadrant: 'bottom'
      });
    });

    // 左侧象限：节点垂直排列
    quadrants.left.forEach((node: GraphNode, index: number) => {
      const totalHeight = quadrants.left.length * (nodeHeight + verticalSpacing) - verticalSpacing;
      const startY = centerY - totalHeight / 2;
      
      result.push({
        ...node,
        x: centerX - quadrantOffsetX - nodeWidth,
        y: startY + index * (nodeHeight + verticalSpacing),
        width: nodeWidth,
        height: nodeHeight,
        quadrant: 'left'
      });
    });

    // 右侧象限：节点垂直排列
    quadrants.right.forEach((node: GraphNode, index: number) => {
      const totalHeight = quadrants.right.length * (nodeHeight + verticalSpacing) - verticalSpacing;
      const startY = centerY - totalHeight / 2;
      
      result.push({
        ...node,
        x: centerX + quadrantOffsetX,
        y: startY + index * (nodeHeight + verticalSpacing),
        width: nodeWidth,
        height: nodeHeight,
        quadrant: 'right'
      });
    });

    return result;
  }
} 