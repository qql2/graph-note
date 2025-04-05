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

    // 使用Map存储节点及其层级关系，value是[节点, 层级深度]
    const relatedNodesMap = {
      [RelationshipType.FATHER]: new Map<string, [GraphNode, number]>(),
      [RelationshipType.CHILD]: new Map<string, [GraphNode, number]>(),
      [RelationshipType.BASE]: new Map<string, [GraphNode, number]>(),
      [RelationshipType.BUILD]: new Map<string, [GraphNode, number]>(),
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
            // 将直接关系节点添加为第1层
            relatedNodesMap[edge.relationshipType].set(relatedNode.id, [relatedNode, 1]);
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
            // 将直接关系节点添加为第1层
            relatedNodesMap[invertedRelationship].set(relatedNode.id, [relatedNode, 1]);
          }
        }
      });
    };

    // 递归查找相同类型的关系，并记录层级
    const findSameTypeRelationships = (
      nodeId: string,
      relationshipType: RelationshipType,
      currentDepth: number,
      maxDepth: number,
      visited = new Set<string>()
    ) => {
      if (currentDepth >= maxDepth || visited.has(nodeId)) return;
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
            // 设置节点的层级为当前层级+1
            const nextDepth = currentDepth + 1;
            
            // 只有当这个节点不存在，或者存在但层级更大时才更新
            // 这确保节点总是以最短路径的层级被记录
            const existingInfo = relatedNodesMap[relationshipType].get(nextNodeId);
            if (!existingInfo || existingInfo[1] > nextDepth) {
              relatedNodesMap[relationshipType].set(nextNodeId, [nextNode, nextDepth]);
              
              // 递归查找，层级递增
              findSameTypeRelationships(nextNodeId, relationshipType, nextDepth, maxDepth, new Set(visited));
            }
          }
        }
      });
    };

    // 首先收集中心节点的直接关系
    collectDirectRelationships(centralNodeId);
    
    // 然后对每种关系类型进行递归查找
    Object.values(RelationshipType).forEach(type => {
      // 获取当前已收集的这种类型的直接关系节点
      const directRelationNodes = Array.from(relatedNodesMap[type].entries());
      
      // 对每个直接关系节点，递归查找相同类型的关系
      // 这样能保证只递归查找相同类型的关系，例如父节点的父节点，或子节点的子节点
      directRelationNodes.forEach(([nodeId, [node, depth]]) => {
        if (depthConfig[type] > 1) { // 如果深度 > 1，才需要递归
          findSameTypeRelationships(nodeId, type, depth, depthConfig[type]);
        }
      });
    });

    // 将Map转换为按层级排序的数组
    const createSortedNodeArray = (nodesMap: Map<string, [GraphNode, number]>) => {
      return Array.from(nodesMap.values())
        .sort((a, b) => a[1] - b[1])  // 按层级排序
        .map(([node, depth]) => ({
          ...node,
          depth // 将层级信息附加到节点上，供布局使用
        }));
    };
    
    return {
      centralNode,
      quadrants: {
        top: createSortedNodeArray(relatedNodesMap[config.top]),
        bottom: createSortedNodeArray(relatedNodesMap[config.bottom]),
        left: createSortedNodeArray(relatedNodesMap[config.left]),
        right: createSortedNodeArray(relatedNodesMap[config.right])
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
    
    // 象限的基础偏移量
    const baseQuadrantOffsetX = 250;   // 水平象限（左/右）与中心的基础距离
    const baseQuadrantOffsetY = 180;   // 垂直象限（上/下）与中心的基础距离
    
    // 每增加一层的额外偏移
    const layerOffsetX = 120; // 水平方向每层增加的偏移
    const layerOffsetY = 100; // 垂直方向每层增加的偏移

    // Result will contain node data with their positions
    const result: any[] = [
      {
        ...centralNode,
        x: centerX - nodeWidth / 2,
        y: centerY - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
        isCentralNode: true,
        depth: 0
      }
    ];

    // 按层级分组节点
    const groupNodesByDepth = (nodes: any[]) => {
      const groupedNodes: {[key: number]: any[]} = {};
      
      nodes.forEach(node => {
        const depth = node.depth || 1; // 默认为第1层
        if (!groupedNodes[depth]) {
          groupedNodes[depth] = [];
        }
        groupedNodes[depth].push(node);
      });
      
      return groupedNodes;
    };

    // 上方象限：按层级垂直排列，每层内部水平排列
    const topNodesByDepth = groupNodesByDepth(quadrants.top);
    Object.entries(topNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetY = baseQuadrantOffsetY + (depth - 1) * layerOffsetY;
      
      // 每层节点水平居中排列
      const totalWidth = nodesInDepth.length * (nodeWidth + horizontalSpacing) - horizontalSpacing;
      const startX = centerX - totalWidth / 2;
      
      nodesInDepth.forEach((node: any, index: number) => {
        result.push({
          ...node,
          x: startX + index * (nodeWidth + horizontalSpacing),
          y: centerY - quadrantOffsetY - nodeHeight,
          width: nodeWidth,
          height: nodeHeight,
          quadrant: 'top'
        });
      });
    });

    // 下方象限：按层级垂直排列，每层内部水平排列
    const bottomNodesByDepth = groupNodesByDepth(quadrants.bottom);
    Object.entries(bottomNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetY = baseQuadrantOffsetY + (depth - 1) * layerOffsetY;
      
      // 每层节点水平居中排列
      const totalWidth = nodesInDepth.length * (nodeWidth + horizontalSpacing) - horizontalSpacing;
      const startX = centerX - totalWidth / 2;
      
      nodesInDepth.forEach((node: any, index: number) => {
        result.push({
          ...node,
          x: startX + index * (nodeWidth + horizontalSpacing),
          y: centerY + quadrantOffsetY,
          width: nodeWidth,
          height: nodeHeight,
          quadrant: 'bottom'
        });
      });
    });

    // 左侧象限：按层级水平排列，每层内部垂直排列
    const leftNodesByDepth = groupNodesByDepth(quadrants.left);
    Object.entries(leftNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetX = baseQuadrantOffsetX + (depth - 1) * layerOffsetX;
      
      // 每层节点垂直居中排列
      const totalHeight = nodesInDepth.length * (nodeHeight + verticalSpacing) - verticalSpacing;
      const startY = centerY - totalHeight / 2;
      
      nodesInDepth.forEach((node: any, index: number) => {
        result.push({
          ...node,
          x: centerX - quadrantOffsetX - nodeWidth,
          y: startY + index * (nodeHeight + verticalSpacing),
          width: nodeWidth,
          height: nodeHeight,
          quadrant: 'left'
        });
      });
    });

    // 右侧象限：按层级水平排列，每层内部垂直排列
    const rightNodesByDepth = groupNodesByDepth(quadrants.right);
    Object.entries(rightNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetX = baseQuadrantOffsetX + (depth - 1) * layerOffsetX;
      
      // 每层节点垂直居中排列
      const totalHeight = nodesInDepth.length * (nodeHeight + verticalSpacing) - verticalSpacing;
      const startY = centerY - totalHeight / 2;
      
      nodesInDepth.forEach((node: any, index: number) => {
        result.push({
          ...node,
          x: centerX + quadrantOffsetX,
          y: startY + index * (nodeHeight + verticalSpacing),
          width: nodeWidth,
          height: nodeHeight,
          quadrant: 'right'
        });
      });
    });

    return result;
  }
} 