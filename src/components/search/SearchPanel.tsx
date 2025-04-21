import React, { useState } from 'react';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonIcon, IonGrid, IonRow, IonCol, IonSegment, IonSegmentButton, IonLabel } from '@ionic/react';
import { close } from 'ionicons/icons';
import { NodeSearchForm } from './NodeSearchForm';
import { EdgeSearchForm } from './EdgeSearchForm';
import { SearchResults } from './SearchResults';
import { graphSearchService } from '../../services/GraphSearchService';
import { SearchResult, NodeSearchCriteria, EdgeSearchCriteria, FullTextSearchOptions } from '../../models/SearchTypes';
import { GraphNode, GraphEdge } from '../../models/GraphNode';
import './SearchPanel.css';

export interface SearchPanelProps {
  onClose: () => void;
  onSelectNode?: (node: GraphNode) => void;
  onSelectEdge?: (edge: GraphEdge) => void;
  isModal?: boolean; // 是否在模态框中显示
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onClose, onSelectNode, onSelectEdge, isModal = false }) => {
  // 搜索模式：节点搜索或关系搜索
  const [searchMode, setSearchMode] = useState<'nodes' | 'edges' | 'fulltext'>('nodes');
  
  // 搜索结果
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  
  // 搜索状态
  const [isSearching, setIsSearching] = useState(false);
  
  // 搜索错误
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // 全文搜索查询
  const [fulltextQuery, setFulltextQuery] = useState('');

  // 记住最后一次的搜索条件
  const [lastNodeCriteria, setLastNodeCriteria] = useState<NodeSearchCriteria | null>(null);
  const [lastEdgeCriteria, setLastEdgeCriteria] = useState<EdgeSearchCriteria | null>(null);
  const [lastFulltextOptions, setLastFulltextOptions] = useState<FullTextSearchOptions | null>(null);

  // 处理节点搜索
  const handleNodeSearch = async (criteria: NodeSearchCriteria) => {
    setIsSearching(true);
    setSearchError(null);
    
    try {
      // 保存搜索条件以便分页时重用
      setLastNodeCriteria(criteria);
      
      const result = await graphSearchService.searchNodes(criteria);
      setSearchResults({
        nodes: result.nodes,
        edges: [],
        totalNodeCount: result.totalCount,
        totalEdgeCount: 0
      });
    } catch (error) {
      console.error('节点搜索失败:', error);
      setSearchError('搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  // 处理关系搜索
  const handleEdgeSearch = async (criteria: EdgeSearchCriteria) => {
    setIsSearching(true);
    setSearchError(null);
    
    try {
      // 保存搜索条件以便分页时重用
      setLastEdgeCriteria(criteria);
      
      const result = await graphSearchService.searchEdges(criteria);
      setSearchResults({
        nodes: [],
        edges: result.edges,
        totalNodeCount: 0,
        totalEdgeCount: result.totalCount
      });
    } catch (error) {
      console.error('关系搜索失败:', error);
      setSearchError('搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  // 处理全文搜索
  const handleFulltextSearch = async (options?: FullTextSearchOptions) => {
    if (!fulltextQuery.trim() && !options?.query) return;
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const searchOptions = options || { 
        includeTitles: true,
        includeProperties: true
      };
      
      // 保存搜索条件以便分页时重用
      setLastFulltextOptions(searchOptions);
      
      const result = await graphSearchService.fullTextSearch(options?.query || fulltextQuery, searchOptions);
      setSearchResults(result);
    } catch (error) {
      console.error('全文搜索失败:', error);
      setSearchError('搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  // 处理分页变化
  const handlePageChange = async (page: number, pageSize: number) => {
    // 根据当前搜索模式执行相应的分页搜索
    if (searchMode === 'nodes' && lastNodeCriteria) {
      // 使用之前的搜索条件，但更新分页参数
      const paginatedCriteria = {
        ...lastNodeCriteria,
        offset: (page - 1) * pageSize,
        limit: pageSize
      };
      await handleNodeSearch(paginatedCriteria);
    } 
    else if (searchMode === 'edges' && lastEdgeCriteria) {
      const paginatedCriteria = {
        ...lastEdgeCriteria,
        offset: (page - 1) * pageSize,
        limit: pageSize
      };
      await handleEdgeSearch(paginatedCriteria);
    }
    else if (searchMode === 'fulltext' && lastFulltextOptions) {
      const paginatedOptions = {
        ...lastFulltextOptions,
        offset: (page - 1) * pageSize,
        limit: pageSize,
        query: fulltextQuery
      };
      await handleFulltextSearch(paginatedOptions);
    }
  };

  // 处理搜索结果中节点点击
  const handleNodeSelect = (node: GraphNode) => {
    if (onSelectNode) {
      onSelectNode(node);
    }
  };

  // 处理搜索结果中关系点击
  const handleEdgeSelect = (edge: GraphEdge) => {
    if (onSelectEdge) {
      onSelectEdge(edge);
    }
  };

  // 清空搜索结果
  const clearResults = () => {
    setSearchResults(null);
    setSearchError(null);
  };

  return (
    <div className="search-panel">
      {!isModal && (
        <IonHeader>
          <IonToolbar>
            <IonTitle>图谱检索</IonTitle>
            <IonButton fill="clear" slot="end" onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonToolbar>
        </IonHeader>
      )}
      
      <IonContent>
        <IonGrid>
          <IonRow>
            <IonCol>
              <IonSegment value={searchMode} onIonChange={e => setSearchMode(e.detail.value as any)}>
                <IonSegmentButton value="nodes">
                  <IonLabel>节点检索</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="edges">
                  <IonLabel>关系检索</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="fulltext">
                  <IonLabel>全文检索</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </IonCol>
          </IonRow>
          
          {/* 搜索表单 */}
          <IonRow>
            <IonCol>
              {searchMode === 'nodes' && (
                <NodeSearchForm onSearch={handleNodeSearch} isSearching={isSearching} />
              )}
              
              {searchMode === 'edges' && (
                <EdgeSearchForm onSearch={handleEdgeSearch} isSearching={isSearching} />
              )}
              
              {searchMode === 'fulltext' && (
                <div className="fulltext-search">
                  <input
                    type="text"
                    placeholder="输入关键词进行全文搜索..."
                    value={fulltextQuery}
                    onChange={e => setFulltextQuery(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleFulltextSearch()}
                  />
                  <IonButton 
                    expand="block" 
                    onClick={() => handleFulltextSearch()} 
                    disabled={isSearching || !fulltextQuery.trim()}
                  >
                    搜索
                  </IonButton>
                </div>
              )}
            </IonCol>
          </IonRow>
          
          {/* 错误提示 */}
          {searchError && (
            <IonRow>
              <IonCol>
                <div className="search-error">{searchError}</div>
              </IonCol>
            </IonRow>
          )}
          
          {/* 搜索结果 */}
          {searchResults && (
            <IonRow>
              <IonCol>
                <SearchResults 
                  results={searchResults} 
                  onSelectNode={handleNodeSelect} 
                  onSelectEdge={handleEdgeSelect}
                  onClear={clearResults}
                  onPageChange={handlePageChange}
                />
              </IonCol>
            </IonRow>
          )}
        </IonGrid>
      </IonContent>
    </div>
  );
}; 