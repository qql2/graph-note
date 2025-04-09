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
  IonCardContent,
  IonRange,
  IonList,
  IonRadioGroup,
  IonRadio,
  IonListHeader,
  IonMenuButton
} from '@ionic/react';
import { refreshOutline, arrowBack } from 'ionicons/icons';
import GraphView from '../components/GraphView';
import { useLocation } from 'react-router-dom';
import { GraphData, GraphNode, GraphEdge, RelationshipType, QuadrantConfig, defaultQuadrantConfig, DepthConfig, defaultDepthConfig, ViewConfig, defaultViewConfig, RelationshipLabelMode } from '../models/GraphNode';
import graphDatabaseService from '../services/graph-database/GraphDatabaseService';
import './GraphViewDemo.css';

// 转换数据库数据到我们的GraphView组件格式
const convertDbDataToGraphData = (
  dbNodes: any[], 
  dbEdges: any[]
): GraphData => {
  console.log('开始数据转换，节点：', dbNodes.length, '边：', dbEdges.length);
  
  // 调试原始数据结构
  if (dbNodes.length > 0) {
    console.log('节点示例：', dbNodes[0]);
  }
  if (dbEdges.length > 0) {
    console.log('边示例：', dbEdges[0]);
  }
  
  const nodes: GraphNode[] = dbNodes.map(dbNode => ({
    id: dbNode.id || '',
    label: dbNode.label || '无标签',
    description: dbNode.properties?.description || '',
    metadata: dbNode.properties || {},
  }));

  const edges: GraphEdge[] = dbEdges.map(dbEdge => {
    // 根据边的类型映射到我们定义的关系类型
    let relationshipType: RelationshipType;
    
    // 调试边类型映射
    console.log('处理边：', dbEdge.id, '类型：', dbEdge.type, 
                '源节点：', dbEdge.source_id || dbEdge.sourceId, 
                '目标节点：', dbEdge.target_id || dbEdge.targetId);
    
    switch ((dbEdge.type || '').toLowerCase()) {
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
        // 默认关系类型，根据数据库中看到的实际类型调整
        console.log('未知边类型:', dbEdge.type, '默认设为BUILD');
        relationshipType = RelationshipType.BUILD;
    }

    // 处理可能不同的字段名
    const sourceId = dbEdge.source_id || dbEdge.sourceId;
    const targetId = dbEdge.target_id || dbEdge.targetId;
    
    return {
      id: dbEdge.id || '',
      source: sourceId,
      target: targetId,
      relationshipType,
      metadata: dbEdge.properties || {},
    };
  });

  console.log('转换完成，GraphNode:', nodes.length, 'GraphEdge:', edges.length);
  return { nodes, edges };
};

const GraphViewDemo: React.FC = () => {
  const location = useLocation();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({nodes: [], edges: []});
  const [centralNodeId, setCentralNodeId] = useState<string>('');
  const [quadrantConfig, setQuadrantConfig] = useState<QuadrantConfig>(defaultQuadrantConfig);
  const [depthConfig, setDepthConfig] = useState<DepthConfig>(defaultDepthConfig);
  const [viewConfig, setViewConfig] = useState<ViewConfig>(defaultViewConfig);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 从URL参数获取节点ID
  const getNodeIdFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('node');
  };

  // 从数据库加载数据
  const loadGraphData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 初始化数据库 - 使用与GraphDBDemo相同的数据库名称
      console.log('正在初始化数据库...');
      await graphDatabaseService.initialize({
        dbName: 'graph_demo', // 改为与GraphDBDemo相同的数据库名称
        version: 1,
        verbose: true
      });
      
      const db = graphDatabaseService.getDatabase();
      
      // 获取所有节点和边
      console.log('正在获取节点和边...');
      const dbNodes = await db.getNodes();
      const dbEdges = await db.getEdges();
      
      console.log('从数据库获取到的节点:', dbNodes.length, dbNodes);
      console.log('从数据库获取到的边:', dbEdges.length, dbEdges);
      
      // 转换数据格式
      const convertedData = convertDbDataToGraphData(dbNodes, dbEdges);
      console.log('转换后的数据:', convertedData);
      setGraphData(convertedData);
      
      // 从URL获取节点ID
      const urlNodeId = getNodeIdFromUrl();
      
      // 优先使用URL中的节点ID，如果存在且在图中
      if (urlNodeId && convertedData.nodes.some(node => node.id === urlNodeId)) {
        setCentralNodeId(urlNodeId);
        console.log('从URL设置中心节点:', urlNodeId);
        setToastMessage(`正在查看节点: ${urlNodeId}`);
        setShowToast(true);
      }
      // 否则如果有节点，则设置第一个节点为中心节点
      else if (convertedData.nodes.length > 0) {
        setCentralNodeId(convertedData.nodes[0].id);
        console.log('设置中心节点:', convertedData.nodes[0].id);
      } else {
        console.log('没有找到节点，无法设置中心节点');
      }
      
    } catch (err) {
      console.error('加载图数据失败:', err);
      setError(`加载数据失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 组件挂载时加载数据
  useEffect(() => {
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
  
  // 处理深度配置更改
  const handleDepthChange = (relationshipType: RelationshipType, value: number) => {
    setDepthConfig({
      ...depthConfig,
      [relationshipType]: value
    });
  };

  // 刷新视图，返回到第一个节点
  const handleReset = () => {
    if (graphData.nodes.length > 0) {
      setCentralNodeId(graphData.nodes[0].id);
    }
  };
  
  // 刷新数据
  const handleRefreshData = () => {
    loadGraphData();
  };
  
  // 处理关系标签显示方式变更
  const handleRelationshipLabelModeChange = (value: RelationshipLabelMode) => {
    setViewConfig({
      ...viewConfig,
      showRelationshipLabels: value
    });
  };

  // 关系类型的中文名称映射
  const relationshipTypeNames = {
    [RelationshipType.FATHER]: '父节点关系',
    [RelationshipType.CHILD]: '子节点关系',
    [RelationshipType.BASE]: '基础关系',
    [RelationshipType.BUILD]: '构建关系'
  };

  // 关系标签模式的中文名称
  const labelModeNames = {
    [RelationshipLabelMode.NONE]: '不显示',
    [RelationshipLabelMode.SIMPLE]: '简洁显示（F/C/Ba/Bu）',
    [RelationshipLabelMode.FULL]: '完整显示（father/child/base/build）'
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
            <IonButton onClick={handleRefreshData} disabled={loading}>
              刷新数据
            </IonButton>
            <IonButton onClick={handleReset} disabled={loading}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
            <IonMenuButton />
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
                <p className="debug-info">请尝试先打开"图数据库演示"页面添加数据，然后再回到此页面。</p>
                <div className="button-group">
                  <IonButton onClick={handleRefreshData}>刷新数据</IonButton>
                  <IonButton routerLink="/graph-demo">前往图数据库演示</IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        ) : graphData.nodes.length === 0 ? (
          <IonCard>
            <IonCardContent>
              <div className="empty-container">
                <p>数据库中没有图数据，请先使用图数据库演示页面添加节点和边。</p>
                <div className="button-group">
                  <IonButton onClick={handleRefreshData}>刷新数据</IonButton>
                  <IonButton routerLink="/graph-demo">前往图数据库演示</IonButton>
                </div>
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
              
              <h4>深度配置</h4>
              <p className="description-text">
                设置每种关系类型的递归深度。例如，父节点深度设为3将显示"父亲的父亲的父亲"，但不会显示父亲的其他类型关系。
                每层节点会按层级排列，如父节点的父节点会显示在父节点的更上方区域。
              </p>
              <div className="depth-config">
                {Object.values(RelationshipType).map(type => (
                  <IonItem key={type}>
                    <IonLabel>
                      {relationshipTypeNames[type]}
                      <p className="relation-description">
                        {type === RelationshipType.FATHER && '递归显示上层父节点（层级越深越靠上）'}
                        {type === RelationshipType.CHILD && '递归显示下层子节点（层级越深越靠下）'}
                        {type === RelationshipType.BASE && '递归显示基础关系节点（层级越深越靠左）'}
                        {type === RelationshipType.BUILD && '递归显示构建关系节点（层级越深越靠右）'}
                      </p>
                    </IonLabel>
                    <div className="depth-slider">
                      <span className="depth-value">{depthConfig[type]}</span>
                      <IonRange
                        min={1}
                        max={5}
                        step={1}
                        snaps={true}
                        value={depthConfig[type]}
                        onIonChange={e => handleDepthChange(type, e.detail.value as number)}
                      />
                    </div>
                  </IonItem>
                ))}
              </div>
              
              <h4>显示设置</h4>
              <div className="view-config">
                <IonList>
                  <IonRadioGroup 
                    value={viewConfig.showRelationshipLabels} 
                    onIonChange={e => handleRelationshipLabelModeChange(e.detail.value)}
                  >
                    <IonListHeader>
                      <IonLabel>关系标签显示方式</IonLabel>
                    </IonListHeader>
                    
                    {Object.values(RelationshipLabelMode).map(mode => (
                      <IonItem key={mode}>
                        <IonLabel>{labelModeNames[mode]}</IonLabel>
                        <IonRadio slot="start" value={mode} />
                      </IonItem>
                    ))}
                  </IonRadioGroup>
                </IonList>
              </div>
            </div>
            
            <div className="graph-view-demo-container">
              <GraphView 
                graphData={graphData} 
                centralNodeId={centralNodeId} 
                quadrantConfig={quadrantConfig}
                depthConfig={depthConfig}
                viewConfig={viewConfig}
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