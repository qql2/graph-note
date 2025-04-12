import React, { useState } from 'react';
import { IonButton, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption, IonToggle, IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonDatetime } from '@ionic/react';
import { NodeSearchCriteria, PropertyFilter, FilterOperator, SortDirection } from '../../models/SearchTypes';
import './NodeSearchForm.css';

export interface NodeSearchFormProps {
  onSearch: (criteria: NodeSearchCriteria) => void;
  isSearching: boolean;
}

export const NodeSearchForm: React.FC<NodeSearchFormProps> = ({ onSearch, isSearching }) => {
  // 基本搜索条件
  const [labelQuery, setLabelQuery] = useState('');
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 高级搜索条件
  const [properties, setProperties] = useState<PropertyFilter[]>([]);
  const [createdAfter, setCreatedAfter] = useState<string | null>(null);
  const [createdBefore, setCreatedBefore] = useState<string | null>(null);
  const [updatedAfter, setUpdatedAfter] = useState<string | null>(null);
  const [updatedBefore, setUpdatedBefore] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.DESC);
  const [limit, setLimit] = useState<number>(50);
  
  // 可能的节点类型列表（应从服务器获取）
  const [availableNodeTypes, setAvailableNodeTypes] = useState<string[]>([
    'concept', 'person', 'organization', 'event', 'place', 'document', 'other'
  ]);
  
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
  
  // 生成搜索条件对象
  const generateSearchCriteria = (): NodeSearchCriteria => {
    const criteria: NodeSearchCriteria = {};
    
    // 标签搜索
    if (labelQuery) {
      criteria.labelContains = labelQuery;
    }
    
    // 节点类型搜索
    if (nodeTypes.length > 0) {
      criteria.types = nodeTypes;
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
      
      // 更新时间范围
      if (updatedAfter) {
        criteria.updatedAfter = new Date(updatedAfter);
      }
      if (updatedBefore) {
        criteria.updatedBefore = new Date(updatedBefore);
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
    setLabelQuery('');
    setNodeTypes([]);
    setProperties([]);
    setCreatedAfter(null);
    setCreatedBefore(null);
    setUpdatedAfter(null);
    setUpdatedBefore(null);
    setSortField('created_at');
    setSortDirection(SortDirection.DESC);
    setLimit(50);
  };
  
  return (
    <form onSubmit={handleSubmit} className="node-search-form">
      <IonCard>
        <IonCardContent>
          {/* 基本搜索字段 */}
          <IonItem>
            <IonLabel position="floating">节点标签</IonLabel>
            <IonInput 
              value={labelQuery} 
              onIonChange={e => setLabelQuery(e.detail.value || '')}
              placeholder="输入节点标签或名称关键词"
            />
          </IonItem>
          
          <IonItem>
            <IonLabel position="floating">节点类型</IonLabel>
            <IonSelect 
              multiple 
              value={nodeTypes} 
              onIonChange={e => setNodeTypes(e.detail.value)}
              placeholder="选择节点类型"
            >
              {availableNodeTypes.map(type => (
                <IonSelectOption key={type} value={type}>
                  {type}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          
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
                          <IonSelectOption value={FilterOperator.CONTAINS}>包含</IonSelectOption>
                          <IonSelectOption value={FilterOperator.STARTS_WITH}>开头是</IonSelectOption>
                          <IonSelectOption value={FilterOperator.ENDS_WITH}>结尾是</IonSelectOption>
                          <IonSelectOption value={FilterOperator.GREATER_THAN}>大于</IonSelectOption>
                          <IonSelectOption value={FilterOperator.LESS_THAN}>小于</IonSelectOption>
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
              
              {/* 时间范围 */}
              <h4>创建时间</h4>
              <IonGrid>
                <IonRow>
                  <IonCol>
                    <IonItem>
                      <IonLabel position="floating">从</IonLabel>
                      <IonDatetime 
                        displayFormat="YYYY-MM-DD" 
                        value={createdAfter} 
                        onIonChange={e => setCreatedAfter(e.detail.value!)}
                      />
                    </IonItem>
                  </IonCol>
                  <IonCol>
                    <IonItem>
                      <IonLabel position="floating">至</IonLabel>
                      <IonDatetime 
                        displayFormat="YYYY-MM-DD" 
                        value={createdBefore} 
                        onIonChange={e => setCreatedBefore(e.detail.value!)}
                      />
                    </IonItem>
                  </IonCol>
                </IonRow>
              </IonGrid>
              
              <h4>更新时间</h4>
              <IonGrid>
                <IonRow>
                  <IonCol>
                    <IonItem>
                      <IonLabel position="floating">从</IonLabel>
                      <IonDatetime 
                        displayFormat="YYYY-MM-DD" 
                        value={updatedAfter} 
                        onIonChange={e => setUpdatedAfter(e.detail.value!)}
                      />
                    </IonItem>
                  </IonCol>
                  <IonCol>
                    <IonItem>
                      <IonLabel position="floating">至</IonLabel>
                      <IonDatetime 
                        displayFormat="YYYY-MM-DD" 
                        value={updatedBefore} 
                        onIonChange={e => setUpdatedBefore(e.detail.value!)}
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
                        <IonSelectOption value="label">标签</IonSelectOption>
                        <IonSelectOption value="created_at">创建时间</IonSelectOption>
                        <IonSelectOption value="updated_at">更新时间</IonSelectOption>
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