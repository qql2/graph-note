import React, { useState, useEffect } from 'react';
import { 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent, 
  IonItem, 
  IonLabel, 
  IonInput, 
  IonButton, 
  IonIcon, 
  IonGrid, 
  IonRow, 
  IonCol, 
  IonList,
  IonAlert
} from '@ionic/react';
import { add, swapHorizontal, trashOutline } from 'ionicons/icons';
import { RelationshipTypeConfig } from '../../models/GraphNode';
import './RelationshipConfig.css';

interface RelationshipConfigProps {
  relationshipConfig: RelationshipTypeConfig;
  onConfigChange: (newConfig: RelationshipTypeConfig) => void;
}

const RelationshipConfig: React.FC<RelationshipConfigProps> = ({
  relationshipConfig,
  onConfigChange
}) => {
  const [relationships, setRelationships] = useState<Array<[string, string]>>([]);
  const [newRelation, setNewRelation] = useState<{ source: string; target: string }>({ source: '', target: '' });
  const [showAlert, setShowAlert] = useState(false);
  const [currentRelationToDelete, setCurrentRelationToDelete] = useState<[string, string] | null>(null);

  // 初始化关系列表
  useEffect(() => {
    const relationPairs: Array<[string, string]> = [];
    
    // 转换对象为数组以便于显示
    for (const [source, target] of Object.entries(relationshipConfig.oppositeTypes)) {
      // 只添加一对中的一个，避免重复
      if (!relationPairs.some(([s, t]) => (s === target && t === source))) {
        relationPairs.push([source, target]);
      }
    }
    
    setRelationships(relationPairs);
  }, [relationshipConfig]);

  // 处理添加新关系
  const handleAddRelationship = () => {
    if (!newRelation.source.trim() || !newRelation.target.trim()) {
      return; // 空值检查
    }

    // 检查关系是否已存在
    const exists = relationships.some(
      ([source, target]) => 
        source === newRelation.source || 
        target === newRelation.target ||
        source === newRelation.target || 
        target === newRelation.source
    );

    if (exists) {
      // 如果关系已存在，提示用户
      alert('这个关系类型已经存在相对关系配置，请先删除现有配置');
      return;
    }

    // 添加新关系
    const updatedRelationships = [
      ...relationships,
      [newRelation.source, newRelation.target] as [string, string]
    ];
    
    setRelationships(updatedRelationships);
    setNewRelation({ source: '', target: '' });
    
    // 更新配置
    updateConfig(updatedRelationships);
  };

  // 确认删除关系
  const confirmDeleteRelationship = (relationship: [string, string]) => {
    setCurrentRelationToDelete(relationship);
    setShowAlert(true);
  };

  // 处理删除关系
  const handleDeleteRelationship = () => {
    if (!currentRelationToDelete) return;
    
    const [sourceToDelete, targetToDelete] = currentRelationToDelete;
    
    // 过滤掉要删除的关系
    const filteredRelationships = relationships.filter(
      ([source, target]) => !(source === sourceToDelete && target === targetToDelete)
    );
    
    setRelationships(filteredRelationships);
    setCurrentRelationToDelete(null);
    
    // 更新配置
    updateConfig(filteredRelationships);
  };

  // 更新配置并通知父组件
  const updateConfig = (relationshipsList: Array<[string, string]>) => {
    const newOppositeTypes: Record<string, string> = {};
    
    // 将数组转换回对象
    relationshipsList.forEach(([source, target]) => {
      newOppositeTypes[source] = target;
      newOppositeTypes[target] = source; // 同时添加反向映射
    });
    
    // 创建新的配置对象
    const newConfig: RelationshipTypeConfig = {
      oppositeTypes: newOppositeTypes
    };
    
    // 通知父组件
    onConfigChange(newConfig);
  };

  return (
    <IonCard className="relationship-config-card">
      <IonCardHeader>
        <IonCardTitle>关系相对性配置</IonCardTitle>
      </IonCardHeader>
      
      <IonCardContent>
        <p className="config-description">
          配置关系类型的相对性，例如 "父" 与 "子" 是相对的，系统会自动处理关系的方向和布局。
        </p>
        
        {/* 添加新关系 */}
        <IonGrid className="add-relationship-grid">
          <IonRow>
            <IonCol size="5">
              <IonItem>
                <IonLabel position="floating">关系类型</IonLabel>
                <IonInput 
                  value={newRelation.source} 
                  onIonChange={e => setNewRelation({...newRelation, source: e.detail.value?.toString() || ''})}
                  placeholder="例如: father"
                />
              </IonItem>
            </IonCol>
            
            <IonCol size="2" className="relation-icon-col">
              <IonIcon icon={swapHorizontal} className="relation-icon" />
            </IonCol>
            
            <IonCol size="5">
              <IonItem>
                <IonLabel position="floating">相对关系类型</IonLabel>
                <IonInput 
                  value={newRelation.target} 
                  onIonChange={e => setNewRelation({...newRelation, target: e.detail.value?.toString() || ''})}
                  placeholder="例如: child"
                />
              </IonItem>
            </IonCol>
          </IonRow>
          
          <IonRow>
            <IonCol className="add-button-col">
              <IonButton 
                expand="block" 
                onClick={handleAddRelationship}
                disabled={!newRelation.source || !newRelation.target}
              >
                <IonIcon slot="start" icon={add} />
                添加关系
              </IonButton>
            </IonCol>
          </IonRow>
        </IonGrid>
        
        {/* 现有关系列表 */}
        <IonList className="relationships-list">
          <IonItem lines="full" className="list-header">
            <IonLabel>已配置的关系相对性</IonLabel>
          </IonItem>
          
          {relationships.length === 0 ? (
            <IonItem>
              <IonLabel color="medium" className="no-relationships">
                尚未配置任何关系相对性。请添加第一个配置。
              </IonLabel>
            </IonItem>
          ) : (
            relationships.map(([source, target], index) => (
              <IonItem key={index} className="relationship-list-item">
                <IonLabel className="relationship-item">
                  <span className="relationship-name">{source}</span>
                  <IonIcon icon={swapHorizontal} className="relationship-icon" />
                  <span className="relationship-name">{target}</span>
                </IonLabel>
                <IonButton 
                  fill="clear" 
                  color="danger" 
                  size="small"
                  className="delete-button"
                  onClick={() => confirmDeleteRelationship([source, target])}
                >
                  <IonIcon icon={trashOutline} />
                </IonButton>
              </IonItem>
            ))
          )}
        </IonList>
      </IonCardContent>
      
      {/* 删除确认提示 */}
      <IonAlert
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="确认删除"
        message={`确定要删除关系 "${currentRelationToDelete?.[0]} ⟷ ${currentRelationToDelete?.[1]}" 吗？`}
        buttons={[
          {
            text: '取消',
            role: 'cancel',
          },
          {
            text: '删除',
            role: 'destructive',
            handler: handleDeleteRelationship
          }
        ]}
      />
    </IonCard>
  );
};

export default RelationshipConfig; 