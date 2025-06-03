import React, { useEffect, useState, useRef } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonButton,
  IonList,
  IonSpinner,
  IonToast,
  IonButtons,
  IonIcon,
  IonMenuButton,
  IonBadge,
  IonAlert,
  IonNote,
  IonText,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonAccordion,
  IonAccordionGroup,
  IonChip,
  IonTextarea,
} from '@ionic/react';
import {
  checkmarkCircleOutline,
  alertCircleOutline,
  refreshOutline,
  analyticsOutline,
  bugOutline,
  informationCircleOutline,
  warningOutline,
  shieldCheckmarkOutline,
  documentsOutline,
  codeSlashOutline,
} from 'ionicons/icons';
import graphDatabaseService from '../services/graph-database/GraphDatabaseService';
import { ValidationResult } from '../services/graph-database/core/types';
import { GraphNodeType, RelayRelationshipType } from '../models/GraphNode';
import './DatabaseManagement.css';

interface ValidationMetadata {
  totalStructuredRelationships?: number;
  validStructuredRelationships?: number;
  invalidStructuredRelationships?: number;
  orphanedRelayEdges?: number;
}

const DatabaseManagement: React.FC = () => {
  // 状态管理
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' }>({ text: '', type: 'info' });
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertData, setAlertData] = useState<{ header: string; message: string; buttons: any[] }>({ header: '', message: '', buttons: [] });
  const [lastValidationTime, setLastValidationTime] = useState<Date | null>(null);
  const [autoValidation, setAutoValidation] = useState<boolean>(false);
  const autoValidationInterval = useRef<NodeJS.Timeout | null>(null);

  // 数据库状态
  const [dbStats, setDbStats] = useState<{
    nodeCount: number;
    edgeCount: number;
    relationshipTypeCount: number;
    relayEdgeCount: number;
  }>({
    nodeCount: 0,
    edgeCount: 0,
    relationshipTypeCount: 0,
    relayEdgeCount: 0,
  });

  // 初始化数据库连接
  useEffect(() => {
    initializeDatabase();
    return () => {
      // 清理自动验证定时器
      if (autoValidationInterval.current) {
        clearInterval(autoValidationInterval.current);
      }
    };
  }, []);

  // 自动验证功能
  useEffect(() => {
    if (autoValidation && isInitialized) {
      // 每30秒执行一次自动验证
      autoValidationInterval.current = setInterval(() => {
        performValidation(false); // 静默验证，不显示loading
      }, 30000);
    } else {
      if (autoValidationInterval.current) {
        clearInterval(autoValidationInterval.current);
        autoValidationInterval.current = null;
      }
    }

    return () => {
      if (autoValidationInterval.current) {
        clearInterval(autoValidationInterval.current);
      }
    };
  }, [autoValidation, isInitialized]);

  const initializeDatabase = async () => {
    try {
      setIsLoading(true);
      
      if (!graphDatabaseService.isInitialized()) {
        await graphDatabaseService.initialize({
          dbName: 'graph_management',
          version: 1,
          verbose: true
        }, 'DatabaseManagement');
      }

      setIsInitialized(true);
      showMessage('数据库连接成功', 'success');
      
      // 加载数据库统计信息
      await loadDatabaseStats();
      
      // 执行初始验证
      await performValidation();
      
    } catch (error) {
      console.error('数据库初始化失败:', error);
      showMessage(`数据库初始化失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const loadDatabaseStats = async () => {
    try {
      const db = graphDatabaseService.getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }      // 获取所有节点和边的统计信息，直接从数据库查询而不使用抽象层
      // 获取节点总数
      const nodeCountResult = await db.db.query('SELECT COUNT(*) as count FROM nodes');
      const nodeCount = nodeCountResult.values?.[0]?.count || 0;
      
      // 获取边总数（所有关系）
      const edgeCountResult = await db.db.query('SELECT COUNT(*) as count FROM relationships');
      const edgeCount = edgeCountResult.values?.[0]?.count || 0;
      
      // 获取关系类型节点数量
      const relationshipTypeCountResult = await db.db.query(
        'SELECT COUNT(*) as count FROM nodes WHERE type = ?',
        [GraphNodeType.RELATIONSHIP_TYPE]
      );
      const relationshipTypeCount = relationshipTypeCountResult.values?.[0]?.count || 0;
      
      // 获取_relay边数量
      const relayEdgeCountResult = await db.db.query(
        'SELECT COUNT(*) as count FROM relationships WHERE type = ?',
        [RelayRelationshipType.RELAY]
      );
      const relayEdgeCount = relayEdgeCountResult.values?.[0]?.count || 0;

      setDbStats({
        nodeCount,
        edgeCount,
        relationshipTypeCount,
        relayEdgeCount,
      });

    } catch (error) {
      console.error('加载数据库统计信息失败:', error);
      showMessage('加载数据库统计信息失败', 'error');
    }
  };

  const performValidation = async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }

      const db = graphDatabaseService.getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }

      console.log('[DatabaseManagement] 开始执行结构化关系验证...');
      const result = await db.validateStructuredRelationships();
      console.log('[DatabaseManagement] 验证结果:', result);

      setValidationResult(result);
      setLastValidationTime(new Date());

      // 更新数据库统计信息
      await loadDatabaseStats();

      if (showLoading) {
        if (result.valid) {
          showMessage('验证完成：所有结构化关系都是有效的', 'success');
        } else {
          showMessage(`验证完成：发现 ${result.errors.length} 个问题`, 'warning');
        }
      }

    } catch (error) {
      console.error('验证失败:', error);
      setValidationResult({
        valid: false,
        nodeCount: 0,
        edgeCount: 0,
        errors: [`验证操作失败: ${error instanceof Error ? error.message : '未知错误'}`],
      });
      
      if (showLoading) {
        showMessage('验证操作失败', 'error');
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const handleRefresh = async (event?: CustomEvent) => {
    await loadDatabaseStats();
    await performValidation(false);
    
    if (event) {
      event.detail.complete();
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setMessage({ text, type });
    setShowToast(true);
  };

  const showValidationDetails = () => {
    if (!validationResult) return;

    const metadata = validationResult.metadata as ValidationMetadata;
    
    let detailMessage = `验证详情：\n\n`;
    detailMessage += `• 总节点数: ${validationResult.nodeCount}\n`;
    detailMessage += `• 总边数: ${validationResult.edgeCount}\n`;
    
    if (metadata) {
      detailMessage += `• 结构化关系总数: ${metadata.totalStructuredRelationships || 0}\n`;
      detailMessage += `• 有效结构化关系: ${metadata.validStructuredRelationships || 0}\n`;
      detailMessage += `• 无效结构化关系: ${metadata.invalidStructuredRelationships || 0}\n`;
      detailMessage += `• 孤立的_relay边: ${metadata.orphanedRelayEdges || 0}\n`;
    }
    
    if (validationResult.errors.length > 0) {
      detailMessage += `\n发现的问题：\n`;
      validationResult.errors.forEach((error, index) => {
        detailMessage += `${index + 1}. ${error}\n`;
      });
    }

    setAlertData({
      header: '验证详情',
      message: detailMessage,
      buttons: [
        {
          text: '关闭',
          role: 'cancel'
        }
      ]
    });
    setShowAlert(true);
  };

  const toggleAutoValidation = () => {
    setAutoValidation(!autoValidation);
    showMessage(
      autoValidation ? '自动验证已停止' : '自动验证已启动（每30秒执行一次）',
      'info'
    );
  };

  const getValidationStatusColor = () => {
    if (!validationResult) return 'medium';
    return validationResult.valid ? 'success' : 'danger';
  };

  const getValidationStatusIcon = () => {
    if (!validationResult) return informationCircleOutline;
    return validationResult.valid ? checkmarkCircleOutline : alertCircleOutline;
  };

  const formatLastValidationTime = () => {
    if (!lastValidationTime) return '未知';
    
    const now = new Date();
    const diff = now.getTime() - lastValidationTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return `${seconds}秒前`;
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>数据库管理</IonTitle>
          <IonButtons slot="end">
            <IonButton 
              fill="clear" 
              onClick={() => handleRefresh()}
              disabled={isLoading}
            >
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {isLoading && (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <IonSpinner name="crescent" />
            <p>正在处理...</p>
          </div>
        )}

        <IonGrid>
          {/* 数据库状态卡片 */}
          <IonRow>
            <IonCol size="12">
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>
                    <IonIcon icon={analyticsOutline} style={{ marginRight: '8px' }} />
                    数据库状态
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonGrid>
                    <IonRow>
                      <IonCol size="6" sizeMd="3">
                        <div className="stat-item">
                          <IonText color="primary">
                            <h2>{dbStats.nodeCount}</h2>
                          </IonText>
                          <IonNote>总节点数</IonNote>
                        </div>
                      </IonCol>
                      <IonCol size="6" sizeMd="3">
                        <div className="stat-item">
                          <IonText color="secondary">
                            <h2>{dbStats.edgeCount}</h2>
                          </IonText>
                          <IonNote>总边数</IonNote>
                        </div>
                      </IonCol>
                      <IonCol size="6" sizeMd="3">
                        <div className="stat-item">
                          <IonText color="tertiary">
                            <h2>{dbStats.relationshipTypeCount}</h2>
                          </IonText>
                          <IonNote>结构化关系节点</IonNote>
                        </div>
                      </IonCol>
                      <IonCol size="6" sizeMd="3">
                        <div className="stat-item">
                          <IonText color="warning">
                            <h2>{dbStats.relayEdgeCount}</h2>
                          </IonText>
                          <IonNote>_relay边</IonNote>
                        </div>
                      </IonCol>
                    </IonRow>
                  </IonGrid>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          {/* 验证状态卡片 */}
          <IonRow>
            <IonCol size="12">
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>
                    <IonIcon icon={shieldCheckmarkOutline} style={{ marginRight: '8px' }} />
                    结构化关系验证
                    <IonBadge 
                      color={getValidationStatusColor()} 
                      style={{ marginLeft: '10px' }}
                    >
                      {validationResult?.valid ? '正常' : validationResult ? '异常' : '未知'}
                    </IonBadge>
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonList>
                    <IonItem>
                      <IonIcon 
                        icon={getValidationStatusIcon()} 
                        color={getValidationStatusColor()}
                        slot="start" 
                      />
                      <IonLabel>
                        <h3>验证状态</h3>
                        <p>
                          {validationResult 
                            ? (validationResult.valid 
                              ? '所有结构化关系都是有效的' 
                              : `发现 ${validationResult.errors.length} 个问题`)
                            : '尚未进行验证'
                          }
                        </p>
                      </IonLabel>
                      {validationResult && (
                        <IonButton 
                          fill="outline" 
                          size="small" 
                          onClick={showValidationDetails}
                        >
                          查看详情
                        </IonButton>
                      )}
                    </IonItem>

                    <IonItem>
                      <IonIcon icon={informationCircleOutline} slot="start" />
                      <IonLabel>
                        <h3>上次验证时间</h3>
                        <p>{formatLastValidationTime()}</p>
                      </IonLabel>
                    </IonItem>

                    <IonItem button onClick={toggleAutoValidation}>
                      <IonIcon icon={refreshOutline} slot="start" />
                      <IonLabel>
                        <h3>自动验证</h3>
                        <p>{autoValidation ? '已启用（每30秒）' : '已禁用'}</p>
                      </IonLabel>
                      <IonBadge color={autoValidation ? 'success' : 'medium'}>
                        {autoValidation ? '开启' : '关闭'}
                      </IonBadge>
                    </IonItem>
                  </IonList>

                  <div style={{ marginTop: '16px' }}>
                    <IonButton 
                      expand="block" 
                      onClick={() => performValidation()}
                      disabled={isLoading || !isInitialized}
                    >
                      <IonIcon icon={bugOutline} slot="start" />
                      立即执行验证
                    </IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          {/* 验证结果详情 */}
          {validationResult && (
            <IonRow>
              <IonCol size="12">
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>
                      <IonIcon icon={documentsOutline} style={{ marginRight: '8px' }} />
                      验证结果详情
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonAccordionGroup>
                      <IonAccordion value="summary">
                        <IonItem slot="header">
                          <IonLabel>
                            <h3>验证摘要</h3>
                            <p>基本统计信息</p>
                          </IonLabel>
                        </IonItem>
                        <div className="ion-padding" slot="content">
                          <IonList>
                            <IonItem>
                              <IonLabel>
                                <h4>验证节点数</h4>
                                <p>{validationResult.nodeCount}</p>
                              </IonLabel>
                            </IonItem>
                            <IonItem>
                              <IonLabel>
                                <h4>验证边数</h4>
                                <p>{validationResult.edgeCount}</p>
                              </IonLabel>
                            </IonItem>
                            {validationResult.metadata && (
                              <>
                                <IonItem>
                                  <IonLabel>
                                    <h4>有效结构化关系</h4>
                                    <p>{(validationResult.metadata as ValidationMetadata).validStructuredRelationships || 0}</p>
                                  </IonLabel>
                                </IonItem>
                                <IonItem>
                                  <IonLabel>
                                    <h4>无效结构化关系</h4>
                                    <p>{(validationResult.metadata as ValidationMetadata).invalidStructuredRelationships || 0}</p>
                                  </IonLabel>
                                </IonItem>
                              </>
                            )}
                          </IonList>
                        </div>
                      </IonAccordion>

                      {validationResult.errors.length > 0 && (
                        <IonAccordion value="errors">
                          <IonItem slot="header">
                            <IonIcon icon={warningOutline} color="danger" slot="start" />
                            <IonLabel>
                              <h3>发现的问题</h3>
                              <p>{validationResult.errors.length} 个问题需要修复</p>
                            </IonLabel>
                          </IonItem>
                          <div className="ion-padding" slot="content">
                            {validationResult.errors.map((error, index) => (
                              <IonChip key={index} color="danger" style={{ marginBottom: '8px', display: 'block' }}>
                                <IonIcon icon={alertCircleOutline} />
                                <IonLabel className="ion-text-wrap">{error}</IonLabel>
                              </IonChip>
                            ))}
                          </div>
                        </IonAccordion>
                      )}

                      <IonAccordion value="technical">
                        <IonItem slot="header">
                          <IonIcon icon={codeSlashOutline} slot="start" />
                          <IonLabel>
                            <h3>技术详情</h3>
                            <p>验证逻辑说明</p>
                          </IonLabel>
                        </IonItem>
                        <div className="ion-padding" slot="content">
                          <IonTextarea
                            readonly
                            value={`验证范围：
• RELATIONSHIP_TYPE 节点完整性检查
• _relay 边数量验证（每个节点必须有且仅有2条）
• _relay 边方向验证（1条入边，1条出边）
• 引用节点存在性验证
• 自环关系检测
• 孤立 _relay 边检测

验证时间：${lastValidationTime?.toLocaleString() || '未知'}
数据库状态：${isInitialized ? '已连接' : '未连接'}
自动验证：${autoValidation ? '启用' : '禁用'}`}
                            rows={10}
                            style={{ background: '#f8f9fa' }}
                          />
                        </div>
                      </IonAccordion>
                    </IonAccordionGroup>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          )}
        </IonGrid>

        {/* Toast消息 */}
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={message.text}
          duration={3000}
          color={message.type}
        />

        {/* Alert对话框 */}
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertData.header}
          message={alertData.message}
          buttons={alertData.buttons}
        />
      </IonContent>
    </IonPage>
  );
};

export default DatabaseManagement;
