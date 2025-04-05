import { GraphData, GraphNode, GraphEdge, QuadrantConfig, RelationshipType, DepthConfig, defaultDepthConfig } from '../models/GraphNode';

/**
 * Graph Layout Service - Handles the layout calculations for displaying nodes in quadrants
 */
export class GraphLayoutService {
  /**
   * Organizes nodes into quadrants based on their relationship types to the central node
   * @param graphData Complete graph data
   * @param centralNodeId ID of the central (focus) node
   * @param config Quadrant configuration (which relationship types go to which quadrants)
   * @param depthConfig 各种关系类型的深度配置
   * @returns A processed data structure with nodes organized by quadrant
   */
  static organizeByQuadrants(
    graphData: GraphData, 
    centralNodeId: string, 
    config: QuadrantConfig,
    depthConfig: DepthConfig = defaultDepthConfig
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

    // 使用Set去重，防止节点重复
    const relatedNodes = {
      [RelationshipType.FATHER]: new Set<GraphNode>(),
      [RelationshipType.CHILD]: new Set<GraphNode>(),
      [RelationshipType.BASE]: new Set<GraphNode>(),
      [RelationshipType.BUILD]: new Set<GraphNode>(),
    };

    // 使用一个Set来记录已经处理过的节点和边，避免循环依赖
    const processedNodes = new Set<string>();
    const processedEdges = new Set<string>();

    // 收集当前节点的直接关系
    const collectDirectRelationships = (nodeId: string) => {
      processedNodes.add(nodeId);
      
      graphData.edges.forEach(edge => {
        // 处理出站关系（当前节点 -> 目标节点）
        if (edge.source === nodeId) {
          const edgeKey = `${edge.source}-${edge.target}-${edge.relationshipType}`;
          if (processedEdges.has(edgeKey)) return;
          processedEdges.add(edgeKey);
          
          const relatedNode = graphData.nodes.find(node => node.id === edge.target);
          if (relatedNode) {
            relatedNodes[edge.relationshipType].add(relatedNode);
          }
        } 
        // 处理入站关系（源节点 -> 当前节点）
        else if (edge.target === nodeId) {
          const edgeKey = `${edge.source}-${edge.target}-${edge.relationshipType}`;
          if (processedEdges.has(edgeKey)) return;
          processedEdges.add(edgeKey);
          
          // 反转关系类型
          let invertedRelationship: RelationshipType;
          
          if (edge.relationshipType === RelationshipType.FATHER) {
            invertedRelationship = RelationshipType.CHILD;
          } else if (edge.relationshipType === RelationshipType.CHILD) {
            invertedRelationship = RelationshipType.FATHER;
          } else if (edge.relationshipType === RelationshipType.BASE) {
            invertedRelationship = RelationshipType.BUILD;
          } else if (edge.relationshipType === RelationshipType.BUILD) {
            invertedRelationship = RelationshipType.BASE;
          } else {
            invertedRelationship = edge.relationshipType;
          }
          
          const relatedNode = graphData.nodes.find(node => node.id === edge.source);
          if (relatedNode) {
            relatedNodes[invertedRelationship].add(relatedNode);
          }
        }
      });
    };

    // 递归查找相同类型的关系
    const findSameTypeRelationships = (
      nodeId: string,
      relationshipType: RelationshipType,
      depth: number,
      visited = new Set<string>()
    ) => {
      if (depth <= 0 || visited.has(nodeId)) return;
      visited.add(nodeId);
      
      graphData.edges.forEach(edge => {
        const edgeKey = `${edge.source}-${edge.target}-${edge.relationshipType}`;
        if (processedEdges.has(edgeKey)) return;
        
        // 根据关系类型决定查找方向
        let nextNodeId: string | null = null;
        let matchesType = false;
        
        // 出站关系：当前节点作为源节点
        if (edge.source === nodeId) {
          // 只有当边的类型与我们要查找的类型相同时才继续
          if (edge.relationshipType === relationshipType) {
            nextNodeId = edge.target;
            matchesType = true;
          }
        } 
        // 入站关系：当前节点作为目标节点
        else if (edge.target === nodeId) {
          // 计算反转关系类型
          let invertedType: RelationshipType;
          
          if (edge.relationshipType === RelationshipType.FATHER) {
            invertedType = RelationshipType.CHILD;
          } else if (edge.relationshipType === RelationshipType.CHILD) {
            invertedType = RelationshipType.FATHER;
          } else if (edge.relationshipType === RelationshipType.BASE) {
            invertedType = RelationshipType.BUILD;
          } else if (edge.relationshipType === RelationshipType.BUILD) {
            invertedType = RelationshipType.BASE;
          } else {
            invertedType = edge.relationshipType;
          }
          
          // 只有当反转后的类型与我们要查找的类型相同时才继续
          if (invertedType === relationshipType) {
            nextNodeId = edge.source;
            matchesType = true;
          }
        }
        
        // 如果找到匹配的关系，处理并递归
        if (matchesType && nextNodeId) {
          processedEdges.add(edgeKey);
          const nextNode = graphData.nodes.find(node => node.id === nextNodeId);
          
          if (nextNode) {
            relatedNodes[relationshipType].add(nextNode);
            // 递归查找，深度减1
            findSameTypeRelationships(nextNodeId, relationshipType, depth - 1, new Set(visited));
          }
        }
      });
    };

    // 首先收集中心节点的直接关系
    collectDirectRelationships(centralNodeId);
    
    // 然后对每种关系类型进行递归查找
    Object.values(RelationshipType).forEach(type => {
      // 获取当前已收集的这种类型的直接关系节点
      const directRelationNodes = Array.from(relatedNodes[type]);
      
      // 对每个直接关系节点，递归查找相同类型的关系
      // 这样能保证只递归查找相同类型的关系，例如父节点的父节点，或子节点的子节点
      directRelationNodes.forEach(node => {
        if (depthConfig[type] > 1) { // 如果深度 > 1，才需要递归
          findSameTypeRelationships(node.id, type, depthConfig[type] - 1);
        }
      });
    });

    // 将Set转换回数组
    return {
      centralNode,
      quadrants: {
        top: Array.from(relatedNodes[config.top]),
        bottom: Array.from(relatedNodes[config.bottom]),
        left: Array.from(relatedNodes[config.left]),
        right: Array.from(relatedNodes[config.right])
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