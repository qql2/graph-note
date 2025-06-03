import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { refreshOutline, arrowBack, save, refresh, bookmarkOutline, settings } from 'ionicons/icons';
import GraphView from '../components/GraphView';
import RelationshipConfig from '../components/RelationshipConfig';
import SettingsModal from '../components/SettingsModal';
import ThemeToggle from '../components/ThemeToggle';
import { useLocation, useHistory } from 'react-router-dom';
import { GraphData, GraphNode, GraphEdge, CommonRelationshipTypes, QuadrantConfig, defaultQuadrantConfig, DepthConfig, defaultDepthConfig, ViewConfig, defaultViewConfig, RelationshipLabelMode, QuadrantPosition, RelationshipTypeConfig, defaultRelationshipTypeConfig } from '../models/GraphNode';
import graphDatabaseService from '../services/graph-database/GraphDatabaseService';
import { ConfigService } from '../services/ConfigService';
import './GraphViewDemo.css';
import { DATA_IMPORT_SUCCESS_EVENT } from '../App';
import { DeleteMode } from '../services/graph-database';

// 转换数据库数据到我们的GraphView组件格式
const convertDbDataToGraphData = (
  dbNodes: any[], 
  dbEdges: any[]
): GraphData => {
  ;
  
  // 调试原始数据结构
  if (dbNodes.length > 0) {
    ;
  }
  if (dbEdges.length > 0) {
    ;
  }
  
  const nodes: GraphNode[] = dbNodes.map(dbNode => ({
    id: dbNode.id || '',
    label: dbNode.label || '无标签',
    description: dbNode.properties?.description || '',
    metadata: dbNode.properties || {},
    is_independent: dbNode.is_independent
  }));

  const edges: GraphEdge[] = dbEdges.map(dbEdge => {
    // 调试边类型映射
    
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

  ;
  return { nodes, edges };
};

const GraphViewDemo: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const [graphDataState, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [centralNodeIdState, setCentralNodeId] = useState<string>('');
  const [isLoadingState, setLoading] = useState<boolean>(false);
  const [showToastState, setShowToast] = useState<boolean>(false);
  const [toastMessageState, setToastMessage] = useState<string>('');
  const [knownRelationshipTypesState, setKnownRelationshipTypes] = useState<string[]>([]);
  const [quadrantConfigState, setQuadrantConfig] = useState<QuadrantConfig>(ConfigService.loadQuadrantConfig() || defaultQuadrantConfig);
  const [depthConfigState, setDepthConfig] = useState<DepthConfig>(ConfigService.loadDepthConfig() || defaultDepthConfig);
  const [viewConfigState, setViewConfig] = useState<ViewConfig>(ConfigService.loadViewConfig() || defaultViewConfig);
  const loadedQuadrantConfigState = ConfigService.loadQuadrantConfig();
  const [relationshipTypeConfigState, setRelationshipTypeConfig] = useState<RelationshipTypeConfig>(
    loadedQuadrantConfigState?.relationshipTypeConfig || defaultRelationshipTypeConfig
  );
  const isDatabaseReady = useRef<boolean>(false);
  const pendingChanges = useRef<boolean>(false);
  const newNodeId = useRef<string>('');
  const [errorState, setError] = useState<string | null>(null);
  const [showAlertState, setShowAlert] = useState(false);
  const [alertHeaderState, setAlertHeader] = useState('');
  const [alertMessageState, setAlertMessage] = useState('');
  const [confirmHandlerState, setConfirmHandler] = useState<() => void>(() => {});
  const [showSettingsModalState, setShowSettingsModal] = useState(false);
  const [dbStatusModalOpenState, setDbStatusModalOpen] = useState(false);
  const [dbStatusState, setDbStatus] = useState<any>(null);
  const [transactionResultModalOpenState, setTransactionResultModalOpen] = useState(false);
  const [transactionResultState, setTransactionResult] = useState<any>(null);
  const [navbarHeightState, setNavbarHeight] = useState(56);

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
      
      await graphDatabaseService.initialize({
        dbName: 'graph_demo', // 改为与GraphDBDemo相同的数据库名称
        version: 1,
        verbose: true
      }, 'GraphViewDemo');
      
      // 检查数据库是否已初始化
      if (!graphDatabaseService.isInitialized()) {
        console.error('[GraphViewDemo] 数据库初始化失败');
        throw new Error('数据库初始化失败，请检查连接状态');
      }
      
      
      const db = graphDatabaseService.getDatabase('GraphViewDemo');
      
      // 获取所有节点和边
      
      const dbNodes = await db.getNodes();
      const dbEdges = await db.getEdges();
      
      
      // 转换数据格式
      const convertedData = convertDbDataToGraphData(dbNodes, dbEdges);
      setGraphData(convertedData);
      
      // 收集所有关系类型
      updateKnownRelationshipTypes(convertedData.edges);
      
      // 尝试获取上次保存的节点ID
      const savedNodeId = ConfigService.loadCentralNodeId();
      
      // 从URL获取节点ID和新节点标记
      const urlParams = new URLSearchParams(location.search);
      const urlNodeId = urlParams.get('node');
      const isNewNode = urlParams.get('new') === 'true';
      
      
      // 优先级顺序: URL参数 > 上次保存的节点 > 第一个节点
      if (urlNodeId && convertedData.nodes.some(node => node.id === urlNodeId)) {
        // 如果URL中指定了节点，并且该节点存在于图中
        
        setCentralNodeId(urlNodeId);
        // 同时更新保存的节点ID，以便下次访问
        ConfigService.saveCentralNodeId(urlNodeId);
        
        // 如果是通过URL参数标记的新节点，应用动效
        if (isNewNode) {
          newNodeId.current = urlNodeId;
          // 设置定时器，5秒后清除新节点标记
          setTimeout(() => {
            newNodeId.current = '';
          }, 5000);
        }
        
        setToastMessage(`正在查看节点: ${urlNodeId}`);
        setShowToast(true);
      } 
      else if (savedNodeId && convertedData.nodes.some(node => node.id === savedNodeId)) {
        // 否则尝试恢复上次查看的节点
        
        setCentralNodeId(savedNodeId);
        setToastMessage(`继续查看节点: ${savedNodeId}`);
        setShowToast(true);
      }
      else if (convertedData.nodes.length > 0) {
        // 如果没有保存的节点或者保存的节点不存在，则使用第一个节点
        const firstNodeId = convertedData.nodes[0].id;
        
        setCentralNodeId(firstNodeId);
        ConfigService.saveCentralNodeId(firstNodeId);
      } else {
        
      }
      
    } catch (err) {
      console.error('[GraphViewDemo] 加载图数据失败:', err);
      setError(`加载数据失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 组件挂载时加载数据，并添加导入数据成功的事件监听
  useEffect(() => {
    // 添加标志，防止组件卸载后仍执行操作
    let isComponentMounted = true;
    
    // 组件挂载时加载数据
    
    const loadDataAndInitDb = async () => {
      try {
        
        await loadGraphData();
        
      } catch (err) {
        console.error('GraphViewDemo组件挂载时加载数据失败:', err);
        if (isComponentMounted) {
          setError(`初始化失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    };
    
    loadDataAndInitDb();
    
    // 添加导入数据成功事件的监听器
    const handleImportSuccess = () => {
      
      loadGraphData().catch(err => {
        console.error('数据导入成功后刷新数据失败:', err);
        if (isComponentMounted) {
          setError(`刷新数据失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    };

    // 添加检查数据库状态事件的监听器
    const handleCheckDbStatusEvent = () => {
      
      handleCheckDbStatus().catch(err => {
        console.error('[GraphViewDemo] 检查数据库状态失败:', err);
        if (isComponentMounted) {
          setError(`检查数据库状态失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    };
    
    // 添加手动提交事务事件的监听器
    const handleCommitTransactionEvent = () => {
      
      handleCommitTransaction().catch(err => {
        console.error('[GraphViewDemo] 手动提交事务失败:', err);
        if (isComponentMounted) {
          setError(`手动提交事务失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    };
    
    // 注册事件监听器
    window.addEventListener(DATA_IMPORT_SUCCESS_EVENT, handleImportSuccess);
    window.addEventListener('check-db-status-event', handleCheckDbStatusEvent);
    window.addEventListener('commit-transaction-event', handleCommitTransactionEvent);
    
    // 组件卸载时注销数据库使用和事件监听器
    return () => {
      
      isComponentMounted = false;
      
      // 移除事件监听器
      window.removeEventListener(DATA_IMPORT_SUCCESS_EVENT, handleImportSuccess);
      window.removeEventListener('check-db-status-event', handleCheckDbStatusEvent);
      window.removeEventListener('commit-transaction-event', handleCommitTransactionEvent);
      // 确保安全地注销数据库，但不强制关闭
      graphDatabaseService.closeDatabase('GraphViewDemo', false)
        .catch(err => {
          console.error('GraphViewDemo组件卸载时注销数据库使用失败:', err);
        });
    };
  }, []);

  // 刷新数据按钮处理函数
  const handleRefreshData = async () => {
    try {
      setLoading(true);
      
      
      // 不关闭数据库，而是直接重新加载数据
      // 这避免了关闭/打开数据库的竞态条件
      await loadGraphData();
      
      setToastMessage('数据已刷新');
      setShowToast(true);
      
    } catch (err) {
      console.error('刷新数据失败:', err);
      setError(`刷新数据失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // 处理节点点击，改变中心节点
  const handleNodeClick = useCallback((nodeId: string) => {
    setCentralNodeId(nodeId);
    ConfigService.saveCentralNodeId(nodeId);
    setToastMessage(`正在查看节点: ${nodeId}`);
    setShowToast(true);
    // 更新url参数但不刷新页面
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('node', nodeId);
    // 保留其他参数
    history.replace({ search: searchParams.toString() });
  }, [location.search, history]);

  // 显示确认对话框
  const showConfirmDialog = (header: string, message: string, onConfirm: () => void) => {
    setAlertHeader(header);
    setAlertMessage(message);
    setConfirmHandler(() => onConfirm);
    setShowAlert(true);
  };

  // 处理编辑节点
  const handleEditNode = useCallback(async (nodeId: string, newLabel: string) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase('GraphViewDemo');
      
      // 检查是否为节点合并操作 (格式: MERGE:targetNodeId)
      if (newLabel.startsWith('MERGE:')) {
        const targetNodeId = newLabel.substring(6); // 提取目标节点ID
        
        // 使用新的 moveRelationships API 来正确处理结构化关系和普通关系
        await db.moveRelationships(nodeId, targetNodeId);
        
        // 删除源节点
        await db.deleteNode(nodeId);
        
        setToastMessage(`节点已合并到目标节点`);
        setShowToast(true);
        
        // 如果当前中心节点是被合并的节点，更新中心节点为目标节点
        if (nodeId === centralNodeIdState) {
          setCentralNodeId(targetNodeId);
          ConfigService.saveCentralNodeId(targetNodeId);
        }
      } else {
        // 常规节点编辑
        await db.updateNode(nodeId, { label: newLabel });
        
        setToastMessage(`节点已更新: ${newLabel}`);
        setShowToast(true);
      }
      
      // 重新加载数据
      await loadGraphData();
    } catch (error) {
      console.error('编辑节点失败:', error);
      setToastMessage(`编辑节点失败: ${error instanceof Error ? error.message : String(error)}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // 处理删除节点
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    showConfirmDialog(
      '确认删除',
      '确定要删除此节点吗？这也将删除所有与此节点相关的关系。',
      async () => {
        try {
          setLoading(true);
          const db = graphDatabaseService.getDatabase('GraphViewDemo');
          
          // 删除节点
          await db.deleteNode(nodeId,DeleteMode.CASCADE);
          
          setToastMessage('节点已删除');
          setShowToast(true);
          
          // 如果删除的是当前中心节点，重置中心节点
          if (nodeId === centralNodeIdState) {
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
  }, []);

  // 处理编辑关系
  const handleEditEdge = useCallback(async (edgeId: string, newLabel: string, isSimpleLabel?: boolean) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase('GraphViewDemo');
      
      // 根据标签模式更新不同的属性
      if (isSimpleLabel === true) {
        // 更新边的 properties.shortLabel 属性
        await db.updateEdge(edgeId, { 
          properties: { 
            shortLabel: newLabel 
          } 
        });
        setToastMessage(`关系标签已更新: ${newLabel}`);
      } else {
        // 更新边的类型属性
        await db.updateEdge(edgeId, { type: newLabel });
        setToastMessage(`关系类型已更新: ${newLabel}`);
      }
      
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
  }, []);

  // 处理删除关系
  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    showConfirmDialog(
      '确认删除',
      '确定要删除此关系吗？',
      async () => {
        try {
          setLoading(true);
          const db = graphDatabaseService.getDatabase('GraphViewDemo');
          
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
  }, []);

  const handleConvertToStructuredRelationship = useCallback(async (edgeId: string, newLabel?: string) => {
    showConfirmDialog(
      '确认转换',
      `确定要将此关系转换为结构化关系吗？原始关系将被删除。${newLabel ? `新关系标签为: ${newLabel}` : '将使用默认标签。'}`,
      async () => {
        try {
          setLoading(true);
          const db = graphDatabaseService.getDatabase('GraphViewDemo');
          
          const newRelNodeId = await db.convertToStructuredRelationship(edgeId, newLabel);
          
          setToastMessage(`关系 ${edgeId} 已成功转换为结构化关系 (新ID: ${newRelNodeId})`);
          setShowToast(true);
          
          await loadGraphData();
        } catch (error) {
          console.error('转换为结构化关系失败:', error);
          setToastMessage(`转换失败: ${error instanceof Error ? error.message : String(error)}`);
          setShowToast(true);
        } finally {
          setLoading(false);
        }
      }
    );
  }, [loadGraphData]);

  // 处理创建关系
  const handleCreateRelation = useCallback(async (sourceNodeId: string, relationType: string, targetNodeId?: string, nodeLabel?: string) => {
    try {
      setLoading(true);
      const db = graphDatabaseService.getDatabase('GraphViewDemo');
      
      let createdNodeId = '';

      // 检查是否提供了目标节点ID
      if (targetNodeId) {
        // 如果提供了目标节点ID，则直接创建关系到该节点
        createdNodeId = targetNodeId;
      } else {
        // 创建新节点，使用用户提供的标签或默认标签
        const label = nodeLabel && nodeLabel.trim() !== '' 
          ? nodeLabel 
          : `新${relationType}节点`;
        createdNodeId = await db.addNode({
          type: 'knowledge',
          label: label,
          properties: {
            created_at: new Date().toISOString(),
            description: `从节点 ${sourceNodeId} 创建的 ${relationType} 关系节点`
          }
        });
        
        // 设置新节点ID以应用动效
        newNodeId.current = createdNodeId;
        
        // 设置定时器，5秒后清除新节点标记
        setTimeout(() => {
          newNodeId.current = '';
        }, 5000);
      }
      
      // 创建边
      await db.addEdge({
        source_id: sourceNodeId,
        target_id: createdNodeId,
        type: relationType,
        properties: {
          created_at: new Date().toISOString()
        }
      });
      
      const message = targetNodeId 
        ? `已创建 ${relationType} 关系到现有节点` 
        : `已创建 ${relationType} 关系和新节点`;
      
      setToastMessage(message);
      setShowToast(true);
      
      // 更新已知关系类型列表
      if (!knownRelationshipTypesState.includes(relationType)) {
        setKnownRelationshipTypes([...knownRelationshipTypesState, relationType]);
      }
      
      // 重新加载数据
      await loadGraphData();
      
      // 根据配置决定是否将新节点设为中心节点
      if (!targetNodeId && viewConfigState.autoFocusNewNode) {
        // 将新节点设为中心节点
        setCentralNodeId(createdNodeId);
        // 保存当前聚焦节点
        ConfigService.saveCentralNodeId(createdNodeId);
        // 更新url参数但不刷新页面
        const searchParams = new URLSearchParams(location.search);
        searchParams.set('node', createdNodeId);
        history.replace({ search: searchParams.toString() });
      }
    } catch (error) {
      console.error('创建关系失败:', error);
      setToastMessage(`创建关系失败: ${error instanceof Error ? error.message : String(error)}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  }, [location.search, history, knownRelationshipTypesState, viewConfigState.autoFocusNewNode, loadGraphData]);

  // 处理关系组配置更改
  const handleQuadrantChange = useCallback((position: QuadrantPosition, value: string[]) => {
    const newConfig = {
      ...quadrantConfigState,
      [position]: value
    };
    setQuadrantConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveQuadrantConfig(newConfig);
  }, []);
  
  // 处理深度配置更改
  const handleDepthChange = useCallback((relationshipType: string, value: number) => {
    const newConfig = {
      ...depthConfigState,
      [relationshipType]: value
    };
    setDepthConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveDepthConfig(newConfig);
  }, []);

  // 加载数据时，更新已知的关系类型列表
  const updateKnownRelationshipTypes = useCallback((edges: GraphEdge[]) => {
    const relationshipTypes = new Set<string>(knownRelationshipTypesState);
    
    edges.forEach(edge => {
      if (edge.relationshipType) {
        relationshipTypes.add(edge.relationshipType);
      }
    });
    
    // 更新为已知关系类型列表
    setKnownRelationshipTypes(Array.from(relationshipTypes));
  }, []);

  // 加载数据时调用此函数
  useEffect(() => {
    if (graphDataState.edges.length > 0) {
      updateKnownRelationshipTypes(graphDataState.edges);
    }
  }, [graphDataState]);

  // 刷新视图，返回到第一个节点
  const handleReset = () => {
    if (graphDataState.nodes.length > 0) {
      const firstNodeId = graphDataState.nodes[0].id;
      setCentralNodeId(firstNodeId);
      // 更新保存的节点ID
      ConfigService.saveCentralNodeId(firstNodeId);
    }
  };
  
  // 处理关系标签显示方式变更
  const handleRelationshipLabelModeChange = (value: RelationshipLabelMode) => {
    const newConfig = {
      ...viewConfigState,
      showRelationshipLabels: value
    };
    setViewConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveViewConfig(newConfig);
  };

  // 处理自动聚焦新节点配置变更
  const handleAutoFocusNewNodeChange = (value: boolean) => {
    const newConfig = {
      ...viewConfigState,
      autoFocusNewNode: value
    };
    setViewConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveViewConfig(newConfig);
    
    // 显示提示
    setToastMessage(`自动聚焦新节点已${value ? '开启' : '关闭'}`);
    setShowToast(true);
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
      ...quadrantConfigState,
      unconfiguredTypesPosition: position
    };
    setQuadrantConfig(newConfig);
    // 保存到本地存储
    ConfigService.saveQuadrantConfig(newConfig);
  };

  // 当关系类型配置变化时，更新四象限配置中的关系类型配置
  useEffect(() => {
    const updatedQuadrantConfig = {
      ...quadrantConfigState,
      relationshipTypeConfig: relationshipTypeConfigState
    };
    setQuadrantConfig(updatedQuadrantConfig);
    
    // 保存更新后的配置
    ConfigService.saveQuadrantConfig(updatedQuadrantConfig);
  }, [relationshipTypeConfigState]);

  // 处理关系类型相对性配置更新
  const handleRelationshipTypeConfigChange = (newConfig: RelationshipTypeConfig) => {
    setRelationshipTypeConfig(newConfig);
    
    // 显示提示
    setToastMessage('关系相对性配置已更新');
    setShowToast(true);
  };

  // 重置所有配置到默认值
  const handleResetAllConfigs = () => {
    showConfirmDialog(
      '重置所有配置',
      '确定要重置所有配置为默认值吗？这将恢复默认的四象限布局、深度和视图设置。',
      () => {
        // 重置所有配置
        setQuadrantConfig({ ...defaultQuadrantConfig });
        setDepthConfig({ ...defaultDepthConfig });
        setViewConfig({ ...defaultViewConfig });
        setRelationshipTypeConfig({ ...defaultRelationshipTypeConfig });
        // 显示提示
        setToastMessage('所有配置已重置为默认值');
        setShowToast(true);
      }
    );
  };

  // 处理打开设置弹窗
  const handleOpenSettings = () => {
    setShowSettingsModal(true);
  };

  // 处理关闭设置弹窗
  const handleCloseSettings = () => {
    setShowSettingsModal(false);
  };

  // 添加处理查询数据库状态的函数
  const handleCheckDbStatus = async () => {
    try {
      setLoading(true);
      
      
      const status = await graphDatabaseService.getDatabaseStatus('GraphViewDemo');
      
      
      setDbStatus(status);
      setDbStatusModalOpen(true);
    } catch (error) {
      console.error('[GraphViewDemo] 获取数据库状态失败:', error);
      setToastMessage(`获取数据库状态失败: ${error instanceof Error ? error.message : String(error)}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // 添加处理手动提交事务的函数
  const handleCommitTransaction = async () => {
    try {
      setLoading(true);
      
      
      const result = await graphDatabaseService.forceCommitTransaction('GraphViewDemo');
      
      
      setTransactionResult(result);
      setTransactionResultModalOpen(true);
      
      // 提交后刷新数据
      if (result.success) {
        await loadGraphData();
        setToastMessage('已手动提交事务并刷新数据');
      } else {
        setToastMessage(`手动提交事务失败: ${result.message}`);
      }
      setShowToast(true);
    } catch (error) {
      console.error('[GraphViewDemo] 手动提交事务失败:', error);
      setToastMessage(`手动提交事务失败: ${error instanceof Error ? error.message : String(error)}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // 处理开发者模式变更
  const handleDeveloperModeChange = (value: boolean) => {
    // 更新视图配置
    const newViewConfig = {
      ...viewConfigState,
      developerMode: value
    };
    
    // 保存配置
    setViewConfig(newViewConfig);
    ConfigService.saveViewConfig(newViewConfig);
    
    // 显示提示
    setToastMessage(`开发者模式已${value ? '启用' : '禁用'}`);
    setShowToast(true);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            {/* Remove back button to home page */}
          </IonButtons>
          <IonTitle>图形视图展示</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleRefreshData} disabled={isLoadingState}>
              刷新数据
            </IonButton>
            <IonButton onClick={handleReset} disabled={isLoadingState}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
            <ThemeToggle />
            <IonButton onClick={handleOpenSettings} title="图形视图设置">
              <IonIcon icon={settings} />
            </IonButton>
            <IonMenuButton />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {isLoadingState ? (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <p>正在加载数据...</p>
          </div>
        ) : errorState ? (
          <IonCard>
            <IonCardContent>
              <div className="error-container">
                <p>出错了: {errorState}</p>
                <p className="debug-info">请尝试先打开"图数据库演示"页面添加数据，然后再回到此页面。</p>
                <div className="button-group">
                  <IonButton onClick={handleRefreshData}>刷新数据</IonButton>
                  <IonButton routerLink="/graph-demo">前往图数据库演示</IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        ) : graphDataState.nodes.length === 0 ? (
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
          <div className="graph-view-demo-container">            
            <GraphView 
              graphData={graphDataState} 
              centralNodeId={centralNodeIdState} 
              quadrantConfig={quadrantConfigState}
              depthConfig={depthConfigState}
              viewConfig={viewConfigState}
              navbarHeight={navbarHeightState}
              onNodeClick={handleNodeClick}
              onEditNode={handleEditNode}
              onDeleteNode={handleDeleteNode}
              onEditEdge={handleEditEdge}
              onDeleteEdge={handleDeleteEdge}
              onCreateRelation={handleCreateRelation}
              onConvertToStructured={handleConvertToStructuredRelationship}
              newNodeId={newNodeId.current}
            />
          </div>
        )}
        
        <IonToast
          isOpen={showToastState}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessageState}
          duration={2000}
          position="bottom"
        />
        
        <IonAlert
          isOpen={showAlertState}
          onDidDismiss={() => setShowAlert(false)}
          header={alertHeaderState}
          message={alertMessageState}
          buttons={[
            {
              text: '取消',
              role: 'cancel',
              handler: () => setShowAlert(false)
            },
            {
              text: '确认',
              handler: () => {
                confirmHandlerState();
                setShowAlert(false);
              }
            }
          ]}
        />

        {/* 设置弹窗 */}
        <SettingsModal
          isOpen={showSettingsModalState}
          onClose={handleCloseSettings}
          quadrantConfig={quadrantConfigState}
          depthConfig={depthConfigState}
          viewConfig={viewConfigState}
          relationshipTypeConfig={relationshipTypeConfigState}
          knownRelationshipTypes={knownRelationshipTypesState}
          onQuadrantChange={handleQuadrantChange}
          onDepthChange={handleDepthChange}
          onRelationshipLabelModeChange={handleRelationshipLabelModeChange}
          onAutoFocusNewNodeChange={handleAutoFocusNewNodeChange}
          onDeveloperModeChange={handleDeveloperModeChange}
          onUnconfiguredPositionChange={handleUnconfiguredPositionChange}
          onRelationshipTypeConfigChange={handleRelationshipTypeConfigChange}
          onResetAllConfigs={handleResetAllConfigs}
        />
        
        {/* 添加数据库状态弹窗 */}
        <IonAlert
          isOpen={dbStatusModalOpenState}
          onDidDismiss={() => setDbStatusModalOpen(false)}
          header={'数据库状态'}
          message={
            dbStatusState ? 
            `平台: ${dbStatusState.database?.platform || '未知'}\n` +
            `数据库名称: ${dbStatusState.database?.dbName || '未知'}\n` +
            `连接状态: ${dbStatusState.database?.isConnected ? '已连接' : '未连接'}\n` +
            `标记的事务状态: ${dbStatusState.database?.inTransaction ? '在事务中' : '无事务'}\n` +
            `实际事务状态: ${dbStatusState.database?.actualTransactionActive ? '活跃' : '未活跃'}\n` +
            `引用计数: ${dbStatusState.service?.referenceCount || 0}\n` +
            `正在关闭: ${dbStatusState.service?.closingInProgress ? '是' : '否'}\n` +
            `已初始化: ${dbStatusState.service?.initialized ? '是' : '否'}\n` +
            `访问组件: ${dbStatusState.service?.accessingComponents?.join(', ') || '无'}\n` +
            `时间戳: ${dbStatusState.timestamp || '未知'}`
            : '无数据'
          }
          buttons={['关闭']}
        />
        
        {/* 添加事务提交结果弹窗 */}
        <IonAlert
          isOpen={transactionResultModalOpenState}
          onDidDismiss={() => setTransactionResultModalOpen(false)}
          header={'事务提交结果'}
          message={
            transactionResultState ? 
            `状态: ${transactionResultState.success ? '成功' : '失败'}\n` +
            `消息: ${transactionResultState.message || '无'}\n` +
            `时间戳: ${new Date().toISOString()}`
            : '无数据'
          }
          buttons={['关闭']}
        />
      </IonContent>
    </IonPage>
  );
};

export default React.memo(GraphViewDemo); 