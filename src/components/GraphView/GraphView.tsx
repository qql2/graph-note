import React, { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/x6';
import { GraphData, QuadrantConfig, defaultQuadrantConfig, DepthConfig, defaultDepthConfig, ViewConfig, defaultViewConfig, RelationshipLabelMode, RelationshipType } from '../../models/GraphNode';
import { GraphLayoutService } from '../../services/GraphLayoutService';
import './GraphView.css';

interface GraphViewProps {
  graphData: GraphData;
  centralNodeId: string;
  quadrantConfig?: QuadrantConfig;
  depthConfig?: DepthConfig;  // 添加深度配置属性
  viewConfig?: ViewConfig;    // 添加视图配置属性
  onNodeClick?: (nodeId: string) => void;
}

// 关系类型到简短标签的映射
const relationshipToSimpleLabel = {
  [RelationshipType.FATHER]: 'F',
  [RelationshipType.CHILD]: 'C',
  [RelationshipType.BASE]: 'Ba',
  [RelationshipType.BUILD]: 'Bu',
};

// 注册自定义节点
Graph.registerNode(
  'graph-node',
  {
    inherit: 'rect',
    attrs: {
      body: {
        strokeWidth: 1,
        stroke: '#000',
        rx: 6,
        ry: 6,
      },
      label: {
        fontSize: 14,
        fill: '#fff',
      },
    },
    // 自定义锚点位置，定义在节点的上、下、左、右四个位置
    ports: {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#31d0c6',
              fill: '#fff',
              strokeWidth: 1,
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#31d0c6',
              fill: '#fff',
              strokeWidth: 1,
            },
          },
        },
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#31d0c6',
              fill: '#fff',
              strokeWidth: 1,
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#31d0c6',
              fill: '#fff',
              strokeWidth: 1,
            },
          },
        },
      },
      items: [
        { group: 'top', id: 'top' },
        { group: 'bottom', id: 'bottom' },
        { group: 'left', id: 'left' },
        { group: 'right', id: 'right' },
      ],
    },
  },
  true
);

// 注册自定义边
Graph.registerEdge(
  'graph-edge',
  {
    inherit: 'edge',
    attrs: {
      line: {
        strokeWidth: 2,
        targetMarker: {
          name: 'classic',
          size: 8,
        },
      },
      // 添加标签样式
      label: {
        fontSize: 10,
        fill: '#333',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
        pointerEvents: 'none',
        refX: 0.5, // 水平居中
        refY: -6,  // 稍微向上偏移
        background: {
          fill: 'rgba(255, 255, 255, 0.8)',
          rx: 3,
          ry: 3,
          padding: [2, 4],
        },
      },
    },
    connector: {
      name: 'rounded',
      args: {
        radius: 8,
      },
    },
    router: {
      name: 'normal',
    },
  },
  true
);

const GraphView: React.FC<GraphViewProps> = ({
  graphData,
  centralNodeId,
  quadrantConfig = defaultQuadrantConfig,
  depthConfig = defaultDepthConfig,  // 使用默认深度配置
  viewConfig = defaultViewConfig,    // 使用默认视图配置
  onNodeClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<Graph | null>(null);

  // 处理缩放和重置视图的函数
  const handleZoomIn = () => {
    if (graph) {
      const zoom = graph.zoom();
      if (zoom < 2) {
        graph.zoom(zoom + 0.1);
      }
    }
  };

  const handleZoomOut = () => {
    if (graph) {
      const zoom = graph.zoom();
      if (zoom > 0.5) {
        graph.zoom(zoom - 0.1);
      }
    }
  };

  const handleResetView = () => {
    if (graph) {
      graph.zoomTo(1);
      graph.centerContent();
    }
  };

  // Initialize the graph when the component mounts
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing graph
    if (graph) {
      graph.dispose();
    }

    // Create a new graph instance
    const newGraph = new Graph({
      container: containerRef.current,
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
      background: {
        color: '#F5F5F5',  // Light background
      },
      grid: {
        visible: true,
        size: 10,
        type: 'dot',
      },
      connecting: {
        router: 'normal',
        connector: {
          name: 'rounded',
          args: {
            radius: 8,
          },
        },
        validateConnection: () => false, // Prevent interactive connections
      },
      interacting: {
        nodeMovable: false, // Prevent node dragging
      },
      mousewheel: {
        enabled: true,      // 启用鼠标滚轮缩放
        zoomAtMousePosition: true,
        modifiers: 'ctrl',  // Ctrl键+滚轮进行缩放
        minScale: 0.5,
        maxScale: 2,
      },
      panning: {
        enabled: true,      // 启用画布平移
      },
    });

    // Register node click event
    newGraph.on('node:click', ({ node }) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    });

    setGraph(newGraph);

    // Cleanup on unmount
    return () => {
      newGraph.dispose();
    };
  }, [containerRef]);

  // Render the graph when data or central node changes
  useEffect(() => {
    if (!graph || !graphData || !centralNodeId || !containerRef.current) return;

    // Clear the graph
    graph.clearCells();

    // Organize and layout the graph data
    const organizedData = GraphLayoutService.organizeByQuadrants(
      graphData, 
      centralNodeId, 
      quadrantConfig,
      depthConfig  // 传递深度配置
    );

    // Calculate positions for each node
    const layoutData = GraphLayoutService.calculateQuadrantLayout(
      organizedData,
      containerRef.current.offsetWidth,
      containerRef.current.offsetHeight
    );

    // 节点和其quadrant的映射，用于决定连接点
    const nodeQuadrantMap = new Map();
    const nodeDepthMap = new Map();

    // Add nodes to the graph
    const nodes = layoutData.map((nodeData: any) => {
      const { id, x, y, width, height, label, isCentralNode, quadrant, depth } = nodeData;
      
      // 存储节点的象限和深度信息，用于后续确定边的连接点
      nodeQuadrantMap.set(id, quadrant || 'center');
      nodeDepthMap.set(id, depth || 0);
      
      // Different styles based on node type
      const nodeFill = isCentralNode ? '#FF9800' : 
                       quadrant === 'top' ? '#4CAF50' : 
                       quadrant === 'bottom' ? '#2196F3' : 
                       quadrant === 'left' ? '#9C27B0' : 
                       quadrant === 'right' ? '#F44336' : 
                       '#607D8B';

      return graph.addNode({
        id,
        x,
        y,
        width,
        height,
        shape: 'graph-node',
        attrs: {
          body: {
            fill: nodeFill,
          },
          label: {
            text: label || id,
            fontWeight: isCentralNode ? 'bold' : 'normal',
          },
        },
        data: {
          isCentralNode,
          quadrant,
          depth,
        },
      });
    });

    // 确定边的源节点和目标节点的连接点
    const determineConnectionPoints = (sourceId: string, targetId: string) => {
      const sourceQuadrant = nodeQuadrantMap.get(sourceId) || 'center';
      const targetQuadrant = nodeQuadrantMap.get(targetId) || 'center';
      const sourceDepth = nodeDepthMap.get(sourceId) || 0;
      const targetDepth = nodeDepthMap.get(targetId) || 0;
      
      // 中心节点特殊处理
      if (sourceId === centralNodeId) {
        // 中心节点 -> 其他节点
        if (targetQuadrant === 'top') return { source: 'top', target: 'bottom' };
        if (targetQuadrant === 'bottom') return { source: 'bottom', target: 'top' };
        if (targetQuadrant === 'left') return { source: 'left', target: 'right' };
        if (targetQuadrant === 'right') return { source: 'right', target: 'left' };
      } else if (targetId === centralNodeId) {
        // 其他节点 -> 中心节点
        if (sourceQuadrant === 'top') return { source: 'bottom', target: 'top' };
        if (sourceQuadrant === 'bottom') return { source: 'top', target: 'bottom' };
        if (sourceQuadrant === 'left') return { source: 'right', target: 'left' };
        if (sourceQuadrant === 'right') return { source: 'left', target: 'right' };
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
    };

    // 获取关系类型的显示标签
    const getRelationshipLabel = (relationshipType: RelationshipType) => {
      if (viewConfig.showRelationshipLabels === RelationshipLabelMode.NONE) {
        return null;
      } else if (viewConfig.showRelationshipLabels === RelationshipLabelMode.SIMPLE) {
        return relationshipToSimpleLabel[relationshipType] || '';
      } else {
        return relationshipType;
      }
    };

    // Create edges between nodes
    graphData.edges.forEach((edgeData) => {
      // Check if both source and target nodes exist in our layout
      const sourceExists = nodes.some(node => node.id === edgeData.source);
      const targetExists = nodes.some(node => node.id === edgeData.target);
      
      if (sourceExists && targetExists) {
        const edgeColor = edgeData.relationshipType === quadrantConfig.top ? '#4CAF50' :
                         edgeData.relationshipType === quadrantConfig.bottom ? '#2196F3' :
                         edgeData.relationshipType === quadrantConfig.left ? '#9C27B0' :
                         edgeData.relationshipType === quadrantConfig.right ? '#F44336' :
                         '#607D8B';
        
        // 确定连接点
        const { source: sourcePort, target: targetPort } = determineConnectionPoints(
          edgeData.source, 
          edgeData.target
        );
        
        // 获取关系类型标签
        const relationshipLabel = getRelationshipLabel(edgeData.relationshipType);
        
        // 创建边的基本属性
        const edgeOptions: any = {
          id: edgeData.id,
          source: {
            cell: edgeData.source,
            port: sourcePort
          },
          target: {
            cell: edgeData.target,
            port: targetPort
          },
          shape: 'graph-edge',
          attrs: {
            line: {
              stroke: edgeColor,
            },
          },
          data: {
            relationshipType: edgeData.relationshipType,
          },
        };
        
        // 只在有标签时添加标签
        if (relationshipLabel) {
          // 直接在边对象上设置label数组
          edgeOptions.labels = [
            {
              position: 0.5,
              attrs: {
                text: {
                  text: relationshipLabel,
                  fill: '#333',
                  fontSize: 10,
                  textAnchor: 'middle',
                  textVerticalAnchor: 'middle',
                  pointerEvents: 'none',
                },
                rect: {
                  fill: 'rgba(255, 255, 255, 0.8)',
                  stroke: edgeColor,
                  strokeWidth: 0.5,
                  rx: 3,
                  ry: 3,
                },
              },
            },
          ];
        }
        
        // 添加边到图中
        graph.addEdge(edgeOptions);
      }
    });

    // Center the view
    graph.centerContent();

  }, [graph, graphData, centralNodeId, quadrantConfig, depthConfig, viewConfig]);

  return (
    <div className="graph-view-container">
      <div className="graph-view-controls">
        <button className="graph-view-control-button" onClick={handleZoomIn} title="放大">+</button>
        <button className="graph-view-control-button" onClick={handleZoomOut} title="缩小">-</button>
        <button className="graph-view-control-button" onClick={handleResetView} title="重置视图">⟲</button>
      </div>
      <div className="graph-view" ref={containerRef}></div>
    </div>
  );
};

export default GraphView; 