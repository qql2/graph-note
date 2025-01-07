import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Graph, Node, Shape, Edge } from '@antv/x6';
import { v4 as uuidv4 } from 'uuid';
import { databaseService, GraphNode, GraphEdge } from '../../services/DatabaseService';
import './GraphEditor.css';

// 类型定义
interface NodeData {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  type?: string;
  properties?: Record<string, any>;
}

interface EdgeData {
  id?: string;
  source: string;
  target: string;
  type?: string;
  properties?: Record<string, any>;
}

interface TouchState {
  canvasBlank: boolean;
  fingers: number;
  isDragging: boolean;
  isZooming: boolean;
  lastTouchX: number;
  lastTouchY: number;
  initialDistance: number;
  initialScale: number;
}

interface GraphEditorProps {
  onNodeMoved?: (data: { id: string; position: { x: number; y: number } }) => void;
  onGraphChanged?: () => void;
}

export interface GraphEditorRef {
  addNode: (nodeData: NodeData) => Promise<string>;
  addEdge: (edgeData: EdgeData) => Promise<string>;
  loadGraph: () => Promise<void>;
}

const GraphEditor = forwardRef<GraphEditorRef, GraphEditorProps>(({ onNodeMoved, onGraphChanged }, ref) => {
  console.log('GraphEditor component rendering');
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [isGraphReady, setIsGraphReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  const clearFn = useRef<Array<() => void>>([]);
  const touchStateRef = useRef<TouchState>({
    canvasBlank: false,
    fingers: 0,
    isDragging: false,
    isZooming: false,
    lastTouchX: 0,
    lastTouchY: 0,
    initialDistance: 0,
    initialScale: 1,
  });

  // 计算两点之间的距离
  const getDistance = (p1: Touch, p2: Touch): number => {
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

  // 加载图数据
  const loadGraph = async () => {
    if (!graphRef.current) return;
    setIsLoading(true);
    isLoadingRef.current = true;
    setDbError(null);

    try {
      const nodes = await databaseService.getNodes();
      console.log('Loaded nodes:', nodes);
      const edges = await databaseService.getEdges();
      console.log('Loaded edges:', edges);

      // 清除现有图形
      graphRef.current.clearCells();

      // 添加节点
      nodes.forEach(node => {
        graphRef.current?.addNode({
          id: node.id,
          x: node.x,
          y: node.y,
          width: 120,
          height: 40,
          label: node.label,
          attrs: {
            body: {
              fill: 'var(--ion-color-light)',
              stroke: 'var(--ion-color-medium)',
              rx: 6,
              ry: 6,
            },
            label: {
              fill: 'var(--ion-color-dark)',
              fontSize: 12,
            },
          },
        });
      });

      // 添加边
      edges.forEach(edge => {
        graphRef.current?.addEdge({
          id: edge.id,
          source: edge.source_id,
          target: edge.target_id,
          attrs: {
            line: {
              stroke: 'var(--ion-color-medium)',
              strokeWidth: 1,
              targetMarker: {
                name: 'classic',
                size: 8,
              },
            },
          },
        });
      });
    } catch (error) {
      console.error('Error loading graph:', error);
      setDbError(error instanceof Error ? error.message : 'Failed to load graph data');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // 添加节点
  const addNode = async (nodeData: NodeData): Promise<string> => {
    if (!graphRef.current) throw new Error('Graph not initialized');

    const id = nodeData.id || uuidv4();
    const node: GraphNode = {
      id,
      type: nodeData.type || 'default',
      label: nodeData.label,
      x: nodeData.x,
      y: nodeData.y,
      properties: nodeData.properties || {},
      created_at: '',  // 由数据库服务填充
      updated_at: '',  // 由数据库服务填充
    };

    await databaseService.addNode(node);
    
    graphRef.current.addNode({
      id: node.id,
      x: node.x,
      y: node.y,
      width: nodeData.width || 120,
      height: nodeData.height || 40,
      label: node.label,
      attrs: {
        body: {
          fill: 'var(--ion-color-light)',
          stroke: 'var(--ion-color-medium)',
          rx: 6,
          ry: 6,
        },
        label: {
          fill: 'var(--ion-color-dark)',
          fontSize: 12,
        },
      },
    });

    onGraphChanged?.();
    return id;
  };

  // 添加边
  const addEdge = async (edgeData: EdgeData): Promise<string> => {
    if (!graphRef.current) throw new Error('Graph not initialized');

    const id = edgeData.id || uuidv4();
    const edge: GraphEdge = {
      id,
      source_id: edgeData.source,
      target_id: edgeData.target,
      type: edgeData.type || 'default',
      properties: edgeData.properties || {},
      created_at: '',  // 由数据库服务填充
    };

    await databaseService.addEdge(edge);

    graphRef.current.addEdge({
      id: edge.id,
      source: edge.source_id,
      target: edge.target_id,
      attrs: {
        line: {
          stroke: 'var(--ion-color-medium)',
          strokeWidth: 1,
          targetMarker: {
            name: 'classic',
            size: 8,
          },
        },
      },
    });

    onGraphChanged?.();
    return id;
  };

  // 初始化图形实例
  useEffect(() => {
    console.log('GraphEditor init effect running');
    console.log('Container ref:', containerRef.current);
    console.log('Graph ref:', graphRef.current);

    if (!containerRef.current || graphRef.current) {
      console.log('Skipping graph initialization - conditions not met');
      return;
    }

    // 等待容器尺寸就绪
    const initGraph = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      console.log('Container dimensions:', { width, height });

      if (width === 0 || height === 0) {
        console.log('Container dimensions not ready, retrying...');
        const id = requestAnimationFrame(initGraph);
        clearFn.current.push(() => cancelAnimationFrame(id));
        return;
      }

      console.log('Starting graph initialization');

      const graph = new Graph({
        container: containerRef.current,
        width,
        height,
        grid: {
          visible: true,
          type: 'dot',
          size: 10,
          args: {
            color: 'rgba(255, 255, 255, 0.3)',
          },
        },
        connecting: {
          snap: true,
          allowBlank: false,
          highlight: true,
          connector: 'smooth',
          connectionPoint: 'boundary',
          router: {
            name: 'er',
            args: {
              padding: 20,
            },
          },
          validateConnection: () => true,
          createEdge: () => {
            return new Shape.Edge({
              attrs: {
                line: {
                  stroke: 'rgba(255, 255, 255, 0.3)',
                  strokeWidth: 1,
                  targetMarker: {
                    name: 'classic',
                    size: 8,
                  },
                },
              },
            });
          },
        },
        interacting: {
          nodeMovable: true,
          edgeMovable: true,
          magnetConnectable: true,
        },
        mousewheel: {
          enabled: true,
          modifiers: [],
          factor: 1.1,
          maxScale: 3,
          minScale: 0.5,
        },
        panning: {
          enabled: true,
          eventTypes: ['leftMouseDown'],
        },
        background: {
          color: 'var(--ion-background-color)',
        },
        highlighting: {
          magnetAvailable: {
            name: 'stroke',
            args: {
              padding: 4,
              attrs: {
                stroke: 'var(--ion-color-primary)',
                strokeWidth: 2,
              },
            },
          },
          magnetAdsorbed: {
            name: 'stroke',
            args: {
              padding: 4,
              attrs: {
                stroke: 'var(--ion-color-success)',
                strokeWidth: 2,
              },
            },
          },
        },
      });

      console.log('Graph instance created');
      graphRef.current = graph;
      setIsGraphReady(true);

      // 优化节点移动事件
      graph.on('node:moving', ({ e }) => {
        e.stopPropagation();
        e.preventDefault();
      });

      // 监听节点移动
      graph.on('node:moved', async ({ node }) => {
        const { x, y } = node.getPosition();
        await databaseService.updateNode(node.id, { x, y });
        onNodeMoved?.({
          id: node.id,
          position: { x, y },
        });
        onGraphChanged?.();
      });

      // 触摸事件处理
      const handleTouchMove = (e: TouchEvent) => {
        const graph = graphRef.current;
        const touchState = touchStateRef.current;
        
        if (!graph || !touchState.canvasBlank) return;

        if (touchState.isDragging && touchState.fingers === 1) {
          const touch = e.touches[0];
          const deltaX = touch.clientX - touchState.lastTouchX;
          const deltaY = touch.clientY - touchState.lastTouchY;

          graph.translateBy(deltaX, deltaY);

          touchState.lastTouchX = touch.clientX;
          touchState.lastTouchY = touch.clientY;
        } else if (touchState.isZooming && touchState.fingers === 2) {
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];

          const distance = getDistance(touch1, touch2);
          const scale = (distance / touchState.initialDistance) * touchState.initialScale;
          const limitedScale = Math.min(Math.max(scale, 0.5), 3);
          const center = getMidPoint(touch1, touch2);

          graph.zoom(limitedScale, {
            absolute: true,
            center: {
              x: center.x,
              y: center.y,
            },
          });
        }

        e.preventDefault();
      };

      // 监听空白区域的触摸
      graph.on('blank:mousedown', (e) => {
        touchStateRef.current.canvasBlank = true;
      });

      graph.on('blank:mouseup', () => {
        touchStateRef.current.canvasBlank = false;
      });

      if (containerRef.current) {
        containerRef.current.addEventListener('touchstart', (e) => {
          e.preventDefault();
          const touchState = touchStateRef.current;
          touchState.fingers = e.touches?.length || 0;
          
          if (e.touches?.length === 1) {
            touchState.isDragging = true;
            touchState.lastTouchX = e.touches[0].clientX;
            touchState.lastTouchY = e.touches[0].clientY;
          } else if (e.touches?.length === 2) {
            touchState.isZooming = true;
            touchState.initialDistance = getDistance(e.touches[0], e.touches[1]);
            touchState.initialScale = graphRef.current!.scale().sx;
          }
        }, { passive: false });

        containerRef.current.addEventListener('touchmove', handleTouchMove, {
          passive: false,
        });

        const handleTouchEnd = () => {
          const touchState = touchStateRef.current;
          touchState.isDragging = false;
          touchState.isZooming = false;
          touchState.fingers = 0;
        };

        containerRef.current.addEventListener('touchend', handleTouchEnd, {
          passive: true,
        });
        containerRef.current.addEventListener('touchcancel', handleTouchEnd, {
          passive: true,
        });
      }

      // 添加边连接事件处理
      graph.on('edge:connected', async ({ edge }) => {
        const edgeData = {
          id: edge.id,
          source: edge.getSourceCellId(),
          target: edge.getTargetCellId(),
        };
        await addEdge(edgeData);
      });

      // 删除事件处理
      graph.on('cell:removed', async (args) => {
        // 如果正在加载数据，不处理删除事件
        if (isLoadingRef.current) {
          return;
        }

        const cell = args.cell;
        if (cell instanceof Node) {
          await databaseService.deleteNode(cell.id);
        } else if (cell instanceof Edge) {
          await databaseService.deleteEdge(cell.id);
        }
        onGraphChanged?.();
      });

      // 初始化完成后加载图数据
      loadGraph();
    };

    // 开始初始化
    initGraph()

    return () => {
      console.log('Cleaning up graph');
      clearFn.current.forEach(fn => fn());
      clearFn.current = [];
      if (graphRef.current) {
        graphRef.current.dispose();
        graphRef.current = null;
      }
      setIsGraphReady(false);
    };
  }, [onNodeMoved, onGraphChanged]);

  // 在图形准备就绪后渲染示例数据
  useEffect(() => {
    console.log('isGraphReady effect running, ready:', isGraphReady);
    if (isGraphReady && graphRef.current) {
      console.log('Graph is ready for data');
      loadGraph();
    }
  }, [isGraphReady]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    addNode,
    addEdge,
    loadGraph,
  }));

  console.log('Rendering graph editor container');
  return (
    <div 
      ref={containerRef} 
      className="graph-editor-container" 
      style={{ border: '1px solid red' }}
    >
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 1000,
        }}>
          Loading graph data...
        </div>
      )}
      {dbError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 1000,
        }}>
          Error: {dbError}
        </div>
      )}
    </div>
  );
});

export default GraphEditor;
export type { NodeData, EdgeData }; 