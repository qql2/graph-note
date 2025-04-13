import React, { useState } from 'react';
import { IonSegment, IonSegmentButton, IonLabel, IonList, IonItem, IonIcon, IonButton, IonBadge, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonText } from '@ionic/react';
import { personCircleOutline, gitNetworkOutline, closeCircleOutline } from 'ionicons/icons';
import { SearchResult } from '../../models/SearchTypes';
import { GraphNode, GraphEdge } from '../../models/GraphNode';
import './SearchResults.css';

export interface SearchResultsProps {
  results: SearchResult;
  onSelectNode?: (node: GraphNode) => void;
  onSelectEdge?: (edge: GraphEdge) => void;
  onClear?: () => void;
  onPageChange?: (page: number, pageSize: number) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ 
  results, 
  onSelectNode,
  onSelectEdge,
  onClear,
  onPageChange
}) => {
  // 当前查看的结果类型（节点或关系）
  const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>(results.nodes.length > 0 ? 'nodes' : 'edges');
  
  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  // 计算总页数
  const totalNodePages = Math.ceil(results.totalNodeCount / pageSize);
  const totalEdgePages = Math.ceil(results.totalEdgeCount / pageSize);
  
  // 处理分页变化
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (onPageChange) {
      onPageChange(newPage, pageSize);
    }
  };
  
  // 处理节点选择
  const handleNodeSelect = (node: GraphNode) => {
    if (onSelectNode) {
      onSelectNode(node);
    }
  };
  
  // 处理关系选择
  const handleEdgeSelect = (edge: GraphEdge) => {
    if (onSelectEdge) {
      onSelectEdge(edge);
    }
  };
  
  // 处理清空结果
  const handleClear = () => {
    if (onClear) {
      onClear();
    }
  };
  
  // 显示节点列表
  const renderNodeList = () => {
    if (results.nodes.length === 0) {
      return (
        <IonCard>
          <IonCardContent>
            <IonText color="medium">
              <p className="no-results">未找到符合条件的节点</p>
            </IonText>
          </IonCardContent>
        </IonCard>
      );
    }
    
    return (
      <>
        <IonList>
          {results.nodes.map(node => (
            <IonItem 
              key={node.id} 
              button 
              detail
              onClick={() => handleNodeSelect(node)}
            >
              <IonIcon icon={personCircleOutline} slot="start" />
              <IonLabel>
                <h2>{node.label}</h2>
                {node.description && <p>{node.description}</p>}
                <p className="node-metadata">
                  <IonBadge color="primary">{node.metadata?.type || '未分类'}</IonBadge>
                  {node.metadata?.created_at && (
                    <small className="creation-date">
                      创建于: {new Date(node.metadata.created_at).toLocaleString()}
                    </small>
                  )}
                </p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
        
        {/* 分页控件 */}
        {totalNodePages > 1 && (
          <div className="pagination">
            <IonButton 
              fill="clear" 
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
            >
              上一页
            </IonButton>
            <span>第 {page} 页 / 共 {totalNodePages} 页</span>
            <IonButton 
              fill="clear" 
              disabled={page === totalNodePages}
              onClick={() => handlePageChange(page + 1)}
            >
              下一页
            </IonButton>
          </div>
        )}
      </>
    );
  };
  
  // 显示关系列表
  const renderEdgeList = () => {
    if (results.edges.length === 0) {
      return (
        <IonCard>
          <IonCardContent>
            <IonText color="medium">
              <p className="no-results">未找到符合条件的关系</p>
            </IonText>
          </IonCardContent>
        </IonCard>
      );
    }
    
    return (
      <>
        <IonList>
          {results.edges.map(edge => (
            <IonItem 
              key={edge.id} 
              button 
              detail
              onClick={() => handleEdgeSelect(edge)}
            >
              <IonIcon icon={gitNetworkOutline} slot="start" />
              <IonLabel>
                <h2>{edge.relationshipType}</h2>
                <p>
                  从 <IonBadge color="light">{edge.source}</IonBadge>
                  &nbsp;到&nbsp;
                  <IonBadge color="light">{edge.target}</IonBadge>
                </p>
                {edge.metadata?.created_at && (
                  <small className="creation-date">
                    创建于: {new Date(edge.metadata.created_at).toLocaleString()}
                  </small>
                )}
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
        
        {/* 分页控件 */}
        {totalEdgePages > 1 && (
          <div className="pagination">
            <IonButton 
              fill="clear" 
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
            >
              上一页
            </IonButton>
            <span>第 {page} 页 / 共 {totalEdgePages} 页</span>
            <IonButton 
              fill="clear" 
              disabled={page === totalEdgePages}
              onClick={() => handlePageChange(page + 1)}
            >
              下一页
            </IonButton>
          </div>
        )}
      </>
    );
  };
  
  return (
    <div className="search-results">
      <IonCard>
        <IonCardHeader>
          <IonGrid>
            <IonRow>
              <IonCol size="10">
                <IonCardTitle>
                  搜索结果
                  <small className="result-count">
                    （找到 {results.totalNodeCount} 个节点和 {results.totalEdgeCount} 个关系）
                  </small>
                </IonCardTitle>
              </IonCol>
              <IonCol size="2" className="clear-button-col">
                <IonButton 
                  fill="clear" 
                  color="medium" 
                  onClick={handleClear}
                >
                  <IonIcon icon={closeCircleOutline} />
                </IonButton>
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonCardHeader>
        
        <IonCardContent>
          {/* 切换标签 */}
          <IonSegment value={activeTab} onIonChange={e => setActiveTab(e.detail.value as any)}>
            <IonSegmentButton value="nodes">
              <IonLabel>节点 ({results.nodes.length})</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="edges">
              <IonLabel>关系 ({results.edges.length})</IonLabel>
            </IonSegmentButton>
          </IonSegment>
          
          {/* 结果列表 */}
          <div className="result-list">
            {activeTab === 'nodes' ? renderNodeList() : renderEdgeList()}
          </div>
        </IonCardContent>
      </IonCard>
    </div>
  );
}; 