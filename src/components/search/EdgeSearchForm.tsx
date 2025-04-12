import React, { useState, useEffect } from 'react';
import { IonButton, IonItem, IonLabel, IonInput, IonToggle, IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonSelect, IonSelectOption, IonSearchbar, IonList } from '@ionic/react';
import { EdgeSearchCriteria, PropertyFilter, FilterOperator, SortDirection, NodeSearchCriteria } from '../../models/SearchTypes';
import { graphSearchService } from '../../services/GraphSearchService';
import { GraphNode } from '../../models/GraphNode';
import './EdgeSearchForm.css';

export interface EdgeSearchFormProps {
  onSearch: (criteria: EdgeSearchCriteria) => void;
  isSearching: boolean;
}

export const EdgeSearchForm: React.FC<EdgeSearchFormProps> = ({ onSearch, isSearching }) => {
  // 基本搜索条件
  const [relationshipType, setRelationshipType] = useState('');
  const [sourceNodeQuery, setSourceNodeQuery] = useState('');
  const [targetNodeQuery, setTargetNodeQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 节点自动补全
  const [sourceNodeResults, setSourceNodeResults] = useState<GraphNode[]>([]);
  const [targetNodeResults, setTargetNodeResults] = useState<GraphNode[]>([]);
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const [showTargetSuggestions, setShowTargetSuggestions] = useState(false);
  const [selectedSourceNode, setSelectedSourceNode] = useState<GraphNode | null>(null);
  const [selectedTargetNode, setSelectedTargetNode] = useState<GraphNode | null>(null);
  
  // 高级搜索条件
  const [properties, setProperties] = useState<PropertyFilter[]>([]);
  const [createdAfter, setCreatedAfter] = useState<string | null>(null);
  const [createdBefore, setCreatedBefore] = useState<string | null>(null);
  const [sourceNodeLabel, setSourceNodeLabel] = useState('');
  const [targetNodeLabel, setTargetNodeLabel] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.DESC);
  const [limit, setLimit] = useState<number>(50);
  
  // 搜索节点（用于自动补全）
  useEffect(() => {
    const searchSourceNodes = async () => {
      if (sourceNodeQuery.trim().length < 2) {
        setSourceNodeResults([]);
        return;
      }
      
      try {
        const criteria: NodeSearchCriteria = {
          labelContains: sourceNodeQuery,
          limit: 10
        };
        const result = await graphSearchService.searchNodes(criteria);
        setSourceNodeResults(result.nodes);
      } catch (error) {
        console.error('搜索源节点失败:', error);
        setSourceNodeResults([]);
      }
    };
    
    const timer = setTimeout(searchSourceNodes, 300);
    return () => clearTimeout(timer);
  }, [sourceNodeQuery]);
  
  useEffect(() => {
    const searchTargetNodes = async () => {
      if (targetNodeQuery.trim().length < 2) {
        setTargetNodeResults([]);
        return;
      }
      
      try {
        const criteria: NodeSearchCriteria = {
          labelContains: targetNodeQuery,
          limit: 10
        };
        const result = await graphSearchService.searchNodes(criteria);
        setTargetNodeResults(result.nodes);
      } catch (error) {
        console.error('搜索目标节点失败:', error);
        setTargetNodeResults([]);
      }
    };
    
    const timer = setTimeout(searchTargetNodes, 300);
    return () => clearTimeout(timer);
  }, [targetNodeQuery]);
  
  // 添加属性过滤
  const addPropertyFilter = () => {
    setProperties([
      ...properties,
      { key: '', operator: FilterOperator.EQUALS, value: '' }
    ]);
  };
  
  // 更新属性过滤
  const updatePropertyFilter = (index: number, field: keyof PropertyFilter, value: any) => {
    const updatedProperties = [...properties];
    updatedProperties[index] = {
      ...updatedProperties[index],
      [field]: value
    };
    setProperties(updatedProperties);
  };
  
  // 删除属性过滤
  const removePropertyFilter = (index: number) => {
    const updatedProperties = [...properties];
    updatedProperties.splice(index, 1);
    setProperties(updatedProperties);
  };
  
  // 选择源节点
  const handleSelectSourceNode = (node: GraphNode) => {
    setSelectedSourceNode(node);
    setSourceNodeQuery(node.label);
    setShowSourceSuggestions(false);
  };
  
  // 选择目标节点
  const handleSelectTargetNode = (node: GraphNode) => {
    setSelectedTargetNode(node);
    setTargetNodeQuery(node.label);
    setShowTargetSuggestions(false);
  };
  
  // 生成搜索条件对象
  const generateSearchCriteria = (): EdgeSearchCriteria => {
    const criteria: EdgeSearchCriteria = {};
    
    // 关系类型搜索 - 使用关键字模糊匹配
    if (relationshipType) {
      criteria.typeContains = relationshipType;
    }
    
    // 源节点ID搜索
    if (selectedSourceNode) {
      criteria.sourceIds = [selectedSourceNode.id];
    }
    
    // 目标节点ID搜索
    if (selectedTargetNode) {
      criteria.targetIds = [selectedTargetNode.id];
    }
    
    // 高级搜索条件
    if (showAdvanced) {
      // 属性过滤
      if (properties.length > 0) {
        // 过滤掉不完整的属性条件
        const validProperties = properties.filter(p => p.key && (p.operator !== FilterOperator.EXISTS && p.operator !== FilterOperator.NOT_EXISTS ? p.value !== undefined : true));
        if (validProperties.length > 0) {
          criteria.properties = validProperties;
        }
      }
      
      // 创建时间范围
      if (createdAfter) {
        criteria.createdAfter = new Date(createdAfter);
      }
      if (createdBefore) {
        criteria.createdBefore = new Date(createdBefore);
      }
      
      // 源节点标签搜索
      if (sourceNodeLabel) {
        const sourceNodeCriteria: NodeSearchCriteria = {
          labelContains: sourceNodeLabel
        };
        criteria.sourceNodeCriteria = sourceNodeCriteria;
      }
      
      // 目标节点标签搜索
      if (targetNodeLabel) {
        const targetNodeCriteria: NodeSearchCriteria = {
          labelContains: targetNodeLabel
        };
        criteria.targetNodeCriteria = targetNodeCriteria;
      }
      
      // 排序条件
      if (sortField) {
        criteria.sortBy = {
          field: sortField,
          direction: sortDirection
        };
      }
      
      // 结果数量限制
      if (limit) {
        criteria.limit = limit;
      }
    }
    
    return criteria;
  };
  
  // 提交搜索
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const criteria = generateSearchCriteria();
    onSearch(criteria);
  };
  
  // 重置表单
  const resetForm = () => {
    setRelationshipType('');
    setSourceNodeQuery('');
    setTargetNodeQuery('');
    setSelectedSourceNode(null);
    setSelectedTargetNode(null);
    setProperties([]);
    setCreatedAfter(null);
    setCreatedBefore(null);
    setSourceNodeLabel('');
    setTargetNodeLabel('');
    setSortField('created_at');
    setSortDirection(SortDirection.DESC);
    setLimit(50);
  };
  
  return (
    <form onSubmit={handleSubmit} className="edge-search-form">
      <IonCard>
        <IonCardContent>
          {/* 基本搜索字段 */}
          <IonItem>
            <IonLabel position="floating">关系类型</IonLabel>
            <IonInput 
              value={relationshipType} 
              onIonChange={e => setRelationshipType(e.detail.value || '')}
              placeholder="输入关系类型关键字进行模糊匹配"
            />
          </IonItem>
          
          {/* 源节点搜索（自动补全） */}
          <div className="node-autocomplete">
            <IonItem>
              <IonLabel position="floating">源节点名称</IonLabel>
              <IonInput 
                value={sourceNodeQuery} 
                onIonChange={e => setSourceNodeQuery(e.detail.value || '')}
                onIonFocus={() => setShowSourceSuggestions(true)}
                placeholder="输入并选择源节点"
                autocomplete="off"
              />
            </IonItem>
            
            {showSourceSuggestions && sourceNodeResults.length > 0 && (
              <IonList className="suggestions-list">
                {sourceNodeResults.map(node => (
                  <IonItem 
                    key={node.id} 
                    button 
                    onClick={() => handleSelectSourceNode(node)}
                  >
                    <IonLabel>{node.label}</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            )}
          </div>
          
          {/* 目标节点搜索（自动补全） */}
          <div className="node-autocomplete">
            <IonItem>
              <IonLabel position="floating">目标节点名称</IonLabel>
              <IonInput 
                value={targetNodeQuery} 
                onIonChange={e => setTargetNodeQuery(e.detail.value || '')}
                onIonFocus={() => setShowTargetSuggestions(true)}
                placeholder="输入并选择目标节点"
                autocomplete="off"
              />
            </IonItem>
            
            {showTargetSuggestions && targetNodeResults.length > 0 && (
              <IonList className="suggestions-list">
                {targetNodeResults.map(node => (
                  <IonItem 
                    key={node.id} 
                    button 
                    onClick={() => handleSelectTargetNode(node)}
                  >
                    <IonLabel>{node.label}</IonLabel>
                  </IonItem>
                ))}
              </IonList>
            )}
          </div>
          
          {/* 高级搜索开关 */}
          <IonItem>
            <IonLabel>高级搜索</IonLabel>
            <IonToggle 
              checked={showAdvanced} 
              onIonChange={e => setShowAdvanced(e.detail.checked)} 
            />
          </IonItem>
          
          {/* 高级搜索选项 */}
          {showAdvanced && (
            <div className="advanced-options">
              {/* 属性过滤 */}
              <h4>属性过滤</h4>
              
              {properties.map((property, index) => (
                <IonGrid key={`property-${index}`}>
                  <IonRow>
                    <IonCol size="4">
                      <IonItem>
                        <IonLabel position="floating">属性名</IonLabel>
                        <IonInput 
                          value={property.key} 
                          onIonChange={e => updatePropertyFilter(index, 'key', e.detail.value || '')}
                        />
                      </IonItem>
                    </IonCol>
                    <IonCol size="3">
                      <IonItem>
                        <IonLabel position="floating">操作符</IonLabel>
                        <IonSelect 
                          value={property.operator} 
                          onIonChange={e => updatePropertyFilter(index, 'operator', e.detail.value)}
                        >
                          <IonSelectOption value={FilterOperator.EQUALS}>等于</IonSelectOption>
                          <IonSelectOption value={FilterOperator.NOT_EQUALS}>不等于</IonSelectOption>
                          <IonSelectOption value={FilterOperator.EXISTS}>存在</IonSelectOption>
                          <IonSelectOption value={FilterOperator.NOT_EXISTS}>不存在</IonSelectOption>
                        </IonSelect>
                      </IonItem>
                    </IonCol>
                    <IonCol size="4">
                      {property.operator !== FilterOperator.EXISTS && property.operator !== FilterOperator.NOT_EXISTS && (
                        <IonItem>
                          <IonLabel position="floating">属性值</IonLabel>
                          <IonInput 
                            value={property.value} 
                            onIonChange={e => updatePropertyFilter(index, 'value', e.detail.value || '')}
                          />
                        </IonItem>
                      )}
                    </IonCol>
                    <IonCol size="1">
                      <IonButton 
                        fill="clear" 
                        color="danger" 
                        onClick={() => removePropertyFilter(index)}
                      >
                        删除
                      </IonButton>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              ))}
              
              <IonButton expand="block" fill="outline" onClick={addPropertyFilter}>
                添加属性过滤
              </IonButton>
              
              {/* 节点标签搜索 */}
              <h4>节点标签</h4>
              <IonGrid>
                <IonRow>
                  <IonCol>
                    <IonItem>
                      <IonLabel position="floating">源节点标签包含</IonLabel>
                      <IonInput 
                        value={sourceNodeLabel} 
                        onIonChange={e => setSourceNodeLabel(e.detail.value || '')}
                        placeholder="输入源节点标签关键词"
                      />
                    </IonItem>
                  </IonCol>
                  <IonCol>
                    <IonItem>
                      <IonLabel position="floating">目标节点标签包含</IonLabel>
                      <IonInput 
                        value={targetNodeLabel} 
                        onIonChange={e => setTargetNodeLabel(e.detail.value || '')}
                        placeholder="输入目标节点标签关键词"
                      />
                    </IonItem>
                  </IonCol>
                </IonRow>
              </IonGrid>
              
              {/* 创建时间 */}
              <h4>创建时间</h4>
              <IonGrid>
                <IonRow>
                  <IonCol>
                    <IonItem>
                      <IonLabel position="floating">从</IonLabel>
                      <IonInput 
                        type="date" 
                        value={createdAfter} 
                        onIonChange={e => setCreatedAfter(e.detail.value!)}
                      />
                    </IonItem>
                  </IonCol>
                  <IonCol>
                    <IonItem>
                      <IonLabel position="floating">至</IonLabel>
                      <IonInput 
                        type="date" 
                        value={createdBefore} 
                        onIonChange={e => setCreatedBefore(e.detail.value!)}
                      />
                    </IonItem>
                  </IonCol>
                </IonRow>
              </IonGrid>
              
              {/* 排序和限制 */}
              <IonGrid>
                <IonRow>
                  <IonCol size="5">
                    <IonItem>
                      <IonLabel position="floating">排序字段</IonLabel>
                      <IonSelect 
                        value={sortField} 
                        onIonChange={e => setSortField(e.detail.value)}
                      >
                        <IonSelectOption value="type">关系类型</IonSelectOption>
                        <IonSelectOption value="created_at">创建时间</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                  </IonCol>
                  <IonCol size="4">
                    <IonItem>
                      <IonLabel position="floating">排序方向</IonLabel>
                      <IonSelect 
                        value={sortDirection} 
                        onIonChange={e => setSortDirection(e.detail.value)}
                      >
                        <IonSelectOption value={SortDirection.ASC}>升序</IonSelectOption>
                        <IonSelectOption value={SortDirection.DESC}>降序</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                  </IonCol>
                  <IonCol size="3">
                    <IonItem>
                      <IonLabel position="floating">结果数量</IonLabel>
                      <IonInput 
                        type="number" 
                        min="1" 
                        max="1000" 
                        value={limit} 
                        onIonChange={e => setLimit(parseInt(e.detail.value || '50', 10))}
                      />
                    </IonItem>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </div>
          )}
          
          {/* 操作按钮 */}
          <div className="form-actions">
            <IonButton expand="block" type="submit" disabled={isSearching}>
              {isSearching ? '搜索中...' : '搜索'}
            </IonButton>
            <IonButton expand="block" fill="outline" onClick={resetForm} disabled={isSearching}>
              重置
            </IonButton>
          </div>
        </IonCardContent>
      </IonCard>
    </form>
  );
}; 