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

  // 在组件内部添加状态以跟踪当前正在编辑的节点和边
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  // 存储所有现有的关系类型，用于自动补全
  const [existingRelationshipLabels, setExistingRelationshipLabels] = useState<string[]>([]);

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
          // 找到节点并设置为编辑状态
          const nodeCell = graph?.getCellById(nodeId);
          if (nodeCell) {
            setEditingNodeId(nodeId);
            setInputValue(node.attrs.label.text);
            
            // 为了让用户看到编辑状态，更新节点样式
            nodeCell.setAttrs({
              label: {
                text: node.attrs.label.text,
                fill: '#333', // 改变文字颜色
                class: 'editing-node'
              },
              body: {
                stroke: '#1a73e8', // 增加边框高亮
                strokeWidth: 2,
              }
            });
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
          // 设置编辑状态并记录当前标签值
          setEditingEdgeId(edge.id);
          
          // 获取边的数据
          const edgeData = edge.getData();
          const relationshipType = edgeData?.relationshipType as keyof typeof relationshipToSimpleLabel;
          
          // 根据当前视图配置获取正确的标签
          let currentLabel = '';
          
          if (relationshipType) {
            if (viewConfig.showRelationshipLabels === RelationshipLabelMode.SIMPLE) {
              // 简短模式使用简短标签
              currentLabel = relationshipType in relationshipToSimpleLabel ? 
                relationshipToSimpleLabel[relationshipType] : 
                relationshipType as string;
            } else if (viewConfig.showRelationshipLabels === RelationshipLabelMode.FULL) {
              // 完整模式使用完整关系名称
              currentLabel = relationshipType as string;
            }
          }
          
          // 如果存在标签，优先使用边上显示的标签
          if (edge.labels && edge.labels.length > 0 && edge.labels[0].attrs.text.text) {
            currentLabel = edge.labels[0].attrs.text.text;
          }
          
          setInputValue(currentLabel);
          
          // 高亮显示正在编辑的边
          const edgeCell = graph?.getCellById(edge.id);
          if (edgeCell) {
            edgeCell.setAttrs({
              line: {
                strokeWidth: 3,
                stroke: '#1a73e8',
              }
            });
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
    const getRelationshipLabel = (edge: { relationshipType: RelationshipType; properties?: Record<string, any> }) => {
      if (viewConfig.showRelationshipLabels === RelationshipLabelMode.NONE) {
        return null;
      } 
      
      // 如果是简洁模式
      if (viewConfig.showRelationshipLabels === RelationshipLabelMode.SIMPLE) {
        // 如果边的属性中有 shortLabel，优先使用
        if (edge.properties && 'shortLabel' in edge.properties) {
          return edge.properties.shortLabel;
        }
        // 否则使用默认的简短标签映射
        return relationshipToSimpleLabel[edge.relationshipType] || '';
      } 
      
      // 完整模式
      return edge.relationshipType;
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
        const relationshipLabel = getRelationshipLabel(edgeData);
        
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

    // 在图表初始化时收集所有现有的关系类型标签
    const relationshipLabels = new Set<string>();
    graphData.edges.forEach(edge => {
      // 添加关系类型的全名
      relationshipLabels.add(edge.relationshipType);
      
      // 如果存在自定义关系标签，也添加它们
      if (edge.metadata?.label) {
        relationshipLabels.add(edge.metadata.label);
      }
    });
    setExistingRelationshipLabels(Array.from(relationshipLabels));
    
    // 监听图表的点击事件，用于处理编辑状态
    graph.on('blank:click', () => {
      // 当点击空白区域时，如果有正在编辑的节点或边，保存并退出编辑状态
      if (editingNodeId) {
        handleNodeEditComplete();
      }
      if (editingEdgeId) {
        handleEdgeEditComplete();
      }
    });
    
    // 监听键盘事件
    document.addEventListener('keydown', handleKeyDown);

  }, [graph, graphData, centralNodeId, quadrantConfig, depthConfig, viewConfig, editingNodeId, editingEdgeId, inputValue]);

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent) => {
    // 按下回车键确认编辑
    if (e.key === 'Enter') {
      if (editingNodeId) {
        handleNodeEditComplete();
      }
      if (editingEdgeId) {
        handleEdgeEditComplete();
      }
    }
    // 按下Escape键取消编辑
    else if (e.key === 'Escape') {
      if (editingNodeId) {
        setEditingNodeId(null);
        // 恢复原始样式
        const node = graph?.getCellById(editingNodeId);
        if (node) {
          node.setAttrs({
            label: {
              fill: '#fff',
              class: ''
            },
            body: {
              strokeWidth: 1,
            }
          });
        }
      }
      if (editingEdgeId) {
        setEditingEdgeId(null);
        // 恢复原始样式
        const edge = graph?.getCellById(editingEdgeId);
        if (edge) {
          edge.setAttrs({
            line: {
              strokeWidth: 2,
            }
          });
        }
      }
    }
  };

  // 处理节点编辑完成
  const handleNodeEditComplete = () => {
    if (editingNodeId && inputValue.trim() !== '' && onEditNode) {
      onEditNode(editingNodeId, inputValue.trim());
      setEditingNodeId(null);
    }
  };

  // 处理边编辑完成
  const handleEdgeEditComplete = () => {
    if (editingEdgeId && inputValue.trim() !== '' && onEditEdge) {
      // 获取当前边对象
      const edge = graph?.getCellById(editingEdgeId);
      if (edge) {
        // 根据当前显示模式调整保存的值
        let relationshipValue = inputValue.trim();
        const relationshipData = edge.getData();
        
        // 如果当前是简短模式，并且用户输入的是完整关系名称，则需要转换
        if (viewConfig.showRelationshipLabels === RelationshipLabelMode.SIMPLE) {
          // 尝试将用户输入映射到简短关系标签
          // 检查是否是一个完整的关系类型名称
          const relationshipType = Object.values(RelationshipType).find(
            type => type.toLowerCase() === relationshipValue.toLowerCase()
          );
          
          if (relationshipType) {
            // 使用简短标签
            relationshipValue = relationshipToSimpleLabel[relationshipType];
          }
        } 
        // 如果当前是完整模式，并且用户输入的是简短标签，则需要转换
        else if (viewConfig.showRelationshipLabels === RelationshipLabelMode.FULL) {
          // 检查是否是一个简短标签
          const entries = Object.entries(relationshipToSimpleLabel);
          for (const [fullType, shortLabel] of entries) {
            if (shortLabel.toLowerCase() === relationshipValue.toLowerCase()) {
              // 使用完整关系名称
              relationshipValue = fullType;
              break;
            }
          }
        }
        
        // 将处理后的值传递给回调
        onEditEdge(editingEdgeId, relationshipValue);
        setEditingEdgeId(null);
      }
    }
  };

  // 添加处理输入值变化的函数
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // 在渲染部分之前，添加关系自动补全列表的状态
  const [showAutoComplete, setShowAutoComplete] = useState(false);

  // 添加过滤关系标签的函数
  const getFilteredRelationships = () => {
    if (!inputValue) return existingRelationshipLabels;
    
    return existingRelationshipLabels.filter(label => 
      label.toLowerCase().includes(inputValue.toLowerCase())
    );
  };

  return (
    <div className="graph-view-container">
      {/* 添加节点编辑输入框 */}
      {editingNodeId && (
        <div className="node-editor" 
             style={{ 
               position: 'absolute', 
               zIndex: 1000,
               left: '50%',
               top: '50%',
               transform: 'translate(-50%, -50%)'
             }}>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            autoFocus
            className="node-editor-input"
            onBlur={handleNodeEditComplete}
          />
        </div>
      )}
      
      {/* 添加关系编辑输入框 */}
      {editingEdgeId && (
        <div className="edge-editor" 
             style={{ 
               position: 'absolute', 
               zIndex: 1000,
               left: '50%',
               top: '50%',
               transform: 'translate(-50%, -50%)'
             }}>
          <div className="autocomplete-container">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                handleInputChange(e);
                // 只有当不是简洁模式时才显示自动补全
                if (viewConfig.showRelationshipLabels !== RelationshipLabelMode.SIMPLE) {
                  setShowAutoComplete(true);
                }
              }}
              autoFocus
              className="edge-editor-input"
              onBlur={() => {
                // 延迟隐藏自动完成，以便用户可以点击选项
                setTimeout(() => {
                  setShowAutoComplete(false);
                }, 200);
              }}
            />
            
            {/* 关系自动补全下拉列表 - 只在非简洁模式下显示 */}
            {showAutoComplete && viewConfig.showRelationshipLabels !== RelationshipLabelMode.SIMPLE && (
              <div className="autocomplete-dropdown">
                {getFilteredRelationships().map((label, index) => (
                  <div 
                    key={index} 
                    className="autocomplete-item"
                    onClick={() => {
                      setInputValue(label);
                      setShowAutoComplete(false);
                      // 自动保存
                      setTimeout(handleEdgeEditComplete, 100);
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
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