import React, { useState, useEffect } from 'react';
import { 
  IonContent, 
  IonHeader, 
  IonPage, 
  IonTitle, 
  IonToolbar,
  IonButton,
  IonButtons,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonLabel,
  IonToast,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardContent
} from '@ionic/react';
import { refreshOutline, arrowBack } from 'ionicons/icons';
import GraphView from '../components/GraphView';
import { GraphData, GraphNode, GraphEdge, RelationshipType, QuadrantConfig, defaultQuadrantConfig } from '../models/GraphNode';
import graphDatabaseService from '../services/graph-database/GraphDatabaseService';
import './GraphViewDemo.css';

// 转换数据库数据到我们的GraphView组件格式
const convertDbDataToGraphData = (
  dbNodes: any[], 
  dbEdges: any[]
): GraphData => {
  const nodes: GraphNode[] = dbNodes.map(dbNode => ({
    id: dbNode.id!,
    label: dbNode.label,
    description: dbNode.properties?.description || '',
    metadata: dbNode.properties || {},
  }));

  const edges: GraphEdge[] = dbEdges.map(dbEdge => {
    // 根据边的类型映射到我们定义的关系类型
    let relationshipType: RelationshipType;
    
    switch (dbEdge.type.toLowerCase()) {
      case 'father':
      case 'parent':
        relationshipType = RelationshipType.FATHER;
        break;
      case 'child':
        relationshipType = RelationshipType.CHILD;
        break;
      case 'base':
      case 'foundation':
        relationshipType = RelationshipType.BASE;
        break;
      case 'build':
      case 'derived':
        relationshipType = RelationshipType.BUILD;
        break;
      default:
        // 默认关系类型，可以根据需要调整
        relationshipType = RelationshipType.BUILD;
    }

    return {
      id: dbEdge.id!,
      source: dbEdge.source_id,
      target: dbEdge.target_id,
      relationshipType,
      metadata: dbEdge.properties || {},
    };
  });

  return { nodes, edges };
};

const GraphViewDemo: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({nodes: [], edges: []});
  const [centralNodeId, setCentralNodeId] = useState<string>('');
  const [quadrantConfig, setQuadrantConfig] = useState<QuadrantConfig>(defaultQuadrantConfig);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 从数据库加载数据
  useEffect(() => {
    const loadGraphData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 初始化数据库
        await graphDatabaseService.initialize({
          dbName: 'graph_database',
          version: 1,
          verbose: true
        });
        
        const db = graphDatabaseService.getDatabase();
        
        // 获取所有节点和边
        const dbNodes = await db.getNodes();
        const dbEdges = await db.getEdges();
        
        // 转换数据格式
        const convertedData = convertDbDataToGraphData(dbNodes, dbEdges);
        setGraphData(convertedData);
        
        // 如果有节点，则设置第一个节点为中心节点
        if (convertedData.nodes.length > 0) {
          setCentralNodeId(convertedData.nodes[0].id);
        }
        
      } catch (err) {
        console.error('加载图数据失败:', err);
        setError(`加载数据失败: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadGraphData();
    
    // 组件卸载时关闭数据库
    return () => {
      graphDatabaseService.closeDatabase();
    };
  }, []);

  // 处理节点点击，改变中心节点
  const handleNodeClick = (nodeId: string) => {
    setCentralNodeId(nodeId);
    setToastMessage(`正在查看节点: ${nodeId}`);
    setShowToast(true);
  };

  // 处理象限配置更改
  const handleQuadrantChange = (position: keyof QuadrantConfig, value: RelationshipType) => {
    setQuadrantConfig({
      ...quadrantConfig,
      [position]: value
    });
  };

  // 刷新视图，返回到第一个节点
  const handleReset = () => {
    if (graphData.nodes.length > 0) {
      setCentralNodeId(graphData.nodes[0].id);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton routerLink="/home">
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>图形视图展示</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleReset} disabled={loading}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {loading ? (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <p>正在加载数据...</p>
          </div>
        ) : error ? (
          <IonCard>
            <IonCardContent>
              <div className="error-container">
                <p>出错了: {error}</p>
                <IonButton onClick={() => window.location.reload()}>重试</IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        ) : graphData.nodes.length === 0 ? (
          <IonCard>
            <IonCardContent>
              <div className="empty-container">
                <p>数据库中没有图数据，请先使用图数据库演示页面添加节点和边。</p>
                <IonButton routerLink="/graph-demo">前往图数据库演示</IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        ) : (
          <>
            <div className="graph-controls">
              <h4>象限配置</h4>
              <div className="quadrant-config">
                <IonItem>
                  <IonLabel>上方</IonLabel>
                  <IonSelect 
                    value={quadrantConfig.top} 
                    onIonChange={e => handleQuadrantChange('top', e.detail.value as RelationshipType)}
                  >
                    <IonSelectOption value={RelationshipType.FATHER}>父节点关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.CHILD}>子节点关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.BASE}>基础关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.BUILD}>构建关系</IonSelectOption>
                  </IonSelect>
                </IonItem>
                
                <IonItem>
                  <IonLabel>下方</IonLabel>
                  <IonSelect 
                    value={quadrantConfig.bottom} 
                    onIonChange={e => handleQuadrantChange('bottom', e.detail.value as RelationshipType)}
                  >
                    <IonSelectOption value={RelationshipType.FATHER}>父节点关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.CHILD}>子节点关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.BASE}>基础关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.BUILD}>构建关系</IonSelectOption>
                  </IonSelect>
                </IonItem>
                
                <IonItem>
                  <IonLabel>左侧</IonLabel>
                  <IonSelect 
                    value={quadrantConfig.left} 
                    onIonChange={e => handleQuadrantChange('left', e.detail.value as RelationshipType)}
                  >
                    <IonSelectOption value={RelationshipType.FATHER}>父节点关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.CHILD}>子节点关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.BASE}>基础关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.BUILD}>构建关系</IonSelectOption>
                  </IonSelect>
                </IonItem>
                
                <IonItem>
                  <IonLabel>右侧</IonLabel>
                  <IonSelect 
                    value={quadrantConfig.right} 
                    onIonChange={e => handleQuadrantChange('right', e.detail.value as RelationshipType)}
                  >
                    <IonSelectOption value={RelationshipType.FATHER}>父节点关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.CHILD}>子节点关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.BASE}>基础关系</IonSelectOption>
                    <IonSelectOption value={RelationshipType.BUILD}>构建关系</IonSelectOption>
                  </IonSelect>
                </IonItem>
              </div>
            </div>
            
            <div className="graph-view-demo-container">
              <GraphView 
                graphData={graphData} 
                centralNodeId={centralNodeId} 
                quadrantConfig={quadrantConfig}
                onNodeClick={handleNodeClick} 
              />
            </div>
          </>
        )}
        
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

export default GraphViewDemo; 