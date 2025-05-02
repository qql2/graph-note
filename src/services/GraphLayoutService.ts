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

type OrganizedData = {
  centralNode: GraphNode;
  quadrants: {
    top: GraphNode[];
    bottom: GraphNode[];
    left: GraphNode[];
    right: GraphNode[];
  };
};

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
   * 在节点排布完成后检测并调整节点位置，避免重叠
   * @param nodes 已经排布位置的节点数组
   * @param minDistance 最小安全距离
   * @returns 调整后的节点数组
   */
  static resolveNodeOverlaps(nodes: any[], minDistance: number = 30) {
    if (!nodes || nodes.length < 2) return nodes;

    // 创建节点的副本，避免修改原始数据
    const adjustedNodes = [...nodes];
    
    // 节点之间的重叠检测函数
    const nodesOverlap = (node1: any, node2: any) => {
      // 计算安全距离系数，宽度较大的节点需要更大的安全距离
      const widthFactor = Math.max(node1.width, node2.width) / 100;
      const safetyFactor = Math.max(1, Math.min(1.5, widthFactor)); // 限制范围在1-1.5之间
      const effectiveMinDistance = minDistance * safetyFactor;
      
      // 节点的实际边界包含扩展的碰撞区域
      const n1 = {
        left: node1.x - effectiveMinDistance/2,
        right: node1.x + node1.width + effectiveMinDistance/2,
        top: node1.y - minDistance/2,
        bottom: node1.y + node1.height + minDistance/2
      };
      
      const n2 = {
        left: node2.x - effectiveMinDistance/2,
        right: node2.x + node2.width + effectiveMinDistance/2,
        top: node2.y - minDistance/2,
        bottom: node2.y + node2.height + minDistance/2
      };
      
      // 检查两个边界是否重叠
      return !(n1.right < n2.left || n1.left > n2.right || n1.bottom < n2.top || n1.top > n2.bottom);
    };
    
    // 计算两个节点中心点之间的距离
    const getDistance = (node1: any, node2: any) => {
      const center1 = {
        x: node1.x + node1.width / 2,
        y: node1.y + node1.height / 2
      };
      
      const center2 = {
        x: node2.x + node2.width / 2,
        y: node2.y + node2.height / 2
      };
      
      const dx = center2.x - center1.x;
      const dy = center2.y - center1.y;
      
      return Math.sqrt(dx * dx + dy * dy);
    };
    
    // 计算两个节点之间需要的调整向量
    const calculateAdjustment = (node1: any, node2: any) => {
      // 获取两个节点的中心点
      const center1 = {
        x: node1.x + node1.width / 2,
        y: node1.y + node1.height / 2
      };
      
      const center2 = {
        x: node2.x + node2.width / 2,
        y: node2.y + node2.height / 2
      };
      
      // 计算中心点之间的方向向量
      const dx = center2.x - center1.x;
      const dy = center2.y - center1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 计算所需的最小距离，考虑节点宽度
      const avgWidth = (node1.width + node2.width) / 2;
      const widthFactor = Math.max(1, avgWidth / 100);
      
      // 调整所需的最小距离，宽节点需要更大的间距
      const requiredDistance = (node1.width + node2.width) / 2 + 
                              (node1.height + node2.height) / 2 + 
                              minDistance * widthFactor;
      
      // 如果当前距离已经足够，不需要调整
      if (distance >= requiredDistance) return { dx: 0, dy: 0 };
      
      // 计算需要移动的距离
      const moveDistance = requiredDistance - distance;
      
      // 归一化方向向量并乘以移动距离
      const adjustFactor = moveDistance / distance;

      // 考虑节点所在的象限，增强对应方向的排斥力
      let enhancedDx = dx * adjustFactor;
      let enhancedDy = dy * adjustFactor;
      
      // 根据象限增强相应方向的排斥力
      if (node1.quadrant === 'top' || node1.quadrant === 'bottom') {
        // 对于上下象限，增强水平方向的排斥力
        enhancedDx *= 1.5;
      } else if (node1.quadrant === 'left' || node1.quadrant === 'right') {
        // 对于左右象限，增强垂直方向的排斥力
        enhancedDy *= 1.5;
      }
      
      return {
        dx: enhancedDx,
        dy: enhancedDy
      };
    };
    
    // 根据象限对节点应用不同的约束
    const applyConstraints = (node: any, adjustment: {dx: number, dy: number}) => {
      // 中心节点固定不动
      if (node.isCentralNode) return { dx: 0, dy: 0 };
      
      let { dx, dy } = adjustment;
      
      // 基于象限应用约束
      switch(node.quadrant) {
        case 'top':
        case 'bottom':
          // 上下象限的节点只能水平移动，保持层级垂直位置不变
          dy = 0; // 禁止任何垂直移动
          break;
        case 'left':
        case 'right':
          // 左右象限的节点只能垂直移动，保持层级水平位置不变
          dx = 0; // 禁止任何水平移动
          break;
      }
      
      return { dx, dy };
    };

    // 最大迭代次数，防止无限循环
    const MAX_ITERATIONS = 30; // 增加迭代次数以获得更好的结果
    let iterations = 0;
    let hasOverlaps = true;
    
    // 迭代调整直到无重叠或达到最大迭代次数
    while (hasOverlaps && iterations < MAX_ITERATIONS) {
      hasOverlaps = false;
      iterations++;
      
      // 为每个节点计算所有推力
      for (let i = 0; i < adjustedNodes.length; i++) {
        if (adjustedNodes[i].isCentralNode) continue; // 跳过中心节点
        
        let totalDx = 0;
        let totalDy = 0;
        let adjustmentCount = 0;
        
        for (let j = 0; j < adjustedNodes.length; j++) {
          if (i === j) continue; // 跳过自身
          
          // 检查是否需要调整
          if (nodesOverlap(adjustedNodes[i], adjustedNodes[j])) {
            hasOverlaps = true;
            const adjustment = calculateAdjustment(adjustedNodes[j], adjustedNodes[i]);
            const constrainedAdjustment = applyConstraints(adjustedNodes[i], adjustment);
            
            totalDx += constrainedAdjustment.dx;
            totalDy += constrainedAdjustment.dy;
            adjustmentCount++;
          }
        }
        
        // 如果有需要调整的重叠，应用平均调整值
        if (adjustmentCount > 0) {
          adjustedNodes[i].x += totalDx / adjustmentCount;
          adjustedNodes[i].y += totalDy / adjustmentCount;
        }
      }
      
      // 应用额外的均匀分布策略
      if (iterations % 5 === 0) { // 每5次迭代执行一次均匀化
        // 按象限分组节点
        const nodesByQuadrant: {[key: string]: any[]} = {
          'top': [],
          'bottom': [],
          'left': [],
          'right': []
        };
        
        // 收集各象限的节点
        for (const node of adjustedNodes) {
          if (node.isCentralNode) continue;
          if (node.quadrant && nodesByQuadrant[node.quadrant]) {
            nodesByQuadrant[node.quadrant].push(node);
          }
        }
        
        // 为水平排列的象限（上/下）进行水平均匀化
        ['top', 'bottom'].forEach(quadrant => {
          const quadrantNodes = nodesByQuadrant[quadrant];
          if (quadrantNodes.length > 1) {
            // 按水平位置排序
            quadrantNodes.sort((a, b) => a.x - b.x);
            
            // 找出整个象限节点的x范围
            const leftmostNode = quadrantNodes[0];
            const rightmostNode = quadrantNodes[quadrantNodes.length - 1];
            const totalWidth = (rightmostNode.x + rightmostNode.width) - leftmostNode.x;
            
            // 如果节点多于3个且距离足够，尝试均匀分布
            if (quadrantNodes.length >= 3 && totalWidth > quadrantNodes.length * (minDistance + 100)) {
              const idealSpacing = totalWidth / (quadrantNodes.length - 1);
              
              for (let i = 1; i < quadrantNodes.length - 1; i++) {
                // 理想位置
                const idealX = leftmostNode.x + i * idealSpacing;
                
                // 向理想位置靠近一点，但不是完全移动到那里
                quadrantNodes[i].x += (idealX - quadrantNodes[i].x) * 0.2;
              }
            }
          }
        });
        
        // 为垂直排列的象限（左/右）进行垂直均匀化
        ['left', 'right'].forEach(quadrant => {
          const quadrantNodes = nodesByQuadrant[quadrant];
          if (quadrantNodes.length > 1) {
            // 按垂直位置排序
            quadrantNodes.sort((a, b) => a.y - b.y);
            
            // 找出整个象限节点的y范围
            const topmostNode = quadrantNodes[0];
            const bottommostNode = quadrantNodes[quadrantNodes.length - 1];
            const totalHeight = (bottommostNode.y + bottommostNode.height) - topmostNode.y;
            
            // 如果节点多于3个且距离足够，尝试均匀分布
            if (quadrantNodes.length >= 3 && totalHeight > quadrantNodes.length * (minDistance + 50)) {
              const idealSpacing = totalHeight / (quadrantNodes.length - 1);
              
              for (let i = 1; i < quadrantNodes.length - 1; i++) {
                // 理想位置
                const idealY = topmostNode.y + i * idealSpacing;
                
                // 向理想位置靠近一点，但不是完全移动到那里
                quadrantNodes[i].y += (idealY - quadrantNodes[i].y) * 0.2;
              }
            }
          }
        });
      }
    }
    
    return adjustedNodes;
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

    // 节点尺寸计算函数 - 根据标签文本长度动态计算宽度
    const calculateNodeWidth = (label: string) => {
      // 估算每个字符的像素宽度 (中文约14px, 英文约8px, 平均约10px)
      const avgCharWidth = 10;
      // 根据文本长度计算宽度，加上左右内边距
      const calculatedWidth = (label?.length || 0) * avgCharWidth + 30;
      // 设置最小和最大宽度限制
      const minWidth = 80;
      const maxWidth = 200;
      return Math.max(minWidth, Math.min(calculatedWidth, maxWidth));
    };

    // 节点高度计算函数 - 基本上保持固定，但可以根据需要进行调整
    const calculateNodeHeight = (label: string, width: number) => {
      // 标准高度
      const standardHeight = 50;
      
      // 如果文本太长且节点宽度已达到最大，可能需要增加高度
      // 这里使用简单逻辑：如果文本长度大于宽度可以容纳的字符数的1.5倍，则增加高度
      const charCapacity = (width - 30) / 10; // 宽度能容纳的字符数
      if (label && label.length > charCapacity * 1.5) {
        // 计算需要多少行
        const estimatedLines = Math.ceil(label.length / charCapacity);
        // 限制最多3行
        const lines = Math.min(estimatedLines, 3);
        // 每增加一行增加15px高度
        return standardHeight + (lines - 1) * 15;
      }
      
      return standardHeight;
    };

    // 默认节点间距
    const horizontalSpacing = 120; // 同一象限中节点的水平间距
    const verticalSpacing = 80; // 同一象限中节点的垂直间距

    // 象限的基础偏移量
    const baseQuadrantOffsetX = 250; // 水平象限（左/右）与中心的基础距离
    const baseQuadrantOffsetY = 180; // 垂直象限（上/下）与中心的基础距离

    // 层级之间的最小间距
    const minLayerSpacingX = 150; // 水平方向层级之间的最小间距
    const minLayerSpacingY = 130; // 垂直方向层级之间的最小间距

    // 计算中心节点尺寸
    const centralNodeWidth = calculateNodeWidth(centralNode.label);
    const centralNodeHeight = calculateNodeHeight(centralNode.label, centralNodeWidth);

    // Result will contain node data with their positions
    const result= [
      {
        ...centralNode,
        x: centerX - centralNodeWidth / 2,
        y: centerY - centralNodeHeight / 2,
        width: centralNodeWidth,
        height: centralNodeHeight,
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
    
    // 保存每层的最大高度，用于计算层级间距
    const topLayersMaxHeight: {[key: number]: number} = {};
    
    // 首先计算所有层节点的尺寸
    Object.entries(topNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      
      // 计算每个节点的宽度和高度
      const nodeDimensions = nodesInDepth.map((node: any) => {
        const nodeWidth = calculateNodeWidth(node.label);
        const nodeHeight = calculateNodeHeight(node.label, nodeWidth);
        return { width: nodeWidth, height: nodeHeight };
      });
      
      // 找出该层最高的节点
      const maxHeight = nodeDimensions.reduce((max, dim) => Math.max(max, dim.height), 0);
      
      // 保存该层的最大高度
      topLayersMaxHeight[depth] = maxHeight;
    });
    
    // 计算每层的垂直偏移量，考虑前面层的节点高度
    const topLayerOffsetY: {[key: number]: number} = {};
    let currentTopOffset = baseQuadrantOffsetY;
    
    Object.keys(topLayersMaxHeight)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((depth) => {
        if (depth === 1) {
          // 第一层使用基础偏移
          topLayerOffsetY[depth] = currentTopOffset;
        } else {
          // 后续层考虑前一层的最大高度和最小间距
          const prevLayerHeight = topLayersMaxHeight[depth - 1];
          currentTopOffset += prevLayerHeight + minLayerSpacingY;
          topLayerOffsetY[depth] = currentTopOffset;
        }
      });
    
    // 然后再渲染节点，使用计算好的偏移量
    Object.entries(topNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetY = topLayerOffsetY[depth] || baseQuadrantOffsetY;

      // 计算每个节点的宽度和高度
      const nodeDimensions = nodesInDepth.map((node: any) => {
        const nodeWidth = calculateNodeWidth(node.label);
        const nodeHeight = calculateNodeHeight(node.label, nodeWidth);
        return { width: nodeWidth, height: nodeHeight };
      });
      
      // 计算该层节点的总宽度
      let totalWidth = 0;
      for (let i = 0; i < nodesInDepth.length; i++) {
        totalWidth += nodeDimensions[i].width;
        if (i < nodesInDepth.length - 1) {
          totalWidth += horizontalSpacing;
        }
      }
      
      // 每层节点水平居中排列
      const startX = centerX - totalWidth / 2;

      let currentX = startX;
      for (let i = 0; i < nodesInDepth.length; i++) {
        const nodeWidth = nodeDimensions[i].width;
        const nodeHeight = nodeDimensions[i].height;
        result.push({
          ...nodesInDepth[i],
          x: currentX,
          y: centerY - quadrantOffsetY - nodeHeight,
          width: nodeWidth,
          height: nodeHeight,
          quadrant: "top",
        });
        currentX += nodeWidth + horizontalSpacing;
      }
    });

    // 下方象限：按层级垂直排列，每层内部水平排列
    const bottomNodesByDepth = groupNodesByDepth(quadrants.bottom);
    
    // 保存每层的最大高度，用于计算层级间距
    const bottomLayersMaxHeight: {[key: number]: number} = {};
    
    // 首先计算所有层节点的尺寸
    Object.entries(bottomNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      
      // 计算每个节点的宽度和高度
      const nodeDimensions = nodesInDepth.map((node: any) => {
        const nodeWidth = calculateNodeWidth(node.label);
        const nodeHeight = calculateNodeHeight(node.label, nodeWidth);
        return { width: nodeWidth, height: nodeHeight };
      });
      
      // 找出该层最高的节点
      const maxHeight = nodeDimensions.reduce((max, dim) => Math.max(max, dim.height), 0);
      
      // 保存该层的最大高度
      bottomLayersMaxHeight[depth] = maxHeight;
    });
    
    // 计算每层的垂直偏移量
    const bottomLayerOffsetY: {[key: number]: number} = {};
    let currentBottomOffset = baseQuadrantOffsetY;
    
    Object.keys(bottomLayersMaxHeight)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((depth) => {
        if (depth === 1) {
          // 第一层使用基础偏移
          bottomLayerOffsetY[depth] = currentBottomOffset;
        } else {
          // 后续层考虑前一层的最大高度和最小间距
          const prevLayerHeight = bottomLayersMaxHeight[depth - 1];
          currentBottomOffset += prevLayerHeight + minLayerSpacingY;
          bottomLayerOffsetY[depth] = currentBottomOffset;
        }
      });
      
    // 然后渲染节点，使用计算好的偏移量
    Object.entries(bottomNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetY = bottomLayerOffsetY[depth] || baseQuadrantOffsetY;

      // 计算每个节点的宽度和高度
      const nodeDimensions = nodesInDepth.map((node: any) => {
        const nodeWidth = calculateNodeWidth(node.label);
        const nodeHeight = calculateNodeHeight(node.label, nodeWidth);
        return { width: nodeWidth, height: nodeHeight };
      });
      
      // 计算该层节点的总宽度
      let totalWidth = 0;
      for (let i = 0; i < nodesInDepth.length; i++) {
        totalWidth += nodeDimensions[i].width;
        if (i < nodesInDepth.length - 1) {
          totalWidth += horizontalSpacing;
        }
      }
      
      // 每层节点水平居中排列
      const startX = centerX - totalWidth / 2;

      let currentX = startX;
      for (let i = 0; i < nodesInDepth.length; i++) {
        const nodeWidth = nodeDimensions[i].width;
        const nodeHeight = nodeDimensions[i].height;
        result.push({
          ...nodesInDepth[i],
          x: currentX,
          y: centerY + quadrantOffsetY,
          width: nodeWidth,
          height: nodeHeight,
          quadrant: "bottom",
        });
        currentX += nodeWidth + horizontalSpacing;
      }
    });

    // 左侧象限：按层级水平排列，每层内部垂直排列
    const leftNodesByDepth = groupNodesByDepth(quadrants.left);
    
    // 保存每层的最大宽度，用于计算层级间距
    const leftLayersMaxWidth: {[key: number]: number} = {};
    
    // 首先计算所有层节点的尺寸
    Object.entries(leftNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      
      // 计算每个节点的宽度和高度
      const nodeDimensions = nodesInDepth.map((node: any) => {
        const nodeWidth = calculateNodeWidth(node.label);
        const nodeHeight = calculateNodeHeight(node.label, nodeWidth);
        return { width: nodeWidth, height: nodeHeight };
      });
      
      // 找出该层最宽的节点
      const maxWidth = nodeDimensions.reduce((max, dim) => Math.max(max, dim.width), 0);
      
      // 保存该层的最大宽度
      leftLayersMaxWidth[depth] = maxWidth;
    });
    
    // 计算每层的水平偏移量
    const leftLayerOffsetX: {[key: number]: number} = {};
    let currentLeftOffset = baseQuadrantOffsetX;
    
    Object.keys(leftLayersMaxWidth)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((depth) => {
        if (depth === 1) {
          // 第一层使用基础偏移
          leftLayerOffsetX[depth] = currentLeftOffset;
        } else {
          // 后续层考虑前一层的最大宽度和最小间距
          const prevLayerWidth = leftLayersMaxWidth[depth - 1];
          currentLeftOffset += prevLayerWidth + minLayerSpacingX;
          leftLayerOffsetX[depth] = currentLeftOffset;
        }
      });
      
    // 然后渲染节点，使用计算好的偏移量
    Object.entries(leftNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetX = leftLayerOffsetX[depth] || baseQuadrantOffsetX;

      // 计算每个节点的宽度和高度
      const nodeDimensions = nodesInDepth.map((node: any) => {
        const nodeWidth = calculateNodeWidth(node.label);
        const nodeHeight = calculateNodeHeight(node.label, nodeWidth);
        return { width: nodeWidth, height: nodeHeight };
      });

      // 计算垂直间距之和
      let totalVerticalGap = verticalSpacing * (nodesInDepth.length - 1);
      
      // 计算该层节点的总高度
      const totalHeight = nodeDimensions.reduce((sum, dim) => sum + dim.height, 0) + totalVerticalGap;
      
      // 该层节点垂直居中排列
      const startY = centerY - totalHeight / 2;

      let currentY = startY;
      for (let i = 0; i < nodesInDepth.length; i++) {
        const nodeWidth = nodeDimensions[i].width;
        const nodeHeight = nodeDimensions[i].height;
        result.push({
          ...nodesInDepth[i],
          x: centerX - quadrantOffsetX - nodeWidth,
          y: currentY,
          width: nodeWidth,
          height: nodeHeight,
          quadrant: "left",
        });
        currentY += nodeHeight + verticalSpacing;
      }
    });

    // 右侧象限：按层级水平排列，每层内部垂直排列
    const rightNodesByDepth = groupNodesByDepth(quadrants.right);
    
    // 保存每层的最大宽度，用于计算层级间距
    const rightLayersMaxWidth: {[key: number]: number} = {};
    
    // 首先计算所有层节点的尺寸
    Object.entries(rightNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      
      // 计算每个节点的宽度和高度
      const nodeDimensions = nodesInDepth.map((node: any) => {
        const nodeWidth = calculateNodeWidth(node.label);
        const nodeHeight = calculateNodeHeight(node.label, nodeWidth);
        return { width: nodeWidth, height: nodeHeight };
      });
      
      // 找出该层最宽的节点
      const maxWidth = nodeDimensions.reduce((max, dim) => Math.max(max, dim.width), 0);
      
      // 保存该层的最大宽度
      rightLayersMaxWidth[depth] = maxWidth;
    });
    
    // 计算每层的水平偏移量
    const rightLayerOffsetX: {[key: number]: number} = {};
    let currentRightOffset = baseQuadrantOffsetX;
    
    Object.keys(rightLayersMaxWidth)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((depth) => {
        if (depth === 1) {
          // 第一层使用基础偏移
          rightLayerOffsetX[depth] = currentRightOffset;
        } else {
          // 后续层考虑前一层的最大宽度和最小间距
          const prevLayerWidth = rightLayersMaxWidth[depth - 1];
          currentRightOffset += prevLayerWidth + minLayerSpacingX;
          rightLayerOffsetX[depth] = currentRightOffset;
        }
      });
      
    // 然后渲染节点，使用计算好的偏移量
    Object.entries(rightNodesByDepth).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const quadrantOffsetX = rightLayerOffsetX[depth] || baseQuadrantOffsetX;

      // 计算每个节点的宽度和高度
      const nodeDimensions = nodesInDepth.map((node: any) => {
        const nodeWidth = calculateNodeWidth(node.label);
        const nodeHeight = calculateNodeHeight(node.label, nodeWidth);
        return { width: nodeWidth, height: nodeHeight };
      });
      
      // 计算垂直间距之和
      let totalVerticalGap = verticalSpacing * (nodesInDepth.length - 1);
      
      // 计算该层节点的总高度
      const totalHeight = nodeDimensions.reduce((sum, dim) => sum + dim.height, 0) + totalVerticalGap;
      
      // 该层节点垂直居中排列
      const startY = centerY - totalHeight / 2;

      let currentY = startY;
      for (let i = 0; i < nodesInDepth.length; i++) {
        const nodeWidth = nodeDimensions[i].width;
        const nodeHeight = nodeDimensions[i].height;
        result.push({
          ...nodesInDepth[i],
          x: centerX + quadrantOffsetX,
          y: currentY,
          width: nodeWidth,
          height: nodeHeight,
          quadrant: "right",
        });
        currentY += nodeHeight + verticalSpacing;
      }
    });

    // 返回结果前应用碰撞检测和位置调整
    return this.resolveNodeOverlaps(result, Math.min(horizontalSpacing, verticalSpacing) * 0.4);
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
