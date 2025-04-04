import React, { useEffect, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonButton, IonList, IonSpinner,
  IonToast, IonTextarea, IonSelect, IonSelectOption
} from '@ionic/react';
import graphDatabaseService from '../services/graph-database/GraphDatabaseService';
import { GraphNode, GraphEdge, DeleteMode } from '../services/graph-database/core/types';

const GraphDBDemo: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [dbInitialized, setDbInitialized] = useState<boolean>(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' }>({ text: '', type: 'info' });
  const [showToast, setShowToast] = useState<boolean>(false);

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

  // 初始化数据库
  useEffect(() => {
    const initDB = async () => {
      try {
        setLoading(true);
        await graphDatabaseService.initialize({
          dbName: 'graph_demo',
          version: 1,
          verbose: true
        });
        setDbInitialized(true);
        showMessage('数据库初始化成功', 'success');
        await fetchData();
      } catch (error) {
        console.error('初始化数据库失败:', error);
        showMessage(`初始化数据库失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    initDB();

    return () => {
      // 组件卸载时关闭数据库连接
      graphDatabaseService.closeDatabase();
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
      const db = graphDatabaseService.getDatabase();
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
      
		const db = graphDatabaseService.getDatabase();
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
      
      const db = graphDatabaseService.getDatabase();
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
      const db = graphDatabaseService.getDatabase();
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
      const db = graphDatabaseService.getDatabase();
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>图形数据库演示</IonTitle>
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
            onClick={fetchData} 
            disabled={loading || !dbInitialized}
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
                            const db = graphDatabaseService.getDatabase();
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
                            const db = graphDatabaseService.getDatabase();
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
                  </IonRow>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
        
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