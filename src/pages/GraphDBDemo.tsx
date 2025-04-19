import React, { useEffect, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonButton, IonList, IonSpinner,
  IonToast, IonTextarea, IonSelect, IonSelectOption,
  IonButtons,
  IonText,
  IonNote,
  IonBadge,
  IonAlert,
  IonIcon,
  IonMenuButton,
  IonModal,
  IonChip,
  IonCardSubtitle
} from '@ionic/react';
import graphDatabaseService from '../services/graph-database/GraphDatabaseService';
import { GraphNode, GraphEdge, DeleteMode } from '../services/graph-database/core/types';
import { arrowBack, search, eyeOutline, timeOutline, informationCircleOutline, alertCircleOutline } from 'ionicons/icons';

const GraphDBDemo: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [dbInitialized, setDbInitialized] = useState<boolean>(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' }>({ text: '', type: 'info' });
  const [showToast, setShowToast] = useState<boolean>(false);

  // 详情查看状态
  const [showNodeDetail, setShowNodeDetail] = useState<boolean>(false);
  const [showEdgeDetail, setShowEdgeDetail] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [connectedNodes, setConnectedNodes] = useState<GraphNode[]>([]);
  const [relatedEdges, setRelatedEdges] = useState<GraphEdge[]>([]);

  // 节点表单状态
  const [nodeForm, setNodeForm] = useState<{
    type: string;
    label: string;
    properties: string;
  }>({
    type: 'default',
    label: '',
    properties: '{}'
  });

  // 边表单状态
  const [edgeForm, setEdgeForm] = useState<{
    source_id: string;
    target_id: string;
    type: string;
    properties: string;
  }>({
    source_id: '',
    target_id: '',
    type: 'related_to',
    properties: '{}'
  });

  // 自定义关系类型
  const [customType, setCustomType] = useState<string>('');

  // 不完整关系查找状态
  const [incompleteEdges, setIncompleteEdges] = useState<GraphEdge[]>([]);
  const [showIncompleteEdgesModal, setShowIncompleteEdgesModal] = useState<boolean>(false);

  // 初始化数据库
  useEffect(() => {
    // 添加标志，防止组件卸载后仍执行操作
    let isComponentMounted = true;
    
    const initDB = async () => {
      try {
        setLoading(true);
        
        await graphDatabaseService.initialize({
          dbName: 'graph_demo',
          version: 1,
          verbose: true
        }, 'GraphDBDemo');
        
        // 检查数据库是否初始化成功
        if (!graphDatabaseService.isInitialized()) {
          throw new Error('数据库初始化失败，请检查连接状态');
        }
        
        
        
        if (isComponentMounted) {
          setDbInitialized(true);
          showMessage('数据库初始化成功', 'success');
          await fetchData();
        }
      } catch (error) {
        console.error('GraphDBDemo: 初始化数据库失败:', error);
        if (isComponentMounted) {
          showMessage(`初始化数据库失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
      } finally {
        if (isComponentMounted) {
          setLoading(false);
        }
      }
    };

    initDB();

    return () => {
      // 设置组件已卸载标志
      isComponentMounted = false;
      
      // 组件卸载时注销数据库使用
      
      graphDatabaseService.closeDatabase('GraphDBDemo', false).catch(err => {
        console.error('GraphDBDemo组件卸载时注销数据库使用失败:', err);
      });
    };
  }, []);

  // 显示消息
  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setShowToast(true);
  };

  // 获取数据
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 确保数据库已初始化
      if (!graphDatabaseService.isInitialized()) {
        console.warn('数据库未初始化，尝试重新初始化');
        await graphDatabaseService.initialize({
          dbName: 'graph_demo',
          version: 1,
          verbose: true
        }, 'GraphDBDemo');
        
        if (!graphDatabaseService.isInitialized()) {
          throw new Error('数据库初始化失败，请刷新页面重试');
        }
      }
      
      const db = graphDatabaseService.getDatabase('GraphDBDemo');
      
      const fetchedNodes = await db.getNodes();
      const fetchedEdges = await db.getEdges();
      
      
      setNodes(fetchedNodes);
      setEdges(fetchedEdges);
    } catch (error) {
      console.error('获取数据失败:', error);
      showMessage(`获取数据失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // 刷新数据 - 但不强制关闭数据库
  const refreshData = async () => {
    try {
      setLoading(true);
      
      
      // 不关闭数据库，直接重新获取数据
      // 这避免了关闭后重新连接带来的竞态问题
      await fetchData();
      
      showMessage('数据已刷新', 'success');
      
    } catch (error) {
      console.error('刷新数据失败:', error);
      showMessage(`刷新数据失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 添加节点
  const addNode = async () => {
    try {
      setLoading(true);
      let parsedProperties = {};
      
      try {
        parsedProperties = JSON.parse(nodeForm.properties);
      } catch (e) {
        showMessage('属性必须是有效的JSON格式', 'error');
        setLoading(false);
        return;
      }
      
      const node: Omit<GraphNode, 'created_at' | 'updated_at'> = {
        type: nodeForm.type,
        label: nodeForm.label,
        properties: parsedProperties
      };
      
		const db = graphDatabaseService.getDatabase('GraphDBDemo');
		// debugger
      const nodeId = await db.addNode(node);
      
      showMessage(`节点添加成功，ID: ${nodeId}`, 'success');
      await fetchData();
      
      // 重置表单
      setNodeForm({
        type: 'default',
        label: '',
        properties: '{}'
      });
    } catch (error) {
      console.error('添加节点失败:', error);
      showMessage(`添加节点失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 添加边
  const addEdge = async () => {
    try {
      setLoading(true);
      let parsedProperties = {};
      
      try {
        parsedProperties = JSON.parse(edgeForm.properties);
      } catch (e) {
        showMessage('属性必须是有效的JSON格式', 'error');
        setLoading(false);
        return;
      }
      
      const edge: Omit<GraphEdge, 'created_at'> = {
        source_id: edgeForm.source_id,
        target_id: edgeForm.target_id,
        type: edgeForm.type === 'custom' ? customType : edgeForm.type,
        properties: parsedProperties
      };
      
      const db = graphDatabaseService.getDatabase('GraphDBDemo');
      const edgeId = await db.addEdge(edge);
      
      showMessage(`边添加成功，ID: ${edgeId}`, 'success');
      await fetchData();
      
      // 重置表单
      setEdgeForm({
        source_id: '',
        target_id: '',
        type: 'related_to',
        properties: '{}'
      });
      setCustomType('');
    } catch (error) {
      console.error('添加边失败:', error);
      showMessage(`添加边失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 删除节点
  const deleteNode = async (nodeId: string) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase('GraphDBDemo');
      await db.deleteNode(nodeId, DeleteMode.CASCADE);
      showMessage(`节点删除成功，ID: ${nodeId}`, 'success');
      await fetchData();
    } catch (error) {
      console.error('删除节点失败:', error);
      showMessage(`删除节点失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 删除边
  const deleteEdge = async (edgeId: string) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase('GraphDBDemo');
      await db.deleteEdge(edgeId);
      showMessage(`边删除成功，ID: ${edgeId}`, 'success');
      await fetchData();
    } catch (error) {
      console.error('删除边失败:', error);
      showMessage(`删除边失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 处理节点表单变化
  const handleNodeFormChange = (field: string, value: any) => {
    setNodeForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 处理边表单变化
  const handleEdgeFormChange = (field: string, value: any) => {
    setEdgeForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 生成节点选择项
  const renderNodeOptions = () => {
    return nodes.map(node => (
      <IonSelectOption key={node.id} value={node.id}>
        {node.label} ({node.id})
      </IonSelectOption>
    ));
  };

  // 获取节点详情
  const getNodeDetail = async (nodeId: string) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase('GraphDBDemo');
      
      // 获取节点的关联节点
      const connected = await db.findConnectedNodes(nodeId, 1);
      setConnectedNodes(connected);
      
      // 获取与该节点相关的所有边
      const nodeEdges = edges.filter(edge => 
        edge.source_id === nodeId || edge.target_id === nodeId
      );
      setRelatedEdges(nodeEdges);
      
      // 找到选中的节点
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        setShowNodeDetail(true);
      }
    } catch (error) {
      console.error('获取节点详情失败:', error);
      showMessage(`获取节点详情失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 获取边详情
  const getEdgeDetail = async (edgeId: string) => {
    try {
      setLoading(true);
      
      // 找到选中的边
      const edge = edges.find(e => e.id === edgeId);
      if (edge) {
        // 获取源节点和目标节点的详细信息
        const sourceNode = nodes.find(n => n.id === edge.source_id);
        const targetNode = nodes.find(n => n.id === edge.target_id);
        
        setSelectedEdge(edge);
        // 将源节点和目标节点添加到关联节点列表
        setConnectedNodes([
          ...(sourceNode ? [sourceNode] : []),
          ...(targetNode ? [targetNode] : [])
        ]);
        
        setShowEdgeDetail(true);
      }
    } catch (error) {
      console.error('获取边详情失败:', error);
      showMessage(`获取边详情失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: number | string | undefined) => {
    if (!timestamp) return '未知时间';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleString();
  };

  // 格式化属性显示
  const formatProperties = (properties: Record<string, any> | undefined) => {
    if (!properties || Object.keys(properties).length === 0) {
      return "无";
    }
    
    return (
      <div style={{ marginTop: '8px' }}>
        {Object.entries(properties).map(([key, value]) => (
          <IonChip key={key} outline={true}>
            <IonLabel>
              <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </IonLabel>
          </IonChip>
        ))}
      </div>
    );
  };

  // 检查关系是否完整
  const isEdgeComplete = (edge: GraphEdge): boolean => {
    return !!(edge.source_id && edge.target_id && edge.type);
  };
  
  // 查找不完整的关系
  const findIncompleteEdges = () => {
    try {
      setLoading(true);
      
      // 过滤出不完整的边
      const incomplete = edges.filter(edge => !isEdgeComplete(edge));
      
      setIncompleteEdges(incomplete);
      setShowIncompleteEdgesModal(true);
      
      if (incomplete.length === 0) {
        showMessage('没有找到不完整的关系', 'info');
      } else {
        showMessage(`找到 ${incomplete.length} 个不完整的关系`, 'info');
      }
    } catch (error) {
      console.error('查找不完整关系失败:', error);
      showMessage(`查找不完整关系失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 删除不完整关系并刷新列表
  const deleteIncompleteEdge = async (edgeId: string) => {
    try {
      // 先删除边
      await deleteEdge(edgeId);
      
      // 重新查找不完整关系
      // 过滤出不完整的边
      const incomplete = edges.filter(edge => !isEdgeComplete(edge));
      setIncompleteEdges(incomplete);
      
      if (incomplete.length === 0) {
        // 如果没有不完整关系了，关闭模态窗口
        setShowIncompleteEdgesModal(false);
        showMessage('所有不完整关系已清理完毕', 'success');
      } else {
        showMessage(`已删除关系，还剩 ${incomplete.length} 个不完整关系`, 'info');
      }
    } catch (error) {
      console.error('删除不完整关系失败:', error);
      showMessage(`删除不完整关系失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
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
          <IonTitle>图形数据库演示</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">图形数据库演示</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div style={{ padding: '16px' }}>
          <IonButton 
            expand="block" 
            onClick={refreshData} 
            disabled={loading}
          >
            刷新数据
            {loading && <IonSpinner name="crescent" />}
          </IonButton>
        </div>
        
        <IonGrid>
          <IonRow>
            {/* 添加节点区域 */}
            <IonCol size="12" sizeMd="6">
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>添加节点</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem>
                    <IonLabel position="floating">类型</IonLabel>
                    <IonInput
                      value={nodeForm.type}
                      onIonInput={(e) => handleNodeFormChange('type', e.detail.value!)}
                    ></IonInput>
                  </IonItem>
                  <IonItem>
                    <IonLabel position="floating">标签</IonLabel>
                    <IonInput
                      value={nodeForm.label}
                      onIonInput={(e) => handleNodeFormChange('label', e.detail.value!)}
                    ></IonInput>
                  </IonItem>
                  <IonItem>
                    <IonLabel position="floating">属性 (JSON格式)</IonLabel>
                    <IonTextarea
                      value={nodeForm.properties}
                      onIonInput={(e) => handleNodeFormChange('properties', e.detail.value!)}
                      rows={3}
                    ></IonTextarea>
                  </IonItem>
                  <IonButton
                    expand="block"
                    onClick={addNode}
                    disabled={loading || !dbInitialized || !nodeForm.label}
                    style={{ marginTop: '16px' }}
                  >
                    添加节点
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonCol>
            
            {/* 添加边区域 */}
            <IonCol size="12" sizeMd="6">
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>添加边</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem>
                    <IonLabel position="floating">源节点</IonLabel>
                    <IonSelect 
                      value={edgeForm.source_id}
                      onIonChange={(e) => handleEdgeFormChange('source_id', e.detail.value)}
                      interfaceOptions={{
                        header: '选择源节点',
                        cssClass: 'custom-select'
                      }}
                      placeholder="选择源节点"
                    >
                      {renderNodeOptions()}
                    </IonSelect>
                  </IonItem>
                  <IonItem>
                    <IonLabel position="floating">目标节点</IonLabel>
                    <IonSelect 
                      value={edgeForm.target_id}
                      onIonChange={(e) => handleEdgeFormChange('target_id', e.detail.value)}
                      interfaceOptions={{
                        header: '选择目标节点',
                        cssClass: 'custom-select'
                      }}
                      placeholder="选择目标节点"
                    >
                      {renderNodeOptions()}
                    </IonSelect>
                  </IonItem>
                  <IonItem>
                    <IonLabel position="floating">关系类型</IonLabel>
                    <IonSelect 
                      value={edgeForm.type}
                      onIonChange={(e) => handleEdgeFormChange('type', e.detail.value)}
                      interfaceOptions={{
                        header: '选择关系类型',
                        cssClass: 'custom-select'
                      }}
                      placeholder="选择关系类型"
                    >
                      <IonSelectOption value="related_to">关联</IonSelectOption>
                      <IonSelectOption value="belongs_to">属于</IonSelectOption>
                      <IonSelectOption value="contains">包含</IonSelectOption>
                      <IonSelectOption value="depends_on">依赖</IonSelectOption>
                      <IonSelectOption value="father">父亲</IonSelectOption>
                      <IonSelectOption value="child">子女</IonSelectOption>
                      <IonSelectOption value="base">基础</IonSelectOption>
                      <IonSelectOption value="build">构建</IonSelectOption>
                      <IonSelectOption value="mention">提及</IonSelectOption>
                      <IonSelectOption value="mentioned_by">被提及</IonSelectOption>
                      <IonSelectOption value="custom">自定义</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  {edgeForm.type === 'custom' && (
                    <IonItem>
                      <IonLabel position="floating">自定义关系类型</IonLabel>
                      <IonInput
                        value={customType}
                        onIonInput={(e) => setCustomType(e.detail.value!)}
                      ></IonInput>
                    </IonItem>
                  )}
                  <IonItem>
                    <IonLabel position="floating">属性 (JSON格式)</IonLabel>
                    <IonTextarea
                      value={edgeForm.properties}
                      onIonInput={(e) => handleEdgeFormChange('properties', e.detail.value!)}
                      rows={3}
                    ></IonTextarea>
                  </IonItem>
                  <IonButton
                    expand="block"
                    onClick={addEdge}
                    disabled={loading || !dbInitialized || !edgeForm.source_id || !edgeForm.target_id}
                    style={{ marginTop: '16px' }}
                  >
                    添加边
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonCol>
            
            {/* 节点列表 */}
            <IonCol size="12" sizeMd="6">
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>节点列表 ({nodes.length})</IonCardTitle>
                </IonCardHeader>
                <IonCardContent style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {loading && nodes.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                      <IonSpinner />
                    </div>
                  ) : (
                    <IonList>
                      {nodes.map((node) => (
                        <React.Fragment key={node.id}>
                          <IonItem>
                            <IonLabel>
                              <h2>{node.label} ({node.type})</h2>
                              <p>ID: {node.id}</p>
                              <p>属性: {JSON.stringify(node.properties)}</p>
                            </IonLabel>
                            <IonButton
                              slot="end"
                              color="primary"
                              onClick={() => node.id && getNodeDetail(node.id)}
                              disabled={loading}
                            >
                              <IonIcon icon={eyeOutline} slot="icon-only" />
                            </IonButton>
                            <IonButton
                              slot="end"
                              color="danger"
                              onClick={() => node.id && deleteNode(node.id)}
                              disabled={loading}
                            >
                              删除
                            </IonButton>
                          </IonItem>
                        </React.Fragment>
                      ))}
                      {nodes.length === 0 && (
                        <IonItem>
                          <IonLabel>暂无节点数据</IonLabel>
                        </IonItem>
                      )}
                    </IonList>
                  )}
                </IonCardContent>
              </IonCard>
            </IonCol>
            
            {/* 边列表 */}
            <IonCol size="12" sizeMd="6">
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>边列表 ({edges.length})</IonCardTitle>
                </IonCardHeader>
                <IonCardContent style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {loading && edges.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                      <IonSpinner />
                    </div>
                  ) : (
                    <IonList>
                      {edges.map((edge) => (
                        <React.Fragment key={edge.id}>
                          <IonItem>
                            <IonLabel>
                              <h2>{edge.type}</h2>
                              <p>ID: {edge.id}</p>
                              <p>源节点: {edge.source_id}</p>
                              <p>目标节点: {edge.target_id}</p>
                              <p>属性: {JSON.stringify(edge.properties)}</p>
                            </IonLabel>
                            <IonButton
                              slot="end"
                              color="primary"
                              onClick={() => edge.id && getEdgeDetail(edge.id)}
                              disabled={loading}
                            >
                              <IonIcon icon={eyeOutline} slot="icon-only" />
                            </IonButton>
                            <IonButton
                              slot="end"
                              color="danger"
                              onClick={() => edge.id && deleteEdge(edge.id)}
                              disabled={loading}
                            >
                              删除
                            </IonButton>
                          </IonItem>
                        </React.Fragment>
                      ))}
                      {edges.length === 0 && (
                        <IonItem>
                          <IonLabel>暂无边数据</IonLabel>
                        </IonItem>
                      )}
                    </IonList>
                  )}
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* 路径查找 */}
            <IonCol size="12">
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>查找高级功能演示</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonRow>
                    <IonCol size="12" sizeMd="6">
                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={async () => {
                          if (nodes.length < 2) {
                            showMessage('需要至少两个节点才能演示路径查找', 'info');
                            return;
                          }
                          try {
                            setLoading(true);
                            const db = graphDatabaseService.getDatabase('GraphDBDemo');
                            const startId = nodes[0].id;
                            const endId = nodes[nodes.length - 1].id;
                            if (!startId || !endId) return;
                            
                            const path = await db.findPath(startId, endId, 5);
                            showMessage(`找到路径，包含 ${path.length} 条边`, 'info');
                          } catch (error) {
                            console.error('路径查找失败:', error);
                            showMessage(`路径查找失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading || !dbInitialized || nodes.length < 2}
                      >
                        演示路径查找（第一个节点到最后一个节点）
                      </IonButton>
                    </IonCol>
                    <IonCol size="12" sizeMd="6">
                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={async () => {
                          if (nodes.length < 1) {
                            showMessage('需要至少一个节点才能演示关联节点查找', 'info');
                            return;
                          }
                          try {
                            setLoading(true);
                            const db = graphDatabaseService.getDatabase('GraphDBDemo');
                            const nodeId = nodes[0].id;
                            if (!nodeId) return;
                            
                            const connectedNodes = await db.findConnectedNodes(nodeId, 2);
                            showMessage(`找到 ${connectedNodes.length} 个关联节点（深度2）`, 'info');
                          } catch (error) {
                            console.error('关联节点查找失败:', error);
                            showMessage(`关联节点查找失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading || !dbInitialized || nodes.length < 1}
                      >
                        演示关联节点查找（第一个节点，深度2）
                      </IonButton>
                    </IonCol>
                    
                    {/* 查找不完整关系按钮 */}
                    <IonCol size="12" sizeMd="6" className="ion-margin-top">
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="warning"
                        onClick={findIncompleteEdges}
                        disabled={loading || !dbInitialized || edges.length === 0}
                      >
                        <IonIcon icon={alertCircleOutline} slot="start" />
                        查找不完整关系
                      </IonButton>
                    </IonCol>
                  </IonRow>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
        
        {/* 节点详情模态窗口 */}
        <IonModal isOpen={showNodeDetail} onDidDismiss={() => setShowNodeDetail(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>节点详情</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowNodeDetail(false)}>关闭</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            {selectedNode && (
              <div style={{ padding: '16px' }}>
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>{selectedNode.label}</IonCardTitle>
                    <IonCardSubtitle>类型: {selectedNode.type}</IonCardSubtitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonItem lines="none">
                      <IonIcon icon={informationCircleOutline} slot="start" />
                      <IonLabel>
                        <h2>基本信息</h2>
                        <p>ID: {selectedNode.id}</p>
                      </IonLabel>
                    </IonItem>

                    <IonItem lines="none">
                      <IonIcon icon={timeOutline} slot="start" />
                      <IonLabel>
                        <h2>时间信息</h2>
                        <p>创建时间: {selectedNode.created_at ? new Date(selectedNode.created_at).toLocaleString() : '未知时间'}</p>
                        <p>更新时间: {selectedNode.updated_at ? new Date(selectedNode.updated_at).toLocaleString() : '未知时间'}</p>
                      </IonLabel>
                    </IonItem>

                    <IonItem lines="none">
                      <IonLabel>
                        <h2>属性</h2>
                        {formatProperties(selectedNode.properties)}
                      </IonLabel>
                    </IonItem>
                  </IonCardContent>
                </IonCard>

                {/* 关联节点 */}
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>关联节点 ({connectedNodes.length})</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {connectedNodes.length > 0 ? (
                      <IonList>
                        {connectedNodes.map(node => (
                          <IonItem key={node.id}>
                            <IonLabel>
                              <h2>{node.label} ({node.type})</h2>
                              <p>ID: {node.id}</p>
                            </IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    ) : (
                      <IonItem>
                        <IonLabel>没有关联节点</IonLabel>
                      </IonItem>
                    )}
                  </IonCardContent>
                </IonCard>

                {/* 相关边 */}
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>相关关系 ({relatedEdges.length})</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {relatedEdges.length > 0 ? (
                      <IonList>
                        {relatedEdges.map(edge => (
                          <IonItem key={edge.id}>
                            <IonLabel>
                              <h2>{edge.type}</h2>
                              <p>从: {nodes.find(n => n.id === edge.source_id)?.label || edge.source_id}</p>
                              <p>到: {nodes.find(n => n.id === edge.target_id)?.label || edge.target_id}</p>
                            </IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    ) : (
                      <IonItem>
                        <IonLabel>没有相关关系</IonLabel>
                      </IonItem>
                    )}
                  </IonCardContent>
                </IonCard>
              </div>
            )}
          </IonContent>
        </IonModal>

        {/* 边详情模态窗口 */}
        <IonModal isOpen={showEdgeDetail} onDidDismiss={() => setShowEdgeDetail(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>关系详情</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowEdgeDetail(false)}>关闭</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            {selectedEdge && (
              <div style={{ padding: '16px' }}>
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>{selectedEdge.type}</IonCardTitle>
                    <IonCardSubtitle>关系类型</IonCardSubtitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonItem lines="none">
                      <IonIcon icon={informationCircleOutline} slot="start" />
                      <IonLabel>
                        <h2>基本信息</h2>
                        <p>ID: {selectedEdge.id}</p>
                        <p>源节点ID: {selectedEdge.source_id}</p>
                        <p>目标节点ID: {selectedEdge.target_id}</p>
                      </IonLabel>
                    </IonItem>

                    <IonItem lines="none">
                      <IonIcon icon={timeOutline} slot="start" />
                      <IonLabel>
                        <h2>时间信息</h2>
                        <p>创建时间: {selectedEdge.created_at ? new Date(selectedEdge.created_at).toLocaleString() : '未知时间'}</p>
                      </IonLabel>
                    </IonItem>

                    <IonItem lines="none">
                      <IonLabel>
                        <h2>属性</h2>
                        {formatProperties(selectedEdge.properties)}
                      </IonLabel>
                    </IonItem>
                  </IonCardContent>
                </IonCard>

                {/* 相关节点 */}
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>关联节点</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {connectedNodes.length > 0 ? (
                      <IonList>
                        {connectedNodes.map(node => (
                          <IonItem key={node.id}>
                            <IonLabel>
                              <h2>{node.label} ({node.type})</h2>
                              <p>ID: {node.id}</p>
                              <p>角色: {node.id === selectedEdge.source_id ? '源节点' : '目标节点'}</p>
                            </IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    ) : (
                      <IonItem>
                        <IonLabel>没有找到关联节点</IonLabel>
                      </IonItem>
                    )}
                  </IonCardContent>
                </IonCard>
              </div>
            )}
          </IonContent>
        </IonModal>
        
        {/* 不完整关系模态窗口 */}
        <IonModal isOpen={showIncompleteEdgesModal} onDidDismiss={() => setShowIncompleteEdgesModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>不完整关系列表</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowIncompleteEdgesModal(false)}>关闭</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <div style={{ padding: '16px' }}>
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>不完整关系 ({incompleteEdges.length})</IonCardTitle>
                  <IonCardSubtitle>缺少source_id、target_id或type字段的关系</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  {incompleteEdges.length > 0 ? (
                    <IonList>
                      {incompleteEdges.map(edge => (
                        <IonItem key={edge.id}>
                          <IonLabel>
                            <h2>ID: {edge.id}</h2>
                            <p>类型: {edge.type || <IonText color="danger">缺失</IonText>}</p>
                            <p>源节点: {edge.source_id || <IonText color="danger">缺失</IonText>}</p>
                            <p>目标节点: {edge.target_id || <IonText color="danger">缺失</IonText>}</p>
                            <p>缺少字段: {[
                              !edge.source_id && '源节点ID',
                              !edge.target_id && '目标节点ID',
                              !edge.type && '关系类型'
                            ].filter(Boolean).join(', ')}</p>
                          </IonLabel>
                          <IonButton
                            slot="end"
                            color="danger"
                            onClick={() => edge.id && deleteIncompleteEdge(edge.id)}
                            disabled={loading}
                          >
                            删除
                          </IonButton>
                        </IonItem>
                      ))}
                    </IonList>
                  ) : (
                    <IonItem>
                      <IonLabel>没有找到不完整的关系</IonLabel>
                    </IonItem>
                  )}
                </IonCardContent>
              </IonCard>
            </div>
          </IonContent>
        </IonModal>
        
        {/* 消息提示 */}
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={message.text}
          duration={5000}
          color={message.type === 'success' ? 'success' : message.type === 'error' ? 'danger' : 'primary'}
        />
        
        {/* 加载指示器 */}
        {loading && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
          }}>
            <IonSpinner name="crescent" />
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default GraphDBDemo; 