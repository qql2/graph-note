import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Graph, Node, Shape } from '@antv/x6';
import './GraphEditor.css';

// 类型定义
interface NodeData {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
}

interface EdgeData {
  source: string;
  target: string;
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
}

export interface GraphEditorRef {
  addNode: (nodeData: NodeData) => any;
  addEdge: (edgeData: EdgeData) => any;
}

const GraphEditor = forwardRef<GraphEditorRef, GraphEditorProps>(({ onNodeMoved }, ref) => {
  console.log('GraphEditor component rendering');
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [isGraphReady, setIsGraphReady] = useState(false);
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
        requestAnimationFrame(initGraph);
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
      graph.on('node:moved', ({ node, x, y }) => {
        onNodeMoved?.({
          id: node.id,
          position: { x, y },
        });
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
    };

    // 开始初始化
    requestAnimationFrame(initGraph);

    return () => {
      console.log('Cleaning up graph');
      if (graphRef.current) {
        graphRef.current.dispose();
      }
      setIsGraphReady(false);
    };
  }, [onNodeMoved]);

  // 在图形准备就绪后渲染示例数据
  useEffect(() => {
    console.log('isGraphReady effect running, ready:', isGraphReady);
    if (isGraphReady && graphRef.current) {
      console.log('Graph is ready for data');
    }
  }, [isGraphReady]);

  // 添加节点方法
  const addNode = (nodeData: NodeData) => {
    console.log('Adding node:', nodeData);
    if (!graphRef.current) {
      console.log('Cannot add node - graph not initialized');
      return null;
    }

    const node = graphRef.current.addNode({
      id: nodeData.id,
      x: nodeData.x,
      y: nodeData.y,
      width: nodeData.width || 100,
      height: nodeData.height || 40,
      label: nodeData.label,
      shape: 'rect',
      attrs: {
        body: {
          fill: '#ffffff',
          stroke: '#8f8f8f',
          strokeWidth: 1,
          rx: 6,
          ry: 6,
        },
        label: {
          text: nodeData.label,
          fill: '#333333',
          fontSize: 14,
          fontFamily: 'Arial, helvetica, sans-serif',
        },
      },
      ports: {
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#8f8f8f',
                fill: '#ffffff',
              },
            },
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#8f8f8f',
                fill: '#ffffff',
              },
            },
          },
        },
        items: [{ group: 'in' }, { group: 'out' }],
      },
    });

    console.log('Node added successfully:', node.id);
    return {
      id: node.id,
      position: node.getPosition(),
    };
  };

  // 添加边方法
  const addEdge = (edgeData: EdgeData) => {
    console.log('Adding edge:', edgeData);
    if (!graphRef.current) {
      console.log('Cannot add edge - graph not initialized');
      return null;
    }

    const edge = graphRef.current.addEdge({
      source: edgeData.source,
      target: edgeData.target,
      attrs: {
        line: {
          stroke: '#8f8f8f',
          strokeWidth: 1,
          targetMarker: {
            name: 'classic',
            size: 8,
          },
        },
      },
      router: {
        name: 'er',
        args: {
          padding: 20,
        },
      },
      connector: {
        name: 'rounded',
        args: {
          radius: 8,
        },
      },
    });

    console.log('Edge added successfully:', edge.id);
    return {
      id: edge.id,
      source: edge.getSource(),
      target: edge.getTarget(),
    };
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    addNode: (nodeData: NodeData) => {
      if (!graphRef.current) return null;
      return addNode(nodeData);
    },
    addEdge: (edgeData: EdgeData) => {
      if (!graphRef.current) return null;
      return addEdge(edgeData);
    },
  }));

  console.log('Rendering graph editor container');
  return (
    <div 
      ref={containerRef} 
      className="graph-editor-container" 
      style={{ border: '1px solid red' }} // 添加边框以便于调试
    />
  );
});

export default GraphEditor;
export type { NodeData, EdgeData }; 