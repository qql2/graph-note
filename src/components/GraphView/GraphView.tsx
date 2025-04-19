import React, { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/x6';
import { GraphData, QuadrantConfig, defaultQuadrantConfig, DepthConfig, defaultDepthConfig, ViewConfig, defaultViewConfig, RelationshipLabelMode, GraphEdge, CommonRelationshipTypes, QuadrantPosition } from '../../models/GraphNode';
import { GraphLayoutService } from '../../services/GraphLayoutService';
import ContextMenu from '../ContextMenu';
import NodeEditModal from '../NodeEditModal';
import EdgeEditModal from '../EdgeEditModal';
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
  onEditEdge?: (edgeId: string, label: string, isSimpleLabel?: boolean) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onCreateRelation?: (sourceNodeId: string, relationType: string, targetNodeId?: string, nodeLabel?: string) => void;
  newNodeId?: string;
}

// 关系类型到简短标签的映射
const relationshipToSimpleLabel: Record<string, string> = {
  [CommonRelationshipTypes.FATHER]: 'F',
  [CommonRelationshipTypes.CHILD]: 'C',
  [CommonRelationshipTypes.BASE]: 'Ba',
  [CommonRelationshipTypes.BUILD]: 'Bu',
  [CommonRelationshipTypes.MENTION]: 'M',
  [CommonRelationshipTypes.MENTIONED_BY]: 'MB',
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
        textWrap: {
          width: -10, // 内边距，使文本不会贴边
          height: -10, // 内边距，使文本不会贴边
          ellipsis: true, // 超出宽度时显示省略号
          breakWord: true, // 允许在单词内换行
          maxLines: 3, // 最大显示3行文本
        },
        textVerticalAnchor: 'middle',
        textAnchor: 'middle',
        refX: 0.5,
        refY: 0.5,
      },
    },
    // 自定义锚点位置，定义在节点的上、下、左、右四个位置
    ports: {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 0,  // 设置半径为0，使连接点不可见
              magnet: false,  // 禁用磁性功能，防止手动连线
              stroke: '#31d0c6',
              fill: '#fff',
              strokeWidth: 0,
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 0,  // 设置半径为0，使连接点不可见
              magnet: false,  // 禁用磁性功能，防止手动连线
              stroke: '#31d0c6',
              fill: '#fff',
              strokeWidth: 0,
            },
          },
        },
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 0,  // 设置半径为0，使连接点不可见
              magnet: false,  // 禁用磁性功能，防止手动连线
              stroke: '#31d0c6',
              fill: '#fff',
              strokeWidth: 0,
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 0,  // 设置半径为0，使连接点不可见
              magnet: false,  // 禁用磁性功能，防止手动连线
              stroke: '#31d0c6',
              fill: '#fff',
              strokeWidth: 0,
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
        radius: 10, // 增加弯曲的半径
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
  onCreateRelation,
  newNodeId = ''  // 默认为空字符串
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

  // 节点编辑模态框状态
  const [nodeEditModal, setNodeEditModal] = useState({
    isOpen: false,
    nodeId: '',
    nodeLabel: '',
    isNewNode: false,
    relationType: '',
    sourceNodeId: ''
  });

  // 边编辑模态框状态
  const [edgeEditModal, setEdgeEditModal] = useState({
    isOpen: false,
    edgeId: '',
    relationshipType: '',
    edge: {} as GraphEdge,
    isNewRelation: false,
    sourceNodeId: ''
  });

  // 缓存当前存在的所有关系类型
  const [existingRelationshipTypes, setExistingRelationshipTypes] = useState<string[]>([]);

  // 触摸拖动相关状态 - 使用 useRef 替代 useState
  const isBlankTouchRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastTouchXRef = useRef(0);
  const lastTouchYRef = useRef(0);
  const initialPinchDistanceRef = useRef(0);
  const initialScaleRef = useRef(1);

  // 添加state跟踪新节点
  const [newlyCreatedNodeIds, setNewlyCreatedNodeIds] = useState<string[]>([]);

  // 在组件加载时收集所有现有的关系类型
  useEffect(() => {
    if (graphData && graphData.edges) {
      const relationshipTypes = new Set<string>();
      graphData.edges.forEach(edge => {
        relationshipTypes.add(edge.relationshipType);
      });
      setExistingRelationshipTypes(Array.from(relationshipTypes));
    }
  }, [graphData]);

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
          // 打开节点编辑模态框
          setNodeEditModal({
            isOpen: true,
            nodeId: nodeId,
            nodeLabel: node.attrs.label.text,
            isNewNode: false,
            relationType: '',
            sourceNodeId: ''
          });
        }
      });
    }
    
    // 创建关系菜单项
    if (onCreateRelation) {
      if (isCenter) {
        // 中心节点可以创建所有关系类型的节点
        for (const commonRelationshipType of Object.values(CommonRelationshipTypes)) {
          menuItems.push({
            id: `create-${commonRelationshipType}`,
            label: `添加${commonRelationshipType}节点`,
            icon: add,
            onClick: () => {
              setNodeEditModal({
                isOpen: true,
                nodeId: '',
                nodeLabel: `新${commonRelationshipType}节点`,
                isNewNode: true,
                relationType: commonRelationshipType,
                sourceNodeId: nodeId
              });
            }
          });
        }
        
        // 添加自定义关系
        menuItems.push({
          id: 'create-custom',
          label: '添加自定义关系',
          icon: add,
          onClick: () => {
            setEdgeEditModal({
              isOpen: true,
              edgeId: '',
              relationshipType: '',
              edge: {} as GraphEdge,
              isNewRelation: true,
              sourceNodeId: nodeId
            });
          }
        });
      } else {
        // 非中心节点，根据节点所在象限来限制可创建的关系类型
        // 获取节点相对于中心节点的象限位置
        const nodeQuadrant = getNodeQuadrant(nodeId);
        
        if (nodeQuadrant) {
          // 获取该象限允许的关系类型
          const allowedRelationshipTypes = quadrantConfig[nodeQuadrant];
          
          // 只添加该象限允许的关系类型
          for (const relationType of allowedRelationshipTypes) {
            menuItems.push({
              id: `create-${relationType}`,
              label: `添加${relationType}节点`,
              icon: add,
              onClick: () => {
                setNodeEditModal({
                  isOpen: true,
                  nodeId: '',
                  nodeLabel: `新${relationType}节点`,
                  isNewNode: true,
                  relationType: relationType,
                  sourceNodeId: nodeId
                });
              }
            });
          }
        }
      }
    }
    
    // 删除节点菜单项
    if (onDeleteNode) {
      menuItems.push({
        id: 'delete-node',
        label: '删除节点',
        icon: trash,
        onClick: () => {
          onDeleteNode(nodeId);
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

  // 获取节点相对于中心节点的象限位置
  const getNodeQuadrant = (nodeId: string): QuadrantPosition | null => {
    if (!graph) return null;
    
    const nodeCell = graph.getCellById(nodeId);
    const centralNodeCell = graph.getCellById(centralNodeId);
    
    if (!nodeCell || !centralNodeCell) return null;
    
    const nodeBBox = nodeCell.getBBox();
    const centralBBox = centralNodeCell.getBBox();
    
    // 获取节点和中心节点的中心点
    const nodeCenter = {
      x: nodeBBox.x + nodeBBox.width / 2,
      y: nodeBBox.y + nodeBBox.height / 2
    };
    
    const centralCenter = {
      x: centralBBox.x + centralBBox.width / 2,
      y: centralBBox.y + centralBBox.height / 2
    };
    
    // 判断节点相对于中心节点在哪个象限
    if (nodeCenter.y < centralCenter.y) {
      // 在中心节点上方
      return QuadrantPosition.TOP;
    } else if (nodeCenter.y > centralCenter.y) {
      // 在中心节点下方
      return QuadrantPosition.BOTTOM;
    } else if (nodeCenter.x < centralCenter.x) {
      // 在中心节点左侧
      return QuadrantPosition.LEFT;
    } else {
      // 在中心节点右侧
      return QuadrantPosition.RIGHT;
    }
  };
  
  // 处理边右键菜单
  const handleEdgeContextMenu = (edge: any, event: any) => {
    event.preventDefault();
    
    const edgeId = edge.id;
    const menuItems: MenuItem[] = [];
    
    const edgeData = graphData.edges.find(e => e.id === edgeId) as GraphEdge;

    // 编辑边菜单项
    if (onEditEdge) {
      menuItems.push({
        id: 'edit-edge',
        label: '编辑关系',
        icon: pencil,
        onClick: () => {
          // 获取当前显示的标签
          const currentLabel = edge.data.relationshipType || '';
          // 打开边编辑模态框
          setEdgeEditModal({
            isOpen: true,
            edgeId: edgeId,
            relationshipType: currentLabel,
            edge: edgeData,
            isNewRelation: false,
            sourceNodeId: edgeData.source
          });
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
          onDeleteEdge(edgeId);
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

  // 初始化触摸事件处理
  useEffect(() => {
    if (!graph || !containerRef.current) return;

    // 计算两点之间的距离
    const getDistance = (p1: Touch, p2: Touch) => {
      const dx = p1.clientX - p2.clientX;
      const dy = p1.clientY - p2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // 计算两点的中心点
    const getMidPoint = (p1: Touch, p2: Touch) => {
      return {
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2,
      };
    };

    // 监听空白区域的触摸开始 (映射为鼠标事件)
    graph.on('blank:mousedown', (e) => {
      
      // 设置为空白区域触摸
      isBlankTouchRef.current = true;
      
      // 检查是否是触摸事件
      const event = e.e as unknown;
      if (event && typeof event === 'object' && (event as any).touches) {
        const touchEvent = event as TouchEvent;
        if (touchEvent.touches.length === 1) {
          // 记录初始触摸位置
          lastTouchXRef.current = touchEvent.touches[0].clientX;
          lastTouchYRef.current = touchEvent.touches[0].clientY;
          isDraggingRef.current = true;
          
          
          
          // 阻止默认行为，但仅当事件可取消时
          if (touchEvent.cancelable) {
            touchEvent.preventDefault();
          }
        }
      }
    });

    // 监听节点的触摸开始，确保不会拖动画布
    graph.on('node:mousedown', () => {
      // 在节点上触摸时，标记为非空白区域
      isBlankTouchRef.current = false;
    });
    
    // 监听边的触摸开始，确保不会拖动画布
    graph.on('edge:mousedown', () => {
      // 在边上触摸时，标记为非空白区域
      isBlankTouchRef.current = false;
    });

    // 监听触摸结束 (映射为鼠标事件)
    graph.on('blank:mouseup', () => {
      
      isBlankTouchRef.current = false;
      isDraggingRef.current = false;
    });

    // 处理触摸开始事件
    const handleTouchStart = (e: TouchEvent) => {
      
      // 如果不是空白区域触摸，不处理拖动
      if (!isBlankTouchRef.current && e.touches.length === 1) {
        return;
      }
        
      if (e.touches.length === 2) {
        // 双指触摸开始，初始化缩放参数
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        // 记录初始距离
        const initialDistance = getDistance(touch1, touch2);
        initialPinchDistanceRef.current = initialDistance;
        
        // 记录当前缩放比例
        initialScaleRef.current = graph.zoom();
        
        // 只有当事件可以被取消时才调用 preventDefault
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    // 处理触摸移动事件
    const handleTouchMove = (e: TouchEvent) => {
      
      // 多指触摸处理缩放
      if (e.touches.length === 2) {
        // 缩放处理
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        // 计算当前两指距离
        const distance = getDistance(touch1, touch2);
        
        // 如果初始距离未设置，先设置初始距离
        if (initialPinchDistanceRef.current === 0) {
          initialPinchDistanceRef.current = distance;
          initialScaleRef.current = graph.zoom();
          return;
        }
        
        // 计算缩放比例
        const scale = (distance / initialPinchDistanceRef.current) * initialScaleRef.current;
        
        // 限制缩放范围
        const minScale = 0.5;
        const maxScale = 2;
        const limitedScale = Math.min(Math.max(scale, minScale), maxScale);
        
        // 获取缩放中心点
        const center = getMidPoint(touch1, touch2);
        
        // 应用缩放
        graph.zoom(limitedScale, {
          absolute: true,
          center: {
            x: center.x,
            y: center.y,
          },
        });
        
        // 只有当事件可以被取消时才调用 preventDefault
        if (e.cancelable) {
          e.preventDefault();
        }
        return;
      }
      
      // 单指处理拖动
      if (isDraggingRef.current && isBlankTouchRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastTouchXRef.current;
        const deltaY = touch.clientY - lastTouchYRef.current;
        
        const currentScale = graph.scale();
        
        requestAnimationFrame(() => {
          
          graph.translateBy(deltaX / currentScale.sx, deltaY / currentScale.sy);
        });
        
        lastTouchXRef.current = touch.clientX;
        lastTouchYRef.current = touch.clientY;
        
        // 只有当事件可以被取消时才调用 preventDefault
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    // 处理触摸结束事件
    const handleTouchEnd = () => {
      
      isDraggingRef.current = false;
      // 重置双指缩放状态
      initialPinchDistanceRef.current = 0;
    };

    // 添加触摸事件监听器
    const container = containerRef.current;
    
    // 使用 capture 选项确保在事件捕获阶段处理触摸，可以更早地调用 preventDefault
    const touchOptions = { passive: false, capture: true };
    
    container.addEventListener('touchmove', handleTouchMove, touchOptions);
    container.addEventListener('touchstart', handleTouchStart, touchOptions);
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    // 清理事件监听器
    return () => {
      if (container) {
        
        container.removeEventListener('touchmove', handleTouchMove, touchOptions);
        container.removeEventListener('touchstart', handleTouchStart, touchOptions);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
      }
      
      // 清理X6事件监听
      if (graph) {
        graph.off('blank:mousedown');
        graph.off('blank:mouseup');
        graph.off('node:mousedown');
        graph.off('edge:mousedown');
      }
      
      // 重置所有触摸相关状态
      isDraggingRef.current = false;
      isBlankTouchRef.current = false;
      initialPinchDistanceRef.current = 0;
    };
  }, [graph]);

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
      // 禁用连线功能
      connecting: {
        validateConnection: () => false, // 禁止任何连接验证通过
        validateMagnet: () => false, // 禁止磁铁可连接
        allowBlank: false, // 禁止连接到空白位置
        allowLoop: false, // 禁止自环
        allowNode: false, // 禁止直接连接到节点
        allowEdge: false, // 禁止连接到边
        createEdge: () => null, // 阻止创建新的边
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

  // 当有新节点ID传入时，更新状态
  useEffect(() => {
    if (newNodeId && !newlyCreatedNodeIds.includes(newNodeId)) {
      setNewlyCreatedNodeIds(prev => [...prev, newNodeId]);
      
      // 设置定时器，一段时间后移除新节点状态
      const timer = setTimeout(() => {
        setNewlyCreatedNodeIds(prev => prev.filter(id => id !== newNodeId));
        
        // 如果图存在，找到对应节点并移除新节点效果
        if (graph) {
          const node = graph.getCellById(newNodeId);
          if (node && node.isNode()) {
            // 直接设置class属性为空
            node.attr('body/class', '');
          }
        }
      }, 4500); // 动画持续3次，每次1.5秒，总共4.5秒
      
      return () => clearTimeout(timer);
    }
  }, [newNodeId, newlyCreatedNodeIds, graph]);

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

    // Calculate positions for each node with collision detection
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

      // 计算合适的字体大小，根据节点宽度和文本长度动态调整
      const baseFontSize = 14;
      const fontSize = isCentralNode ? baseFontSize + 2 : baseFontSize;
      
      // 文本自动裁剪配置
      const textWrap = {
        width: width - 16, // 留出边距
        height: height - 12,
        ellipsis: true,
        breakWord: true, // 允许在单词内换行，确保长文本能正确换行
        maxLines: height > 50 ? 3 : 2, // 根据节点高度确定最大行数
      };

      // 创建节点
      const node = graph.addNode({
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
            fontSize: fontSize,
            textWrap: textWrap,
          },
        },
        data: {
          isCentralNode,
          quadrant,
          depth,
        },
      });
      
      // 检查此节点是否是新节点，如果是，添加特殊类名来触发动画
      if (newlyCreatedNodeIds.includes(id)) {
        // 使用 attr 方法添加类
        node.attr('body/class', 'new-node');
        
        // 可以选择性地添加额外的边框效果
        const bbox = node.getBBox();
        const padding = 4; // 边框与节点的距离
        
        // 添加一个动画边框作为特效
        graph.addNode({
          shape: 'rect',
          x: bbox.x - padding,
          y: bbox.y - padding,
          width: bbox.width + padding * 2,
          height: bbox.height + padding * 2,
          attrs: {
            body: {
              fill: 'none',
              class: 'new-node-effect'
            }
          },
          zIndex: -1, // 确保在节点下方
          interacting: false, // 禁用交互
        });
      }
      
      return node;
    });

    // 获取关系类型的显示标签
    const getRelationshipLabel = (edge: GraphEdge) => {
      if (viewConfig.showRelationshipLabels === RelationshipLabelMode.NONE) {
        return null;
      } 
      
      // 如果是简洁模式
      if (viewConfig.showRelationshipLabels === RelationshipLabelMode.SIMPLE) {
        // 如果边的属性中有 shortLabel，优先使用
        if (edge.metadata && 'shortLabel' in edge.metadata) {
          return edge.metadata.shortLabel;
        }
        
        // 使用关系类型的简短标签，如果没有预定义则使用首字母
        return relationshipToSimpleLabel[edge.relationshipType] || 
               edge.relationshipType.substring(0, 
                 edge.relationshipType.charAt(0).toLowerCase() === 'b' ? 2 : 1).toUpperCase();
      } 
      
      // 完整模式直接显示关系类型
      return edge.relationshipType;
    };

    // Create edges between nodes
    graphData.edges.forEach((edgeData) => {
      // Check if both source and target nodes exist in our layout
      const sourceExists = nodes.some(node => node.id === edgeData.source);
      const targetExists = nodes.some(node => node.id === edgeData.target);
      
      if (sourceExists && targetExists) {
        // 确定边的颜色
        let edgeColor;
        
        // 确定关系类型所属的关系组
        const relationType = GraphLayoutService.getOppositeRelationType(edgeData.relationshipType, quadrantConfig);
        
        // 检查关系类型属于哪个关系组
        const isTopType = quadrantConfig[QuadrantPosition.TOP].includes(relationType);
        const isBottomType = quadrantConfig[QuadrantPosition.BOTTOM].includes(relationType);
        const isLeftType = quadrantConfig[QuadrantPosition.LEFT].includes(relationType);
        const isRightType = quadrantConfig[QuadrantPosition.RIGHT].includes(relationType);
        
        // 如果关系类型已被明确配置到某个关系组，使用对应的颜色
        if (isTopType) {
          edgeColor = 'var(--ion-color-success, #4CAF50)'; // 绿色 - 上方
        } else if (isBottomType) {
          edgeColor = 'var(--ion-color-primary, #2196F3)'; // 蓝色 - 下方
        } else if (isLeftType) {
          edgeColor = 'var(--ion-color-tertiary, #9C27B0)'; // 紫色 - 左侧
        } else if (isRightType) {
          edgeColor = 'var(--ion-color-danger, #F44336)'; // 红色 - 右侧
        } else {
          // 未配置到任何关系组的关系类型，使用默认颜色
          edgeColor = 'var(--ion-color-medium, #607D8B)';
        }
        
        // 确定是否是从中心节点直接连出的边
        const isDirectFromCentral = edgeData.source === centralNodeId;
        
        // 确定连接点，使用 GraphLayoutService 的方法
        const { source: sourcePort, target: targetPort } = GraphLayoutService.determineConnectionPoints(
          edgeData.source, 
          edgeData.target,
          edgeData.relationshipType,
          centralNodeId,
          nodeQuadrantMap,
          nodeDepthMap,
          quadrantConfig,
          isDirectFromCentral
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
            originalType: edgeData.metadata?.originalType,
            isInbound: edgeData.target === centralNodeId && edgeData.source !== centralNodeId
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

  }, [graph, graphData, centralNodeId, quadrantConfig, depthConfig, viewConfig, newlyCreatedNodeIds]);

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

      {/* 节点编辑模态框 */}
      <NodeEditModal
        isOpen={nodeEditModal.isOpen}
        onClose={() => setNodeEditModal(prev => ({ ...prev, isOpen: false }))}
        nodeId={nodeEditModal.nodeId}
        nodeLabel={nodeEditModal.nodeLabel}
        existingNodes={graphData.nodes}
        existingEdges={graphData.edges}
        isNewNode={nodeEditModal.isNewNode}
        relationType={nodeEditModal.relationType}
        sourceNodeId={nodeEditModal.sourceNodeId}
        onSave={(nodeId, newLabel, targetNodeId) => {
          if (onEditNode && !targetNodeId && !nodeEditModal.isNewNode) {
            // 常规节点编辑，没有选择目标节点且不是新建节点
            onEditNode(nodeId, newLabel);
          } else if (targetNodeId) {
            // 处理节点合并或连接到现有节点
            if (nodeEditModal.isNewNode && onCreateRelation) {
              // 新建节点时，直接连接到目标节点
              onCreateRelation(nodeEditModal.sourceNodeId, nodeEditModal.relationType, targetNodeId);
            } else if (!nodeEditModal.isNewNode && onEditNode) {
              // 编辑节点时需要进行节点合并
              onEditNode(nodeId, `MERGE:${targetNodeId}`);
            }
          } else if (nodeEditModal.isNewNode && onCreateRelation) {
            // 新建节点但没有选择现有节点，传递用户输入的标签
            onCreateRelation(nodeEditModal.sourceNodeId, nodeEditModal.relationType, undefined, newLabel);
          }
        }}
      />

      {/* 边编辑模态框 */}
      <EdgeEditModal
        isOpen={edgeEditModal.isOpen}
        onClose={() => setEdgeEditModal(prev => ({ ...prev, isOpen: false }))}
        edgeId={edgeEditModal.edgeId}
        relationshipType={edgeEditModal.relationshipType}
        existingEdges={graphData.edges}
        labelMode={viewConfig.showRelationshipLabels}
        isNewRelation={edgeEditModal.isNewRelation}
        onSave={(edgeId, newRelationshipType, isSimpleLabel) => {
          if (edgeEditModal.isNewRelation) {
            // 创建新关系
            if (onCreateRelation) {
              // 使用关系类型作为节点标签，保持现有行为
              onCreateRelation(edgeEditModal.sourceNodeId, newRelationshipType, undefined, `新${newRelationshipType}节点`);
            }
          } else {
            // 编辑已有关系
            if (onEditEdge) {
              // 根据标签类型传递不同的参数，让父组件处理保存逻辑
              onEditEdge(edgeId, newRelationshipType, isSimpleLabel);
            }
          }
          // 关闭模态框
          setEdgeEditModal(prev => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
};

export default GraphView; 