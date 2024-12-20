import React, { useCallback, useRef } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent } from '@ionic/react';
import GraphEditor, { NodeData, EdgeData, GraphEditorRef } from '../../components/GraphEditor/GraphEditor';
import './GraphView.css';

const GraphView: React.FC = () => {
  console.log('GraphView component rendering');
  const graphEditorRef = useRef<GraphEditorRef>(null);

  // 处理节点移动事件
  const handleNodeMoved = useCallback((data: { id: string; position: { x: number; y: number } }) => {
    console.log('Node moved:', data);
    // 这里可以添加持久化逻辑
  }, []);

  // 示例数据
  const sampleData = {
    nodes: [
      {
        id: '1',
        x: 100,
        y: 100,
        label: '概念 1',
      },
      {
        id: '2',
        x: 300,
        y: 100,
        label: '概念 2',
      },
      {
        id: '3',
        x: 200,
        y: 250,
        label: '概念 3',
      },
    ],
    edges: [
      {
        source: '1',
        target: '2',
      },
      {
        source: '2',
        target: '3',
      },
      {
        source: '3',
        target: '1',
      },
    ],
  };

  // 处理添加节点
  const handleAddNode = useCallback(() => {
    console.log('Add node button clicked');
    if (graphEditorRef.current) {
      const newNode: NodeData = {
        id: Date.now().toString(),
        x: Math.random() * 300 + 100,
        y: Math.random() * 300 + 100,
        label: '新节点',
      };
      console.log('Creating new node:', newNode);
      const result = graphEditorRef.current.addNode(newNode);
      console.log('Add node result:', result);
    } else {
      console.log('GraphEditor ref not available');
    }
  }, []);

  console.log('Rendering GraphView container');
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>知识图谱</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleAddNode}>
              添加节点
            </IonButton>
            <IonButton>
              保存
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="graph-view-container">
          <GraphEditor
            ref={graphEditorRef}
            onNodeMoved={handleNodeMoved}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default GraphView; 