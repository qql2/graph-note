import {
  GraphData,
  GraphNode,
  GraphEdge,
  QuadrantConfig,
  CommonRelationshipTypes,
  DepthConfig,
  defaultDepthConfig,
  QuadrantPosition,
  RelationshipTypeConfig,
  defaultRelationshipTypeConfig,
} from "../models/GraphNode";

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
          right: [],
        },
      };
    }

    // Find the central node
    const centralNode = graphData.nodes.find(
      (node) => node.id === centralNodeId
    );
    if (!centralNode) {
      return {
        centralNode: null,
        quadrants: {
          top: [],
          bottom: [],
          left: [],
          right: [],
        },
      };
    }


    // 创建所有已分配的关系类型列表
    const assignedRelationshipTypes = [
      ...config[QuadrantPosition.TOP],
      ...config[QuadrantPosition.BOTTOM],
      ...config[QuadrantPosition.LEFT],
      ...config[QuadrantPosition.RIGHT],
    ];

    // 使用Map存储节点及其层级关系，value是[节点, 层级深度]
    // 为每种关系类型创建一个Map
    const relatedNodesMap = new Map<string, Map<string, [GraphNode, number]>>();

    // 确保常见关系类型的Map存在
    [
      CommonRelationshipTypes.FATHER,
      CommonRelationshipTypes.CHILD,
      CommonRelationshipTypes.BASE,
      CommonRelationshipTypes.BUILD,
    ].forEach((type) => {
      relatedNodesMap.set(type, new Map<string, [GraphNode, number]>());
    });

    // 使用一个Set来记录已经处理过的节点和边，避免循环依赖
    const processedNodes = new Set<string>();
    const processedEdges = new Set<string>();


    // 收集当前节点的直接关系
    const collectDirectRelationships = (nodeId: string) => {
      processedNodes.add(nodeId);

      graphData.edges.forEach((edge) => {
        // 处理出站关系（当前节点 -> 目标节点）
        if (edge.source === nodeId) {
          const edgeKey = `${edge.source}-${edge.target}-${edge.relationshipType}`;
          if (processedEdges.has(edgeKey)) return;
          processedEdges.add(edgeKey);

          const relatedNode = graphData.nodes.find(
            (node) => node.id === edge.target
          );
          if (relatedNode) {
            // 确保这种关系类型的Map存在
            if (!relatedNodesMap.has(edge.relationshipType)) {
              relatedNodesMap.set(
                edge.relationshipType,
                new Map<string, [GraphNode, number]>()
              );
            }
            // 将直接关系节点添加为第1层
            relatedNodesMap
              .get(edge.relationshipType)
              ?.set(relatedNode.id, [relatedNode, 1]);
          }
        }
        // 处理入站关系（源节点 -> 当前节点）
        else if (edge.target === nodeId) {
          const edgeKey = `${edge.source}-${edge.target}-${edge.relationshipType}`;
          if (processedEdges.has(edgeKey)) return;
          processedEdges.add(edgeKey);

          // 获取反转关系类型
          const invertedRelationship = GraphLayoutService.getOppositeRelationType(
            edge.relationshipType,
            config
          );

          const relatedNode = graphData.nodes.find(
            (node) => node.id === edge.source
          );
          if (relatedNode) {
            // 确保这种反转关系类型的Map存在
            if (!relatedNodesMap.has(invertedRelationship)) {
              relatedNodesMap.set(
                invertedRelationship,
                new Map<string, [GraphNode, number]>()
              );
            }
            // 将直接关系节点添加为第1层
            relatedNodesMap
              .get(invertedRelationship)
              ?.set(relatedNode.id, [relatedNode, 1]);
          }
        }
      });
    };

    // 递归查找相同类型的关系，并记录层级
    const findSameTypeRelationships = (
      nodeId: string,
      relationshipType: string,
      currentDepth: number,
      maxDepth: number,
      visited = new Set<string>()
    ) => {
      if (currentDepth >= maxDepth || visited.has(nodeId)) return;
      visited.add(nodeId);

      graphData.edges.forEach((edge) => {
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
          // 获取反转关系类型
          const invertedType = GraphLayoutService.getOppositeRelationType(edge.relationshipType, config);

          // 只有当反转后的类型与我们要查找的类型相同时才继续
          if (invertedType === relationshipType) {
            nextNodeId = edge.source;
            matchesType = true;
          }
        }

        // 如果找到匹配的关系，处理并递归
        if (matchesType && nextNodeId) {
          processedEdges.add(edgeKey);
          const nextNode = graphData.nodes.find(
            (node) => node.id === nextNodeId
          );

          if (nextNode) {
            // 设置节点的层级为当前层级+1
            const nextDepth = currentDepth + 1;

            // 只有当这个节点不存在，或者存在但层级更大时才更新
            // 这确保节点总是以最短路径的层级被记录
            const nodesMap = relatedNodesMap.get(relationshipType);
            if (nodesMap) {
              const existingInfo = nodesMap.get(nextNodeId);
              if (!existingInfo || existingInfo[1] > nextDepth) {
                nodesMap.set(nextNodeId, [nextNode, nextDepth]);

                // 递归查找，层级递增
                findSameTypeRelationships(
                  nextNodeId,
                  relationshipType,
                  nextDepth,
                  maxDepth,
                  new Set(visited)
                );
              }
            }
          }
        }
      });
    };

    // 首先收集中心节点的直接关系
    collectDirectRelationships(centralNodeId);

    // 然后对每种关系类型进行递归查找
    for (const [type, nodesMap] of relatedNodesMap.entries()) {
      // 获取当前已收集的这种类型的直接关系节点
      const directRelationNodes = Array.from(nodesMap.entries());

      // 获取此关系类型的最大深度，如果没有配置则默认为3
      const maxDepth = depthConfig[type] || 3;

      // 对每个直接关系节点，递归查找相同类型的关系
      directRelationNodes.forEach(([nodeId, [node, depth]]) => {
        if (maxDepth > 1) {
          // 如果深度 > 1，才需要递归
          findSameTypeRelationships(nodeId, type, depth, maxDepth);
        }
      });
    }

    // 将Map转换为按层级排序的数组
    const createSortedNodeArray = (
      nodesMap: Map<string, [GraphNode, number]> | undefined
    ) => {
      if (!nodesMap) return [];
      return Array.from(nodesMap.values())
        .sort((a, b) => a[1] - b[1]) // 按层级排序
        .map(([node, depth]) => ({
          ...node,
          depth, // 将层级信息附加到节点上，供布局使用
        }));
    };

    // 处理未配置的关系类型 - 将其自动分配到对应象限
    // 创建象限对应的节点数组
    const topNodes: any[] = [];
    const bottomNodes: any[] = [];
    const leftNodes: any[] = [];
    const rightNodes: any[] = [];

    // 处理关系类型的分配
    relatedNodesMap.forEach((nodesMap, type) => {
      // 检查该类型是否被配置到任何关系组
      const isAssigned = assignedRelationshipTypes.includes(type);

      // 如果没有被配置，则根据配置进行分配
      if (!isAssigned) {
        // 如果指定了未配置关系类型的显示位置，使用该位置
        config.unconfiguredTypesPosition;
        // 根据指定的位置分配
        if (config.unconfiguredTypesPosition === QuadrantPosition.TOP) {
          topNodes.push(...createSortedNodeArray(nodesMap));
        } else if (
          config.unconfiguredTypesPosition === QuadrantPosition.BOTTOM
        ) {
          bottomNodes.push(...createSortedNodeArray(nodesMap));
        } else if (config.unconfiguredTypesPosition === QuadrantPosition.LEFT) {
          leftNodes.push(...createSortedNodeArray(nodesMap));
        } else if (
          config.unconfiguredTypesPosition === QuadrantPosition.RIGHT
        ) {
          rightNodes.push(...createSortedNodeArray(nodesMap));
        }
      } else {
        // 如果已配置，则根据配置添加
        if (config[QuadrantPosition.TOP].includes(type)) {
          topNodes.push(...createSortedNodeArray(nodesMap));
        }
        if (config[QuadrantPosition.BOTTOM].includes(type)) {
          bottomNodes.push(...createSortedNodeArray(nodesMap));
        }
        if (config[QuadrantPosition.LEFT].includes(type)) {
          leftNodes.push(...createSortedNodeArray(nodesMap));
        }
        if (config[QuadrantPosition.RIGHT].includes(type)) {
          rightNodes.push(...createSortedNodeArray(nodesMap));
        }
      }
    });

    return {
      centralNode: {
        ...centralNode,
        isCentralNode: true,
      },
      quadrants: {
        top: topNodes,
        bottom: bottomNodes,
        left: leftNodes,
        right: rightNodes,
      },
    };
  }
  static getOppositeRelationType = (relationType: string, config: QuadrantConfig): string => {
    // 检查是否在配置中定义了相对类型
    if (config.relationshipTypeConfig.oppositeTypes[relationType]) {
      return config.relationshipTypeConfig.oppositeTypes[relationType];
    }
    // 如果没有配置相对类型，则返回原类型（视为未知类型）
    return "unknown";
  };
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
    const verticalSpacing = 80; // 同一象限中节点的垂直间距

    // 象限的基础偏移量
    const baseQuadrantOffsetX = 250; // 水平象限（左/右）与中心的基础距离
    const baseQuadrantOffsetY = 180; // 垂直象限（上/下）与中心的基础距离

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
        depth: 0,
      },
    ];

    // 按层级分组节点
    const groupNodesByDepth = (nodes: any[]) => {
      const groupedNodes: { [key: number]: any[] } = {};

      nodes.forEach((node) => {
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
      const totalWidth =
        nodesInDepth.length * (nodeWidth + horizontalSpacing) -
        horizontalSpacing;
      const startX = centerX - totalWidth / 2;

      nodesInDepth.forEach((node: any, index: number) => {
        result.push({
          ...node,
          x: startX + index * (nodeWidth + horizontalSpacing),
          y: centerY - quadrantOffsetY - nodeHeight,
          width: nodeWidth,
          height: nodeHeight,
          quadrant: "top",
        });
      });
    });

    // 下方象限：按层级垂直排列，每层内部水平排列
    const bottomNodesByDepth = groupNodesByDepth(quadrants.bottom);
    Object.entries(bottomNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetY = baseQuadrantOffsetY + (depth - 1) * layerOffsetY;

      // 每层节点水平居中排列
      const totalWidth =
        nodesInDepth.length * (nodeWidth + horizontalSpacing) -
        horizontalSpacing;
      const startX = centerX - totalWidth / 2;

      nodesInDepth.forEach((node: any, index: number) => {
        result.push({
          ...node,
          x: startX + index * (nodeWidth + horizontalSpacing),
          y: centerY + quadrantOffsetY,
          width: nodeWidth,
          height: nodeHeight,
          quadrant: "bottom",
        });
      });
    });

    // 左侧象限：按层级水平排列，每层内部垂直排列
    const leftNodesByDepth = groupNodesByDepth(quadrants.left);
    Object.entries(leftNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetX = baseQuadrantOffsetX + (depth - 1) * layerOffsetX;

      // 每层节点垂直居中排列
      const totalHeight =
        nodesInDepth.length * (nodeHeight + verticalSpacing) - verticalSpacing;
      const startY = centerY - totalHeight / 2;

      nodesInDepth.forEach((node: any, index: number) => {
        result.push({
          ...node,
          x: centerX - quadrantOffsetX - nodeWidth,
          y: startY + index * (nodeHeight + verticalSpacing),
          width: nodeWidth,
          height: nodeHeight,
          quadrant: "left",
        });
      });
    });

    // 右侧象限：按层级水平排列，每层内部垂直排列
    const rightNodesByDepth = groupNodesByDepth(quadrants.right);
    Object.entries(rightNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetX = baseQuadrantOffsetX + (depth - 1) * layerOffsetX;

      // 每层节点垂直居中排列
      const totalHeight =
        nodesInDepth.length * (nodeHeight + verticalSpacing) - verticalSpacing;
      const startY = centerY - totalHeight / 2;

      nodesInDepth.forEach((node: any, index: number) => {
        result.push({
          ...node,
          x: centerX + quadrantOffsetX,
          y: startY + index * (nodeHeight + verticalSpacing),
          width: nodeWidth,
          height: nodeHeight,
          quadrant: "right",
        });
      });
    });

    return result;
  }

  /**
   * 确定边的源节点和目标节点的连接点
   * @param sourceId 源节点ID
   * @param targetId 目标节点ID
   * @param edgeType 关系类型
   * @param centralNodeId 中心节点ID
   * @param nodeQuadrantMap 节点象限映射
   * @param nodeDepthMap 节点深度映射
   * @param quadrantConfig 象限配置
   * @param isDirectFromCentral 是否从中心节点直接连出
   * @returns 连接点配置对象 {source, target}
   */
  static determineConnectionPoints(
    sourceId: string,
    targetId: string,
    edgeType: string,
    centralNodeId: string,
    nodeQuadrantMap: Map<string, string>,
    nodeDepthMap: Map<string, number>,
    quadrantConfig: QuadrantConfig,
    isDirectFromCentral: boolean
  ) {
    const sourceQuadrant = nodeQuadrantMap.get(sourceId) || 'center';
    const targetQuadrant = nodeQuadrantMap.get(targetId) || 'center';
    const sourceDepth = nodeDepthMap.get(sourceId) || 0;
    const targetDepth = nodeDepthMap.get(targetId) || 0;
    
    
    
    // 确定关系类型所属的象限
    const getRelationshipQuadrant = (relationType: string): QuadrantPosition => {
      if (quadrantConfig[QuadrantPosition.TOP].includes(relationType)) {
        return QuadrantPosition.TOP;
      } else if (quadrantConfig[QuadrantPosition.BOTTOM].includes(relationType)) {
        return QuadrantPosition.BOTTOM;
      } else if (quadrantConfig[QuadrantPosition.LEFT].includes(relationType)) {
        return QuadrantPosition.LEFT;
      } else if (quadrantConfig[QuadrantPosition.RIGHT].includes(relationType)) {
        return QuadrantPosition.RIGHT;
      }
      return quadrantConfig.unconfiguredTypesPosition;
    };
    
    // 考虑方向（入链/出链）
    // 如果不是从中心节点直接连出的边，并且目标是中心节点，那么这是一个入链
    let effectiveRelationType = edgeType;
    if (!isDirectFromCentral && targetId === centralNodeId) {
      // 入链，使用相对关系类型
      effectiveRelationType = GraphLayoutService.getOppositeRelationType(edgeType, quadrantConfig);
    }
    
    // 获取关系类型所属象限
    const relationQuadrant = getRelationshipQuadrant(effectiveRelationType);
    
    // 中心节点特殊处理
    if (sourceId === centralNodeId) {
      // 中心节点 -> 其他节点，根据关系类型的象限决定
      if (relationQuadrant === QuadrantPosition.TOP) return { source: 'top', target: 'bottom' };
      if (relationQuadrant === QuadrantPosition.BOTTOM) return { source: 'bottom', target: 'top' };
      if (relationQuadrant === QuadrantPosition.LEFT) return { source: 'left', target: 'right' };
      if (relationQuadrant === QuadrantPosition.RIGHT) return { source: 'right', target: 'left' };
    } else if (targetId === centralNodeId) {
      // 其他节点 -> 中心节点，根据关系类型的象限决定
      if (relationQuadrant === QuadrantPosition.TOP) return { source: 'bottom', target: 'top' };
      if (relationQuadrant === QuadrantPosition.BOTTOM) return { source: 'top', target: 'bottom' };
      if (relationQuadrant === QuadrantPosition.LEFT) return { source: 'right', target: 'left' };
      if (relationQuadrant === QuadrantPosition.RIGHT) return { source: 'left', target: 'right' };
    }
    
    // 处理同象限不同深度的节点
    if (sourceQuadrant === targetQuadrant) {
      if (sourceQuadrant === 'top') {
        return sourceDepth < targetDepth 
          ? { source: 'top', target: 'bottom' }     // 浅层 -> 深层
          : { source: 'bottom', target: 'top' };    // 深层 -> 浅层
      }
      if (sourceQuadrant === 'bottom') {
        return sourceDepth < targetDepth 
          ? { source: 'bottom', target: 'top' }     // 浅层 -> 深层
          : { source: 'top', target: 'bottom' };    // 深层 -> 浅层
      }
      if (sourceQuadrant === 'left') {
        return sourceDepth < targetDepth 
          ? { source: 'left', target: 'right' }     // 浅层 -> 深层
          : { source: 'right', target: 'left' };    // 深层 -> 浅层
      }
      if (sourceQuadrant === 'right') {
        return sourceDepth < targetDepth 
          ? { source: 'right', target: 'left' }     // 浅层 -> 深层
          : { source: 'left', target: 'right' };    // 深层 -> 浅层
      }
    }
    
    // 跨象限连接的默认规则
    return { source: 'center', target: 'center' };
  }
}
