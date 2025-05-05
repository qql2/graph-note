import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Graph } from '@antv/x6';
import { register } from '@antv/x6-react-shape';
import { GraphData, QuadrantConfig, defaultQuadrantConfig, DepthConfig, defaultDepthConfig, ViewConfig, defaultViewConfig, RelationshipLabelMode, GraphEdge, CommonRelationshipTypes, QuadrantPosition } from '../../models/GraphNode';
import { GraphLayoutService } from '../../services/GraphLayoutService';
import ContextMenu from '../ContextMenu';
import NodeEditModal from '../NodeEditModal';
import EdgeEditModal from '../EdgeEditModal';
import { pencil, trash, copy, add } from 'ionicons/icons';
import GraphNodeComponent from '../GraphNodeComponent';
import '../GraphNodeComponent.css';
import './GraphView.css';
import { getIndependentParentNode } from '../../mixin/graphView';

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

type layoutData = {id: string, x: number, y: number, width: number, height: number, label: string, isCentralNode: boolean, quadrant: QuadrantPosition, depth: number, is_independent?: boolean}[]

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

// 注册React节点
register({
  shape: 'react-graph-node',
  width: 100,
  height: 60,
  component: GraphNodeComponent,
  effect: ['data'],
});

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

const GraphView: React.FC<GraphViewProps> = memo(({
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
  const [graphState, setGraphState] = useState<Graph | null>(null);
  const isPress = useRef(false);
  const layoutDataRef = useRef<layoutData>([]);
  // 右键菜单状态
  const [contextMenuState,setContextMenuState] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    items: [],
    targetId: '',
    type: ''
  });

  // 节点编辑模态框状态
  const nodeEditModal = useRef({
    isOpen: false,
    nodeId: '',
    nodeLabel: '',
    isNewNode: false,
    relationType: '',
    sourceNodeId: ''
  });

  // 边编辑模态框状态
  const edgeEditModal = useRef({
    isOpen: false,
    edgeId: '',
    relationshipType: '',
    edge: {} as GraphEdge,
    isNewRelation: false,
    sourceNodeId: ''
  });

  // 缓存当前存在的所有关系类型
  const existingRelationshipTypes = useRef<string[]>([]);

  // 触摸拖动相关状态 - 使用 useRef 替代 useState
  const isBlankTouchRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastTouchXRef = useRef(0);
  const lastTouchYRef = useRef(0);
  const initialPinchDistanceRef = useRef(0);
  const initialScaleRef = useRef(1);

  // 添加state跟踪新节点
  const newlyCreatedNodeIds = useRef<string[]>([]);

  // 添加长按相关状态
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nodeUnderLongPressRef = useRef<{ cell: any, clientX: number, clientY: number } | null>(null);
  const edgeUnderLongPressRef = useRef<{ cell: any, clientX: number, clientY: number } | null>(null);
  
  // 添加用于跟踪当前高亮路径的状态
  const highlightedPathRef = useRef<{nodes: string[], edges: string[]} | null>(null);
  
  // 添加当前视图节点和边的缓存
  const currentViewNodesRef = useRef<Set<string>>(new Set());
  const currentViewEdgesRef = useRef<Map<string, GraphEdge>>(new Map());
  const currentViewEdgesByNodeRef = useRef<Map<string, {edgeId: string, connectedNodeId: string}[]>>(new Map());
  
  // 清除长按计时器的辅助函数
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    nodeUnderLongPressRef.current = null;
    edgeUnderLongPressRef.current = null;
  };

  // 在组件加载时收集所有现有的关系类型
  useEffect(() => {
    if (graphData && graphData.edges) {
      const relationshipTypes = new Set<string>();
      graphData.edges.forEach(edge => {
        relationshipTypes.add(edge.relationshipType);
      });
      existingRelationshipTypes.current = Array.from(relationshipTypes);
    }
  }, [graphData]);

  // 处理缩放和重置视图的函数
  const handleZoomIn = () => {
    if (graphState) {
      const zoom = graphState.zoom();
      if (zoom < 2) {
        graphState.zoom(0.1);
      }
    }
  };

  const handleZoomOut = () => {
    if (graphState) {
      const zoom = graphState.zoom();
      console.log('zoom', zoom);
      if (zoom > 0.5) {
        graphState.zoom(-0.1);
      }
    }
  };

  const handleResetView = () => {
    if (graphState) {
      graphState.zoomTo(1);
      graphState.centerContent();
    }
  };

  // 关闭上下文菜单
  const closeContextMenu = () => {
    setContextMenuState({
      ...contextMenuState,
      isOpen: false
    });
  };

  // 修改handleNodeContextMenu来支持长按触发
  const handleNodeContextMenu = (node: any, event: any) => {
    // 如果有preventDefault方法就调用（阻止默认上下文菜单）
    (event.preventDefault)?.();
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
          nodeEditModal.current = {
            isOpen: true,
            nodeId: nodeId,
            nodeLabel: node.data.label,
            isNewNode: false,
            relationType: '',
            sourceNodeId: ''
          };
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
              nodeEditModal.current = {
                isOpen: true,
                nodeId: '',
                nodeLabel: `新${commonRelationshipType}节点`,
                isNewNode: true,
                relationType: commonRelationshipType,
                sourceNodeId: nodeId
              };
            }
          });
        }
        
        // 添加自定义关系
        menuItems.push({
          id: 'create-custom',
          label: '添加自定义关系',
          icon: add,
          onClick: () => {
            edgeEditModal.current = {
              isOpen: true,
              edgeId: '',
              relationshipType: '',
              edge: {} as GraphEdge,
              isNewRelation: true,
              sourceNodeId: nodeId
            };
          }
        });
      } else {
        // 非中心节点，根据节点所在象限来限制可创建的关系类型
        // 获取节点相对于中心节点的象限位置
        const nodeQuadrant = getNodeQuadrant(node);
        
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
                nodeEditModal.current = {
                  isOpen: true,
                  nodeId: '',
                  nodeLabel: `新${relationType}节点`,
                  isNewNode: true,
                  relationType: relationType,
                  sourceNodeId: nodeId
                };
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
    
    // 获取菜单位置
    let menuX = event.clientX;
    let menuY = event.clientY;
    
    setContextMenuState({
      isOpen: true,
      position: { x: menuX, y: menuY },
      items: menuItems,
      targetId: nodeId,
      type: 'node'
    });
  };

  // 获取节点相对于中心节点的象限位置
  const getNodeQuadrant = (node: any): QuadrantPosition | null => {
    return node.data.quadrant;
  };
  
  // 处理边右键菜单
  const handleEdgeContextMenu = (edge: any, event: any) => {
    (event.preventDefault)?.();
    
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
          edgeEditModal.current = {
            isOpen: true,
            edgeId: edgeId,
            relationshipType: currentLabel,
            edge: edgeData,
            isNewRelation: false,
            sourceNodeId: edgeData.source
          };
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
    
    // 计算菜单位置
    let menuX = event.clientX;
    let menuY = event.clientY;
    
    // 如果是通过按钮触发的事件（没有客户端坐标），则获取按钮的位置
    if (!menuX && !menuY && event.target) {
      const buttonElement = event.target.closest('.x6-edge-tool');
      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        menuX = rect.left + rect.width / 2;
        menuY = rect.top + rect.height / 2;
      }
    }
    
    setContextMenuState({
      isOpen: true,
      position: { x: menuX, y: menuY },
      items: menuItems,
      targetId: edgeId,
      type: 'edge'
    });
  };

  // 在组件初始化Graph之后添加状态
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  
  // 初始化触摸事件处理
  useEffect(() => {
    if (!graphState || !containerRef.current) return;

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
    graphState.on('blank:mousedown', (e) => {
      
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
    graphState.on('node:mousedown', () => {
      // 在节点上触摸时，标记为非空白区域
      isBlankTouchRef.current = false;
    });
    
    // 监听边的触摸开始，确保不会拖动画布
    graphState.on('edge:mousedown', () => {
      // 在边上触摸时，标记为非空白区域
      isBlankTouchRef.current = false;
    });

    // 监听触摸结束 (映射为鼠标事件)
    graphState.on('blank:mouseup', () => {
      
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
        initialScaleRef.current = graphState.zoom();
        
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
          initialScaleRef.current = graphState.zoom();
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
        graphState.zoom(limitedScale, {
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
        
        const currentScale = graphState.scale();
        
        requestAnimationFrame(() => {
          
          graphState.translateBy(deltaX / currentScale.sx, deltaY / currentScale.sy);
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
      if (graphState) {
        graphState.off('blank:mousedown');
        graphState.off('blank:mouseup');
        graphState.off('node:mousedown');
        graphState.off('edge:mousedown');
      }
      
      // 重置所有触摸相关状态
      isDraggingRef.current = false;
      isBlankTouchRef.current = false;
      initialPinchDistanceRef.current = 0;
    };
  }, [graphState]);

  useEffect(() => {
    console.log('containerRef changed');
  }, [containerRef]);

  useEffect(() => {
    console.log('graphData changed');
  }, [graphData]);

  useEffect(() => {
    console.log('centralNodeId changed');
  }, [centralNodeId]);

  useEffect(() => {
    console.log('quadrantConfig changed');
  }, [quadrantConfig]);

  useEffect(() => {
    console.log('depthConfig changed');
  }, [depthConfig]);

  useEffect(() => {
    console.log('graph changed');
  },[graphState]);

  // Initialize the graph when the component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    console.log('some listener changed');

    // Clear any existing graph
    if (graphState) {
      graphState.dispose();
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
      // 如果是长按触发的点击，不执行通常的点击操作
      if (isPress.current) {
        isPress.current = false;
        return;
      }
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
    console.log('change graph')
    setGraphState(newGraph);

    console.log('graph:',graphState?.getCells())
    // Cleanup on unmount
    return () => {
      console.log('dispose graph')
      // 使用setTimeout来确保在React渲染完成后再执行清理
      newGraph.dispose();
    };
  }, [ centralNodeId]);

  // 当有新节点ID传入时，更新状态
  useEffect(() => {
    if (newNodeId && !newlyCreatedNodeIds.current.includes(newNodeId)) {
      newlyCreatedNodeIds.current.push(newNodeId);
      
      // 设置定时器，一段时间后移除新节点状态
      const timer = setTimeout(() => {
        console.log('new create node timer');
        newlyCreatedNodeIds.current = newlyCreatedNodeIds.current.filter(id => id !== newNodeId);
        
        // 如果图存在，找到对应节点并更新数据
        if (graphState) {
          const node = graphState.getCellById(newNodeId);
          if (node && node.isNode()) {
            // 对于React节点，需要更新data
            const currentData = node.getData() || {};
            node.setData({
              ...currentData,
              isNewNode: false
            });
          }
        }
      }, 4500); // 动画持续3次，每次1.5秒，总共4.5秒
      
      return () => clearTimeout(timer);
    }
  }, [newNodeId, newlyCreatedNodeIds, graphState]);

  // 在渲染图时缓存当前视图的节点和边
  useEffect(() => {
    if (!graphState || !graphData || !centralNodeId || !containerRef.current) return;

    // Clear the graph
    graphState.clearCells();

    // 重置视图缓存
    currentViewNodesRef.current.clear();
    currentViewEdgesRef.current.clear();
    currentViewEdgesByNodeRef.current.clear();

    // Organize and layout the graph data
    const organizedData = GraphLayoutService.organizeByQuadrants(
      graphData, 
      centralNodeId, 
      quadrantConfig,
      depthConfig  // 传递深度配置
    );

    // Calculate positions for each node with collision detection
    let layoutData
    layoutDataRef.current = layoutData = GraphLayoutService.calculateQuadrantLayout(
      organizedData,
      containerRef.current.offsetWidth,
      containerRef.current.offsetHeight
    ) as layoutData;

    // 节点和其quadrant的映射，用于决定连接点
    const nodeQuadrantMap = new Map();
    const nodeDepthMap = new Map();

    // Add nodes to the graph using React components
    const nodes = layoutData.map((nodeData) => {
      const { id, x, y, width, height, label, isCentralNode, quadrant, depth } = nodeData;
      
      // 存储节点的象限和深度信息，用于后续确定边的连接点
      nodeQuadrantMap.set(id, quadrant || 'center');
      nodeDepthMap.set(id, depth || 0);
      
      // 将当前视图中的节点ID添加到缓存
      currentViewNodesRef.current.add(id);
      
      // 检查是否是新创建的节点
      const isNewNode = newlyCreatedNodeIds.current.includes(id);

      // 找到原始节点以获取独立性信息
      const originalNode = graphData.nodes.find(node => node.id === id);
      const is_independent = originalNode?.is_independent;
      if (label === '适用范围') {
        debugger
      }

      // 构建节点显示标签，对于非独立节点添加父独立节点前缀
      let displayLabel = label || id;
      if (is_independent === false) {
        // TODO: (AI不要擅自实现) 如果已经在视图中出现了父独立节点, 则不需要再加前缀了
        const parentNode = getIndependentParentNode(id,graphData,quadrantConfig.relationshipTypeConfig);
        if (parentNode && parentNode.label) {
          displayLabel = `${parentNode.label}/${displayLabel}`;
        }
      }
      
      // 创建React节点
      const node = graphState.addNode({
        id,
        x,
        y,
        width,
        height,
        shape: 'react-graph-node',
        data: {
          id,
          label: label,
          displayLabel,
          isCentralNode,
          quadrant,
          depth,
          isNewNode,
          is_independent
        },
        // 保留自定义锚点
        ports: {
          groups: {
            top: {
              position: 'top',
              attrs: {
                circle: {
                  r: 0,
                  magnet: false,
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
                  r: 0,
                  magnet: false,
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
                  r: 0,
                  magnet: false,
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
                  r: 0,
                  magnet: false,
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
      });
      
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
        // 缓存当前视图中的边
        currentViewEdgesRef.current.set(edgeData.id, edgeData);
        
        // 构建当前视图中的边的查找映射
        // 缓存源节点到边的映射
        if (!currentViewEdgesByNodeRef.current.has(edgeData.source)) {
          currentViewEdgesByNodeRef.current.set(edgeData.source, []);
        }
        currentViewEdgesByNodeRef.current.get(edgeData.source)?.push({
          edgeId: edgeData.id, 
          connectedNodeId: edgeData.target
        });
        
        // 缓存目标节点到边的映射
        if (!currentViewEdgesByNodeRef.current.has(edgeData.target)) {
          currentViewEdgesByNodeRef.current.set(edgeData.target, []);
        }
        currentViewEdgesByNodeRef.current.get(edgeData.target)?.push({
          edgeId: edgeData.id, 
          connectedNodeId: edgeData.source
        });

        // 确定边的颜色
        let edgeColor;
        
        // 确定关系类型所属的关系组
        const relationType = GraphLayoutService.getOppositeRelationType(edgeData.relationshipType, quadrantConfig.relationshipTypeConfig);
        
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
              cursor: 'pointer', // 添加指针样式，表示可点击
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
        graphState.addEdge(edgeOptions);
      }
    });

    // Center the view
    // graph.centerContent();

  }, [graphState, graphData, centralNodeId, quadrantConfig, depthConfig, viewConfig, newlyCreatedNodeIds]);

  // 查找从节点到中心节点的路径 - 优化版本使用当前视图数据
  const findPathToCentralNode = useCallback((nodeId: string, centralId: string): {nodes: string[], edges: string[]} => {
    const visited = new Set<string>();
    const nodeQueue: string[] = [nodeId];
    const edgesInPath = new Set<string>();
    const nodesInPath = new Set<string>([nodeId]);
    const parentMap = new Map<string, {nodeId: string, edgeId: string}>();
    
    // 使用当前视图的边查找映射而不是全库的图
    const edgesByNode = currentViewEdgesByNodeRef.current;
    
    // BFS查找路径
    while (nodeQueue.length > 0) {
      const currentNode = nodeQueue.shift();
      if (!currentNode || visited.has(currentNode)) continue;
      
      visited.add(currentNode);
      
      // 如果找到中心节点，构建路径并返回
      if (currentNode === centralId) {
        const pathNodes = [currentNode];
        const pathEdges: string[] = [];
        
        let current = currentNode;
        while (parentMap.has(current)) {
          const parent = parentMap.get(current);
          if (parent) {
            pathNodes.push(parent.nodeId);
            pathEdges.push(parent.edgeId);
            current = parent.nodeId;
          }
        }
        
        return {
          nodes: pathNodes, 
          edges: pathEdges
        };
      }
      
      // 探索相邻节点 - 只考虑当前视图中的节点和边
      const connections = edgesByNode.get(currentNode) || [];
      for (const {edgeId, connectedNodeId} of connections) {
        // 确保连接的节点在当前视图中
        if (!visited.has(connectedNodeId) && currentViewNodesRef.current.has(connectedNodeId)) {
          nodeQueue.push(connectedNodeId);
          nodesInPath.add(connectedNodeId);
          edgesInPath.add(edgeId);
          parentMap.set(connectedNodeId, {nodeId: currentNode, edgeId});
        }
      }
    }
    
    // 如果没有找到路径，返回空数组
    return {nodes: [], edges: []};
  }, []);  // 依赖已经移除graphData.edges，因为我们现在使用缓存的视图数据
  
  // 高亮到中心节点的路径 - 使用CSS类实现
  const highlightPathToCentral = useCallback((nodeId: string) => {
    if (!graphState || nodeId === centralNodeId) return;
    
    // 找出路径
    const path = findPathToCentralNode(nodeId, centralNodeId);
    highlightedPathRef.current = path;
    
    // 获取当前视图中的所有节点和边
    const allCells = graphState.getCells();
    const allNodeIds = new Set(allCells.filter(cell => cell.isNode()).map(node => node.id));
    const allEdgeIds = new Set(allCells.filter(cell => cell.isEdge()).map(edge => edge.id));
    
    const nodesToHighlight = new Set(path.nodes);
    const edgesToHighlight = new Set(path.edges);
    
    // 应用CSS类而不是直接修改属性
    graphState.batchUpdate(() => {
      // 高亮路径上的节点
      allCells.forEach(cell => {
        // 处理节点
        if (cell.isNode()) {
          const cellView = graphState.findViewByCell(cell);
          if (cellView) {
            const cellId = cell.id;
            
            // 移除所有相关类
            cellView.removeClass('highlight-node highlight-source dimmed');
            
            if (nodesToHighlight.has(cellId)) {
              // 添加高亮类
              cellView.addClass('highlight-node');
              
              // 特殊标记起点
              if (cellId === nodeId) {
                cellView.addClass('highlight-source');
              }
            } else {
              // 非路径节点添加暗化类
              cellView.addClass('dimmed');
            }
          }
        } 
        // 处理边
        else if (cell.isEdge()) {
          const cellView = graphState.findViewByCell(cell);
          if (cellView) {
            const cellId = cell.id;
            
            // 移除所有相关类
            cellView.removeClass('highlight-edge dimmed');
            
            if (edgesToHighlight.has(cellId)) {
              // 添加高亮类
              cellView.addClass('highlight-edge');
            } else {
              // 非路径边添加暗化类
              cellView.addClass('dimmed');
            }
          }
        }
      });
    });
  }, [graphState, centralNodeId, findPathToCentralNode]);
  
  // 重置所有高亮，恢复节点和边的原始状态
  const resetHighlights = useCallback(() => {
    if (!graphState || !highlightedPathRef.current) return;
    
    // 获取当前所有单元格
    const allCells = graphState.getCells();
    
    // 性能优化：批量更新
    graphState.batchUpdate(() => {
      // 移除所有节点和边的高亮和暗化类
      allCells.forEach(cell => {
        const cellView = graphState.findViewByCell(cell);
        if (cellView) {
          cellView.removeClass('highlight-node highlight-source highlight-edge dimmed');
        }
      });
    });
    
    // 清除当前高亮路径
    highlightedPathRef.current = null;
  }, [graphState]);

  // 初始化图形时添加边的点击事件监听和节点的长按事件监听
  useEffect(() => {
    if (!graphState) return;

    // 添加边点击事件
    graphState.on('edge:click', ({ edge }) => {
      // 如果是长按触发的点击，不执行通常的点击操作
      if (isPress.current) {
        isPress.current = false;
        return;
      }
      
      // 显示工具
      edge.addTools({
        name: 'button',
        args: {
          markup: [
            {
              tagName: 'circle',
              selector: 'button',
              attrs: {
                r: 14,
                stroke: 'var(--ion-color-primary, #3880ff)',
                strokeWidth: 2,
                fill: 'white',
                cursor: 'pointer',
              },
            },
            {
              tagName: 'text',
              textContent: '...',
              selector: 'icon',
              attrs: {
                fill: 'var(--ion-color-primary, #3880ff)',
                fontSize: 12,
                fontWeight: 'bold',
                textAnchor: 'middle',
                pointerEvents: 'none',
                y: '0.3em',
              },
            },
          ],
          distance: -40,
          onClick: (args: any) => {
            // 调用右键菜单处理函数，传递自定义事件对象
            handleEdgeContextMenu(args.view.cell, { target: args.e.target });
          },
        },
      });
      
      // 记录选中的边
      setSelectedEdges([edge.id]);
    });
    
    // 添加边长按事件 (通过mousedown/mouseup模拟)
    graphState.on('edge:mousedown', ({ cell, e }) => {
      // 记录当前长按的边和位置
      edgeUnderLongPressRef.current = { 
        cell, 
        clientX: e.clientX || 0, 
        clientY: e.clientY || 0 
      };
      
      // 设置长按计时器 (600ms)
      longPressTimerRef.current = setTimeout(() => {
        // 长按时间到，触发菜单
        if (edgeUnderLongPressRef.current) {
          isPress.current = true;
          const { cell, clientX, clientY } = edgeUnderLongPressRef.current;
          // 创建自定义事件对象，包含必要的坐标信息
          const customEvent = {
            preventDefault: () => {},
            clientX,
            clientY,
            // 标记为长按触发
            isLongPress: true
          };
          
          // 调用现有的右键菜单处理函数
          handleEdgeContextMenu(cell, customEvent);
          
          // 显示长按反馈
          cell.attr('line/strokeWidth', 3);
          cell.attr('line/stroke-dasharray', '5,5');
          
          // 500ms后恢复原样
          setTimeout(() => {
            cell.attr('line/strokeWidth', 2);
            cell.attr('line/stroke-dasharray', '');
          }, 500);
          
          // 清除长按状态
          clearLongPressTimer();
        }
      }, 600); // 长按阈值设为600ms
    });
    
    // 监听边mouseup事件，结束长按
    graphState.on('edge:mouseup', () => {
      clearLongPressTimer();
    });
    
    // 如果手指/鼠标移出了边，也取消长按
    graphState.on('edge:mouseleave', () => {
      clearLongPressTimer();
    });
    
    // 添加节点长按事件 (通过mousedown/mouseup模拟)
    graphState.on('node:mousedown', ({ cell, e }) => {
      // 记录当前长按的节点和位置
      nodeUnderLongPressRef.current = { 
        cell, 
        clientX: e.clientX || 0, 
        clientY: e.clientY || 0 
      };
      
      // 设置长按计时器 (600ms)
      longPressTimerRef.current = setTimeout(() => {
        // 长按时间到，触发菜单
        if (nodeUnderLongPressRef.current) {
          isPress.current = true;
          const { cell, clientX, clientY } = nodeUnderLongPressRef.current;
          // 创建自定义事件对象，包含必要的坐标信息
          const customEvent = {
            preventDefault: () => {},
            clientX,
            clientY,
            // 标记为长按触发
            isLongPress: true
          };
          
          // 调用现有的右键菜单处理函数
          handleNodeContextMenu(cell, customEvent);
          
          // 显示长按反馈
          cell.attr('body/stroke', 'var(--ion-color-primary, #3880ff)');
          cell.attr('body/strokeWidth', 2);
          
          // 500ms后恢复原样
          setTimeout(() => {
            cell.attr('body/strokeWidth', 1);
          }, 500);
          
          // 清除长按状态
          clearLongPressTimer();
        }
      }, 600); // 长按阈值设为600ms
    });
    
    // 监听mouseup事件，结束长按
    graphState.on('node:mouseup', () => {
      clearLongPressTimer();
    });

    // 添加节点鼠标悬停和离开事件
    // TODO: (AI不要擅自实现) 可以加防抖优化
    graphState.on('node:mouseenter', ({ cell }) => {
      const nodeId = cell.id;
      highlightPathToCentral(nodeId);
    });
    
    graphState.on('node:mouseleave', () => {
      resetHighlights();
      clearLongPressTimer();
    });

    // 点击空白区域时，移除所有边的工具和清除长按状态
    graphState.on('blank:click', () => {
      // 清除选中的边
      selectedEdges.forEach(edgeId => {
        const edge = graphState.getCellById(edgeId);
        if (edge && edge.isEdge()) {
          edge.removeTools();
        }
      });
      setSelectedEdges([]);
      clearLongPressTimer();
    });

    // 点击节点时，也移除所有边的工具
    graphState.on('node:click', ({ cell }) => {
      
      // 清除选中的边
      selectedEdges.forEach(edgeId => {
        const edge = graphState.getCellById(edgeId);
        if (edge && edge.isEdge()) {
          edge.removeTools();
        }
      });
      setSelectedEdges([]);
      
      // 此时如果有节点长按计时器，也应该清除
      clearLongPressTimer();
    });

    return () => {
      // 清理事件监听器
      graphState.off('edge:click');
      graphState.off('edge:mousedown');
      graphState.off('edge:mouseup');
      graphState.off('edge:mouseleave');
      graphState.off('node:mousedown');
      graphState.off('node:mouseup');
      graphState.off('node:mousemove');
      graphState.off('node:mouseleave');
      graphState.off('node:mouseenter'); // 新增清理
      clearLongPressTimer();
    };
  }, [graphState, selectedEdges, highlightPathToCentral, resetHighlights]);

  // 添加CSS样式
  useEffect(() => {
    // 添加自定义CSS样式
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      /* 边点击样式 */
      .x6-edge:hover {
        cursor: pointer;
      }
      
      /* 工具按钮动画效果 */
      .x6-edge-tool {
        animation: fade-in 0.2s ease-out;
      }
      
      /* 长按节点反馈样式 */
      .x6-node.long-press-highlight {
        filter: brightness(1.1);
      }
      
      /* 长按边反馈样式 */
      .x6-edge.long-press-highlight path {
        stroke-width: 3px;
        stroke-dasharray: 5,5;
      }
      
      @keyframes fade-in {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      // 清理
      document.head.removeChild(styleElement);
    };
  }, []);

  // Memoize event handlers
  const handleNodeClick = useCallback((nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId);
    }
  }, [onNodeClick]);

  const handleEditNode = useCallback((nodeId: string, label: string) => {
    if (onEditNode) {
      onEditNode(nodeId, label);
    }
  }, [onEditNode]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (onDeleteNode) {
      onDeleteNode(nodeId);
    }
  }, [onDeleteNode]);

  const handleEditEdge = useCallback((edgeId: string, label: string, isSimpleLabel?: boolean) => {
    if (onEditEdge) {
      onEditEdge(edgeId, label, isSimpleLabel);
    }
  }, [onEditEdge]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    if (onDeleteEdge) {
      onDeleteEdge(edgeId);
    }
  }, [onDeleteEdge]);

  const handleCreateRelation = useCallback((sourceNodeId: string, relationType: string, targetNodeId?: string, nodeLabel?: string) => {
    if (onCreateRelation) {
      onCreateRelation(sourceNodeId, relationType, targetNodeId, nodeLabel);
    }
  }, [onCreateRelation]);

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
        isOpen={contextMenuState.isOpen}
        position={contextMenuState.position}
        items={contextMenuState.items}
        onClose={closeContextMenu}
        navbarHeight={navbarHeight} // 传入导航栏高度
      />

      {/* 节点编辑模态框 */}
      <NodeEditModal
        isOpen={nodeEditModal.current.isOpen}
        onClose={() => nodeEditModal.current.isOpen = false}
        nodeId={nodeEditModal.current.nodeId}
        nodeLabel={nodeEditModal.current.nodeLabel}
        existingNodes={graphData.nodes}
        existingEdges={graphData.edges}
        isNewNode={nodeEditModal.current.isNewNode}
        relationType={nodeEditModal.current.relationType}
        sourceNodeId={nodeEditModal.current.sourceNodeId}
        onSave={(nodeId, newLabel, targetNodeId) => {
          if (onEditNode && !targetNodeId && !nodeEditModal.current.isNewNode) {
            onEditNode(nodeId, newLabel);
          } else if (targetNodeId) {
            if (nodeEditModal.current.isNewNode && onCreateRelation) {
              onCreateRelation(nodeEditModal.current.sourceNodeId, nodeEditModal.current.relationType, targetNodeId);
            } else if (!nodeEditModal.current.isNewNode && onEditNode) {
              onEditNode(nodeId, `MERGE:${targetNodeId}`);
            }
          } else if (nodeEditModal.current.isNewNode && onCreateRelation) {
            onCreateRelation(nodeEditModal.current.sourceNodeId, nodeEditModal.current.relationType, undefined, newLabel);
          }
        }}
      />

      {/* 边编辑模态框 */}
      <EdgeEditModal
        isOpen={edgeEditModal.current.isOpen}
        onClose={() => edgeEditModal.current.isOpen = false}
        edgeId={edgeEditModal.current.edgeId}
        relationshipType={edgeEditModal.current.relationshipType}
        existingEdges={graphData.edges}
        labelMode={viewConfig.showRelationshipLabels}
        isNewRelation={edgeEditModal.current.isNewRelation}
        onSave={(edgeId, newRelationshipType, isSimpleLabel) => {
          if (edgeEditModal.current.isNewRelation) {
            if (onCreateRelation) {
              onCreateRelation(edgeEditModal.current.sourceNodeId, newRelationshipType, undefined, `新${newRelationshipType}节点`);
            }
          } else {
            if (onEditEdge) {
              onEditEdge(edgeId, newRelationshipType, isSimpleLabel);
            }
          }
          edgeEditModal.current.isOpen = false;
        }}
      />
    </div>
  );
});

export default React.memo(GraphView); 