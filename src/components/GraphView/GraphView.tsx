import React, { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/x6';
import { GraphData, QuadrantConfig, defaultQuadrantConfig, DepthConfig, defaultDepthConfig, ViewConfig, defaultViewConfig, RelationshipLabelMode, RelationshipType } from '../../models/GraphNode';
import { GraphLayoutService } from '../../services/GraphLayoutService';
import ContextMenu from '../ContextMenu';
import { pencil, trash, copy, add } from 'ionicons/icons';
import './GraphView.css';

interface GraphViewProps {
  graphData: GraphData;
  centralNodeId: string;
  quadrantConfig?: QuadrantConfig;
  depthConfig?: DepthConfig;  // 添加深度配置属性
  viewConfig?: ViewConfig;    // 添加视图配置属性
  navbarHeight?: number; // 添加导航栏高度参数
  onNodeClick?: (nodeId: string) => void;
  onEditNode?: (nodeId: string, label: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onEditEdge?: (edgeId: string, label: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onCreateRelation?: (sourceNodeId: string, relationType: RelationshipType) => void;
}

// 关系类型到简短标签的映射
const relationshipToSimpleLabel = {
  [RelationshipType.FATHER]: 'F',
  [RelationshipType.CHILD]: 'C',
  [RelationshipType.BASE]: 'Ba',
  [RelationshipType.BUILD]: 'Bu',
};

// 定义菜单项接口
interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

// 定义右键菜单状态接口
interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  items: MenuItem[];
  targetId: string;
  type: 'node' | 'edge' | '';
}

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
  navbarHeight = 56, // 默认 Ionic 导航栏高度
  onNodeClick,
  onEditNode,
  onDeleteNode,
  onEditEdge,
  onDeleteEdge,
  onCreateRelation
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    items: [],
    targetId: '',
    type: ''
  });

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

  // 关闭上下文菜单
  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  // 处理节点右键菜单
  const handleNodeContextMenu = (node: any, event: any) => {
    event.preventDefault();
    
    const nodeId = node.id;
    const isCenter = nodeId === centralNodeId;
    const menuItems: MenuItem[] = [];
    
    // 编辑节点菜单项
    if (onEditNode) {
      menuItems.push({
        id: 'edit-node',
        label: '编辑节点',
        icon: pencil,
        onClick: () => {
          // 暂时使用 prompt，实际项目中应该用更好的 UI
          const newLabel = prompt('编辑节点名称:', node.attrs.label.text);
          if (newLabel !== null && newLabel.trim() !== '') {
            onEditNode(nodeId, newLabel.trim());
          }
        }
      });
    }
    
    // 创建关系菜单项（仅对中心节点显示）
    if (isCenter && onCreateRelation) {
      // 添加默认关系类型
      menuItems.push({
        id: 'create-father',
        label: '添加父节点关系',
        icon: add,
        onClick: () => onCreateRelation(nodeId, RelationshipType.FATHER)
      });
      
      menuItems.push({
        id: 'create-child',
        label: '添加子节点关系',
        icon: add,
        onClick: () => onCreateRelation(nodeId, RelationshipType.CHILD)
      });
      
      menuItems.push({
        id: 'create-base',
        label: '添加基础关系',
        icon: add,
        onClick: () => onCreateRelation(nodeId, RelationshipType.BASE)
      });
      
      menuItems.push({
        id: 'create-build',
        label: '添加构建关系',
        icon: add,
        onClick: () => onCreateRelation(nodeId, RelationshipType.BUILD)
      });
      
      // 添加自定义关系（实际实现中需要弹出输入框）
      menuItems.push({
        id: 'create-custom',
        label: '添加自定义关系',
        icon: add,
        onClick: () => {
          const customType = prompt('请输入自定义关系名称:');
          if (customType && customType.trim() !== '') {
            // 这里需要根据实际实现处理自定义关系的创建
            alert(`暂不支持自定义关系类型: ${customType}`);
          }
        }
      });
    }
    
    // 删除节点菜单项
    if (onDeleteNode) {
      menuItems.push({
        id: 'delete-node',
        label: '删除节点',
        icon: trash,
        onClick: () => {
          if (confirm('确定要删除此节点吗？')) {
            onDeleteNode(nodeId);
          }
        }
      });
    }
    
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      items: menuItems,
      targetId: nodeId,
      type: 'node'
    });
  };
  
  // 处理边右键菜单
  const handleEdgeContextMenu = (edge: any, event: any) => {
    event.preventDefault();
    
    const edgeId = edge.id;
    const menuItems: MenuItem[] = [];
    
    // 编辑边菜单项
    if (onEditEdge) {
      menuItems.push({
        id: 'edit-edge',
        label: '编辑关系',
        icon: pencil,
        onClick: () => {
          // 暂时使用 prompt，实际项目中应该用更好的 UI
          const currentLabel = edge.getLabels()?.[0]?.attrs?.text?.text || edge.data.relationshipType;
          const newLabel = prompt('编辑关系名称:', currentLabel);
          if (newLabel !== null && newLabel.trim() !== '') {
            onEditEdge(edgeId, newLabel.trim());
          }
        }
      });
    }
    
    // 删除边菜单项
    if (onDeleteEdge) {
      menuItems.push({
        id: 'delete-edge',
        label: '删除关系',
        icon: trash,
        onClick: () => {
          if (confirm('确定要删除此关系吗？')) {
            onDeleteEdge(edgeId);
          }
        }
      });
    }
    
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      items: menuItems,
      targetId: edgeId,
      type: 'edge'
    });
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
        color: 'var(--ion-background-color, #F5F5F5)',  // Use theme background color
      },
      grid: {
        visible: true,
        size: 10,
        type: 'dot',
        args: {
          color: 'var(--ion-color-medium-tint, rgba(0, 0, 0, 0.1))', // Use theme color for grid
          thickness: 1,
        },
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
    
    // 注册节点右键菜单事件
    newGraph.on('node:contextmenu', ({ cell, e }) => {
      handleNodeContextMenu(cell, e);
    });
    
    // 注册边右键菜单事件
    newGraph.on('edge:contextmenu', ({ cell, e }) => {
      handleEdgeContextMenu(cell, e);
    });
    
    // 点击画布空白处关闭菜单
    newGraph.on('blank:click', () => {
      closeContextMenu();
    });

    setGraph(newGraph);

    // Cleanup on unmount
    return () => {
      newGraph.dispose();
    };
  }, [containerRef, onNodeClick, onEditNode, onDeleteNode, onEditEdge, onDeleteEdge, onCreateRelation]);

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
      
      // Different styles based on node type using Ionic theme variables
      const nodeFill = isCentralNode ? 'var(--ion-color-warning, #FF9800)' : 
                       quadrant === 'top' ? 'var(--ion-color-success, #4CAF50)' : 
                       quadrant === 'bottom' ? 'var(--ion-color-primary, #2196F3)' : 
                       quadrant === 'left' ? 'var(--ion-color-tertiary, #9C27B0)' : 
                       quadrant === 'right' ? 'var(--ion-color-danger, #F44336)' : 
                       'var(--ion-color-medium, #607D8B)';

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
        const edgeColor = edgeData.relationshipType === quadrantConfig.top ? 'var(--ion-color-success, #4CAF50)' :
                         edgeData.relationshipType === quadrantConfig.bottom ? 'var(--ion-color-primary, #2196F3)' :
                         edgeData.relationshipType === quadrantConfig.left ? 'var(--ion-color-tertiary, #9C27B0)' :
                         edgeData.relationshipType === quadrantConfig.right ? 'var(--ion-color-danger, #F44336)' :
                         'var(--ion-color-medium, #607D8B)';
        
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
                  fill: 'var(--ion-text-color, #333)',
                  fontSize: 10,
                  textAnchor: 'middle',
                  textVerticalAnchor: 'middle',
                  pointerEvents: 'none',
                },
                rect: {
                  fill: 'var(--ion-background-color, rgba(255, 255, 255, 0.8))',
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
      
      {/* 右键菜单组件 */}
      <ContextMenu 
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        items={contextMenu.items}
        onClose={closeContextMenu}
        navbarHeight={navbarHeight} // 传入导航栏高度
      />
    </div>
  );
};

export default GraphView; 