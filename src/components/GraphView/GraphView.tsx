import React, { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/x6';
import { GraphData, QuadrantConfig, defaultQuadrantConfig } from '../../models/GraphNode';
import { GraphLayoutService } from '../../services/GraphLayoutService';
import './GraphView.css';

interface GraphViewProps {
  graphData: GraphData;
  centralNodeId: string;
  quadrantConfig?: QuadrantConfig;
  onNodeClick?: (nodeId: string) => void;
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
    },
  },
  true
);

const GraphView: React.FC<GraphViewProps> = ({
  graphData,
  centralNodeId,
  quadrantConfig = defaultQuadrantConfig,
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
        router: 'manhattan',
        connector: {
          name: 'rounded',
          args: {
            radius: 8,
          },
        },
        anchor: 'center',
        connectionPoint: 'anchor',
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
      quadrantConfig
    );

    // Calculate positions for each node
    const layoutData = GraphLayoutService.calculateQuadrantLayout(
      organizedData,
      containerRef.current.offsetWidth,
      containerRef.current.offsetHeight
    );

    // Add nodes to the graph
    const nodes = layoutData.map((nodeData: any) => {
      const { id, x, y, width, height, label, isCentralNode, quadrant } = nodeData;
      
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
        },
      });
    });

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
        
        graph.addEdge({
          id: edgeData.id,
          source: edgeData.source,
          target: edgeData.target,
          shape: 'graph-edge',
          attrs: {
            line: {
              stroke: edgeColor,
            },
          },
          data: {
            relationshipType: edgeData.relationshipType,
          },
        });
      }
    });

    // Center the view
    graph.centerContent();

  }, [graph, graphData, centralNodeId, quadrantConfig]);

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