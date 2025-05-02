import React from 'react';
import { QuadrantPosition } from '../models/GraphNode';
import { Node, Graph } from '@antv/x6';

// 定义组件接收的props
interface GraphNodeComponentProps {
  node: Node<Node.Properties>;
  graph: Graph;
}

// 定义节点数据结构
interface NodeData {
  id: string;
  label: string;
  isCentralNode: boolean;
  quadrant: QuadrantPosition;
  depth: number;
  isNewNode?: boolean;
}

const GraphNodeComponent: React.FC<GraphNodeComponentProps> = ({ node }) => {
  // 从节点的data属性中获取数据
  const data = node.getData() as NodeData;
  const { id, label, isCentralNode, quadrant, isNewNode } = data;

  // 根据节点类型选择不同的样式
  const getNodeColor = () => {
    if (isCentralNode) return 'var(--ion-color-warning, #FF9800)';
    
    switch (quadrant) {
      case QuadrantPosition.TOP:
        return 'var(--ion-color-success, #4CAF50)';
      case QuadrantPosition.BOTTOM:
        return 'var(--ion-color-primary, #2196F3)';
      case QuadrantPosition.LEFT:
        return 'var(--ion-color-tertiary, #9C27B0)';
      case QuadrantPosition.RIGHT:
        return 'var(--ion-color-danger, #F44336)';
      default:
        return 'var(--ion-color-medium, #607D8B)';
    }
  };

  // 计算文本样式
  const getFontSize = () => {
    return isCentralNode ? '16px' : '14px';
  };

  // 新节点的动画样式
  const newNodeStyle = isNewNode ? 'new-node' : '';

  return (
    <div
      className={`react-graph-node ${newNodeStyle}`}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: getNodeColor(),
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        fontWeight: isCentralNode ? 'bold' : 'normal',
      }}
    >
      <div
        style={{
          fontSize: getFontSize(),
          color: 'white',
          textAlign: 'center',
          wordBreak: 'break-word',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          width: '100%',
        }}
      >
        {label || id}
      </div>
    </div>
  );
};

export default GraphNodeComponent; 