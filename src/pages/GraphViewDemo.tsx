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
  IonMenuButton,
  IonAlert
} from '@ionic/react';
import { refreshOutline, arrowBack, save, refresh } from 'ionicons/icons';
import GraphView from '../components/GraphView';
import { useLocation } from 'react-router-dom';
import { GraphData, GraphNode, GraphEdge, CommonRelationshipTypes, QuadrantConfig, defaultQuadrantConfig, DepthConfig, defaultDepthConfig, ViewConfig, defaultViewConfig, RelationshipLabelMode, QuadrantPosition } from '../models/GraphNode';
import graphDatabaseService from '../services/graph-database/GraphDatabaseService';
import { ConfigService } from '../services/ConfigService';
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
    // 调试边类型映射
    console.log('处理边：', dbEdge.id, '类型：', dbEdge.type, 
                '源节点：', dbEdge.source_id || dbEdge.sourceId, 
                '目标节点：', dbEdge.target_id || dbEdge.targetId);
    
    // 处理可能不同的字段名
    const sourceId = dbEdge.source_id || dbEdge.sourceId;
    const targetId = dbEdge.target_id || dbEdge.targetId;
    
    // 直接使用数据库中的关系类型，默认为'build'
    const relationshipType = (dbEdge.type || 'build').toLowerCase();
    
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
  const [quadrantConfig, setQuadrantConfig] = useState<QuadrantConfig>(ConfigService.loadQuadrantConfig());
  const [depthConfig, setDepthConfig] = useState<DepthConfig>(ConfigService.loadDepthConfig());
  const [viewConfig, setViewConfig] = useState<ViewConfig>(ConfigService.loadViewConfig());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // 导航栏高度 - Ionic 默认为 56px，但可以根据实际情况调整
  const navbarHeight = 56;
  
  // 弹窗状态
  const [showAlert, setShowAlert] = useState(false);
  const [alertHeader, setAlertHeader] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmHandler, setConfirmHandler] = useState<() => void>(() => {});

  // 存储已知的所有关系类型
  const [knownRelationshipTypes, setKnownRelationshipTypes] = useState<string[]>([
    CommonRelationshipTypes.FATHER,
    CommonRelationshipTypes.CHILD,
    CommonRelationshipTypes.BASE,
    CommonRelationshipTypes.BUILD
  ]);

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
      
      // 收集所有关系类型
      updateKnownRelationshipTypes(convertedData.edges);
      
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

  // 显示确认对话框
  const showConfirmDialog = (header: string, message: string, onConfirm: () => void) => {
    setAlertHeader(header);
    setAlertMessage(message);
    setConfirmHandler(() => onConfirm);
    setShowAlert(true);
  };

  // 处理编辑节点
  const handleEditNode = async (nodeId: string, newLabel: string) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase();
      
      // 更新节点
      await db.updateNode(nodeId, { label: newLabel });
      
      setToastMessage(`节点已更新: ${newLabel}`);
      setShowToast(true);
      
      // 重新加载数据
      await loadGraphData();
    } catch (error) {
      console.error('编辑节点失败:', error);
      setToastMessage(`编辑节点失败: ${error instanceof Error ? error.message : String(error)}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // 处理删除节点
  const handleDeleteNode = async (nodeId: string) => {
    showConfirmDialog(
      '确认删除',
      '确定要删除此节点吗？这也将删除所有与此节点相关的关系。',
      async () => {
        try {
          setLoading(true);
          const db = graphDatabaseService.getDatabase();
          
          // 删除节点
          await db.deleteNode(nodeId);
          
          setToastMessage('节点已删除');
          setShowToast(true);
          
          // 如果删除的是当前中心节点，重置中心节点
          if (nodeId === centralNodeId) {
            // 重新加载数据后设置新的中心节点
            await loadGraphData();
          } else {
            // 否则只重新加载数据
            await loadGraphData();
          }
        } catch (error) {
          console.error('删除节点失败:', error);
          setToastMessage(`删除节点失败: ${error instanceof Error ? error.message : String(error)}`);
          setShowToast(true);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // 处理编辑关系
  const handleEditEdge = async (edgeId: string, newLabel: string) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase();
      
      // 更新边
      await db.updateEdge(edgeId, { type: newLabel });
      
      setToastMessage(`关系已更新: ${newLabel}`);
      setShowToast(true);
      
      // 重新加载数据
      await loadGraphData();
    } catch (error) {
      console.error('编辑关系失败:', error);
      setToastMessage(`编辑关系失败: ${error instanceof Error ? error.message : String(error)}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // 处理删除关系
  const handleDeleteEdge = async (edgeId: string) => {
    showConfirmDialog(
      '确认删除',
      '确定要删除此关系吗？',
      async () => {
        try {
          setLoading(true);
          const db = graphDatabaseService.getDatabase();
          
          // 删除边
          await db.deleteEdge(edgeId);
          
          setToastMessage('关系已删除');
          setShowToast(true);
          
          // 重新加载数据
          await loadGraphData();
        } catch (error) {
          console.error('删除关系失败:', error);
          setToastMessage(`删除关系失败: ${error instanceof Error ? error.message : String(error)}`);
          setShowToast(true);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // 处理创建关系
  const handleCreateRelation = async (sourceNodeId: string, relationType: string) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase();
      
      // 检查是否需要创建自定义关系
      let actualRelationType = relationType;
      let isCustomType = false;
      
      // 如果用户选择了自定义关系（通过菜单时实际传的是build）
      if (relationType === CommonRelationshipTypes.BUILD) {
        const customType = prompt('请输入自定义关系类型名称:');
        if (customType && customType.trim() !== '') {
          actualRelationType = customType.trim();
          isCustomType = true;
        }
      }
      
      // 创建新节点
      const newNodeId = await db.addNode({
        type: 'knowledge',
        label: `新${isCustomType ? actualRelationType : relationType}节点`,
        properties: {
          created_at: new Date().toISOString(),
          description: `从节点 ${sourceNodeId} 创建的 ${isCustomType ? actualRelationType : relationType} 关系节点`
        }
      });
      
      // 创建边
      await db.addEdge({
        source_id: sourceNodeId,
        target_id: newNodeId,
        type: actualRelationType,
        properties: {
          created_at: new Date().toISOString()
        }
      });
      
      setToastMessage(`已创建 ${isCustomType ? actualRelationType : relationType} 关系和新节点`);
      setShowToast(true);
      
      // 更新已知关系类型列表
      if (isCustomType && !knownRelationshipTypes.includes(actualRelationType)) {
        setKnownRelationshipTypes([...knownRelationshipTypes, actualRelationType]);
      }
      
      // 重新加载数据
      await loadGraphData();
      
      // 将新节点设为中心节点
      setCentralNodeId(newNodeId);
    } catch (error) {
      console.error('创建关系失败:', error);
      setToastMessage(`创建关系失败: ${error instanceof Error ? error.message : String(error)}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // 处理关系组配置更改
  const handleQuadrantChange = (position: QuadrantPosition, value: string[]) => {
    const newConfig = {
      ...quadrantConfig,
      [position]: value
    };
    setQuadrantConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveQuadrantConfig(newConfig);
  };
  
  // 处理深度配置更改
  const handleDepthChange = (relationshipType: string, value: number) => {
    const newConfig = {
      ...depthConfig,
      [relationshipType]: value
    };
    setDepthConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveDepthConfig(newConfig);
  };

  // 加载数据时，更新已知的关系类型列表
  const updateKnownRelationshipTypes = (edges: GraphEdge[]) => {
    const relationshipTypes = new Set<string>(knownRelationshipTypes);
    
    edges.forEach(edge => {
      if (edge.relationshipType) {
        relationshipTypes.add(edge.relationshipType);
      }
    });
    
    // 更新为已知关系类型列表
    setKnownRelationshipTypes(Array.from(relationshipTypes));
  };

  // 加载数据时调用此函数
  useEffect(() => {
    if (graphData.edges.length > 0) {
      updateKnownRelationshipTypes(graphData.edges);
    }
  }, [graphData]);

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
    const newConfig = {
      ...viewConfig,
      showRelationshipLabels: value
    };
    setViewConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveViewConfig(newConfig);
  };

  // 关系类型的中文名称映射
  const getRelationshipTypeName = (type: string) => {
    switch (type) {
      case CommonRelationshipTypes.FATHER:
        return '父节点关系';
      case CommonRelationshipTypes.CHILD:
        return '子节点关系';
      case CommonRelationshipTypes.BASE:
        return '基础关系';
      case CommonRelationshipTypes.BUILD:
        return '构建关系';
      default:
        return `自定义关系: ${type}`;
    }
  };

  // 关系标签模式的中文名称
  const labelModeNames = {
    [RelationshipLabelMode.NONE]: '不显示',
    [RelationshipLabelMode.SIMPLE]: '简洁显示（首字母）',
    [RelationshipLabelMode.FULL]: '完整显示'
  };

  // 处理未分配关系类型显示位置更改
  const handleUnconfiguredPositionChange = (position: QuadrantPosition) => {
    const newConfig = {
      ...quadrantConfig,
      unconfiguredTypesPosition: position
    };
    setQuadrantConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveQuadrantConfig(newConfig);
  };

  // 重置所有配置到默认值
  const handleResetAllConfigs = () => {
    showConfirmDialog(
      '重置所有配置',
      '确定要将所有配置重置为默认值吗？这将丢失您的自定义设置。',
      () => {
        // 重置配置
        ConfigService.resetAllConfigs();
        // 应用默认配置
        setQuadrantConfig({ ...defaultQuadrantConfig });
        setDepthConfig({ ...defaultDepthConfig });
        setViewConfig({ ...defaultViewConfig });
        // 显示提示
        setToastMessage('所有配置已重置为默认值');
        setShowToast(true);
      }
    );
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
            <IonButton onClick={handleResetAllConfigs} title="重置所有配置" className="reset-config-button">
              <IonIcon icon={refresh} />
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
              <h4>关系组配置</h4>
              <div className="quadrant-config">
                <IonItem>
                  <IonLabel>上方关系组</IonLabel>
                  <IonSelect 
                    value={quadrantConfig[QuadrantPosition.TOP]} 
                    onIonChange={e => handleQuadrantChange(QuadrantPosition.TOP, e.detail.value as string[])}
                    multiple={true}
                    placeholder="选择上方关系类型"
                  >
                    {knownRelationshipTypes.map(type => (
                      <IonSelectOption key={type} value={type}>
                        {getRelationshipTypeName(type)}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                
                <IonItem>
                  <IonLabel>下方关系组</IonLabel>
                  <IonSelect 
                    value={quadrantConfig[QuadrantPosition.BOTTOM]} 
                    onIonChange={e => handleQuadrantChange(QuadrantPosition.BOTTOM, e.detail.value as string[])}
                    multiple={true}
                    placeholder="选择下方关系类型"
                  >
                    {knownRelationshipTypes.map(type => (
                      <IonSelectOption key={type} value={type}>
                        {getRelationshipTypeName(type)}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                
                <IonItem>
                  <IonLabel>左侧关系组</IonLabel>
                  <IonSelect 
                    value={quadrantConfig[QuadrantPosition.LEFT]} 
                    onIonChange={e => handleQuadrantChange(QuadrantPosition.LEFT, e.detail.value as string[])}
                    multiple={true}
                    placeholder="选择左侧关系类型"
                  >
                    {knownRelationshipTypes.map(type => (
                      <IonSelectOption key={type} value={type}>
                        {getRelationshipTypeName(type)}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                
                <IonItem>
                  <IonLabel>右侧关系组</IonLabel>
                  <IonSelect 
                    value={quadrantConfig[QuadrantPosition.RIGHT]} 
                    onIonChange={e => handleQuadrantChange(QuadrantPosition.RIGHT, e.detail.value as string[])}
                    multiple={true}
                    placeholder="选择右侧关系类型"
                  >
                    {knownRelationshipTypes.map(type => (
                      <IonSelectOption key={type} value={type}>
                        {getRelationshipTypeName(type)}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                
                <IonItem>
                  <IonLabel>未分配关系类型显示位置</IonLabel>
                  <IonSelect 
                    value={quadrantConfig.unconfiguredTypesPosition} 
                    onIonChange={e => handleUnconfiguredPositionChange(e.detail.value as QuadrantPosition)}
                    placeholder="选择未分配关系类型的显示位置"
                  >
                    <IonSelectOption value={QuadrantPosition.TOP}>上方关系组</IonSelectOption>
                    <IonSelectOption value={QuadrantPosition.BOTTOM}>下方关系组</IonSelectOption>
                    <IonSelectOption value={QuadrantPosition.LEFT}>左侧关系组</IonSelectOption>
                    <IonSelectOption value={QuadrantPosition.RIGHT}>右侧关系组</IonSelectOption>
                  </IonSelect>
                </IonItem>
                
                <p className="description-text">
                  注意：每个关系组可以包含多种关系类型。未分配到任何关系组的关系类型将会显示在指定的未分配关系组位置，若未指定则自动分配到未被配置的关系组中。
                </p>
              </div>
              
              <h4>深度配置</h4>
              <p className="description-text">
                设置每种关系类型的递归深度。例如，父节点深度设为3将显示"父亲的父亲的父亲"，但不会显示父亲的其他类型关系。
                每层节点会按层级排列，如父节点的父节点会显示在父节点的更上方区域。
              </p>
              <div className="depth-config">
                {knownRelationshipTypes.map(type => (
                  <IonItem key={type}>
                    <IonLabel>
                      {getRelationshipTypeName(type)}
                      <p className="relation-description">
                        {type === CommonRelationshipTypes.FATHER && '递归显示上层父节点（层级越深越靠上）'}
                        {type === CommonRelationshipTypes.CHILD && '递归显示下层子节点（层级越深越靠下）'}
                        {type === CommonRelationshipTypes.BASE && '递归显示基础关系节点（层级越深越靠左）'}
                        {type === CommonRelationshipTypes.BUILD && '递归显示构建关系节点（层级越深越靠右）'}
                        {![CommonRelationshipTypes.FATHER, CommonRelationshipTypes.CHILD, 
                           CommonRelationshipTypes.BASE, CommonRelationshipTypes.BUILD].includes(type) && 
                           '递归显示自定义关系节点（根据所在关系组决定位置）'}
                      </p>
                    </IonLabel>
                    <div className="depth-slider">
                      <span className="depth-value">{depthConfig[type] || 3}</span>
                      <IonRange
                        min={1}
                        max={5}
                        step={1}
                        snaps={true}
                        value={depthConfig[type] || 3}
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
              
              <div className="config-actions">
                <p className="config-note">所有配置已自动保存</p>
                <IonButton 
                  size="small" 
                  fill="clear" 
                  className="reset-config-button"
                  onClick={handleResetAllConfigs}
                >
                  重置所有配置
                </IonButton>
              </div>
            </div>
            
            <div className="graph-view-demo-container">
              <GraphView 
                graphData={graphData} 
                centralNodeId={centralNodeId} 
                quadrantConfig={quadrantConfig}
                depthConfig={depthConfig}
                viewConfig={viewConfig}
                navbarHeight={navbarHeight}
                onNodeClick={handleNodeClick}
                onEditNode={handleEditNode}
                onDeleteNode={handleDeleteNode}
                onEditEdge={handleEditEdge}
                onDeleteEdge={handleDeleteEdge}
                onCreateRelation={handleCreateRelation}
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
        
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertHeader}
          message={alertMessage}
          buttons={[
            {
              text: '取消',
              role: 'cancel',
              handler: () => setShowAlert(false)
            },
            {
              text: '确认',
              handler: () => {
                confirmHandler();
                setShowAlert(false);
              }
            }
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default GraphViewDemo; 