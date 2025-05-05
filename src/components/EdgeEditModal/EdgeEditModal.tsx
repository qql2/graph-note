import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButtons, 
  IonButton, 
  IonModal, 
  IonItem, 
  IonLabel, 
  IonInput,
  IonList,
  IonListHeader,
  IonSearchbar,
  IonToggle
} from '@ionic/react';
import './EdgeEditModal.css';
import { GraphEdge, RelationshipLabelMode } from '../../models/GraphNode';

interface EdgeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  edgeId: string;
  relationshipType: string;
  existingEdges: GraphEdge[]; // 接收所有存在的边数据，而不仅仅是关系类型
  labelMode: RelationshipLabelMode;
  onSave: (edgeId: string, newRelationshipType: string, isSimpleLabel?: boolean) => void;
  isNewRelation?: boolean; // 添加是否为新关系的标志
}

const EdgeEditModal: React.FC<EdgeEditModalProps> = ({
  isOpen,
  onClose,
  edgeId,
  relationshipType,
  existingEdges,
  labelMode,
  onSave,
  isNewRelation = false
}) => {
  // Reference to input for auto-focus
  const inputRef = useRef<HTMLIonSearchbarElement>(null);
  const [relationType, setRelationType] = useState(relationshipType);
  const [searchText, setSearchText] = useState(relationshipType);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showFullType, setShowFullType] = useState(false); // 控制是否显示完整类型

  // 获取当前正在编辑的边
  const currentEdge = useMemo(() => {
    return existingEdges.find(e => e.id === edgeId);
  }, [existingEdges, edgeId]);

  // 获取所有现有的关系类型（去重）- 使用useMemo来避免每次渲染都重新计算
  const existingRelationshipTypes = useMemo(() => {
    return [...new Set(existingEdges.map(edge => edge.relationshipType))];
  }, [existingEdges]);

  // 根据关系类型查找对应的边，返回第一个匹配的边 - 使用useCallback而不是useMemo
  const findEdgeByRelationType = useCallback((type: string): GraphEdge | undefined => {
    return existingEdges.find(e => e.relationshipType === type);
  }, [existingEdges]);

  // Get the appropriate label based on the label mode - 使用useCallback而不是useMemo
  const getLabelPreview = useCallback((type: string): string => {
    // 先查找同类型的边，获取其shortLabel
    const matchingEdge = findEdgeByRelationType(type);
    const shortLabel = matchingEdge?.metadata?.shortLabel

    switch (labelMode) {
      case RelationshipLabelMode.SIMPLE:
        // 优先使用找到的shortLabel，没有则使用默认逻辑
        return shortLabel || type.substring(0, type.charAt(0).toLowerCase() === 'b' ? 2 : 1).toUpperCase();
      case RelationshipLabelMode.FULL:
        return type;
      case RelationshipLabelMode.NONE:
      default:
        return '(不显示)';
    }
  }, [labelMode, findEdgeByRelationType, currentEdge]);

  // Auto-focus the input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 使用多次尝试的方式确保聚焦成功
      const focusAttempts = [50, 150, 300];
      
      focusAttempts.forEach(delay => {
        setTimeout(() => {
          inputRef.current?.setFocus();
        }, delay);
      });
    }
    // Reset states when modal opens with new edge
    setRelationType(relationshipType);
    
    // 根据标签模式决定初始显示的内容
    if (labelMode === RelationshipLabelMode.SIMPLE && !showFullType) {
      setSearchText(getLabelPreview(relationshipType));
    } else {
      setSearchText(relationshipType);
    }
  }, [isOpen, relationshipType, labelMode, showFullType, getLabelPreview]);

  // Update filtered suggestions when search text changes
  useEffect(() => {
    if (searchText.trim() !== '') {
      let filtered: string[];
      
      if (showFullType || labelMode === RelationshipLabelMode.FULL) {
        // 完整模式下，根据输入过滤关系类型
        filtered = existingRelationshipTypes.filter(
          type => type.toLowerCase().includes(searchText.toLowerCase())
        );
      } else {
        // 简洁模式下，转换为简洁形式后再比较
        filtered = existingRelationshipTypes.filter(type => {
          const simpleLabel = getLabelPreview(type);
          return simpleLabel.toLowerCase().includes(searchText.toLowerCase());
        });
      }
      
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchText, existingRelationshipTypes, showFullType, labelMode, getLabelPreview]);

  const handleSave = () => {
    // 根据当前显示模式确定要保存的值
    if (labelMode === RelationshipLabelMode.SIMPLE && !showFullType) {
      // 简洁模式：保存用户输入的简短标签，并标记为简洁模式
      const valueToSave = searchText.trim();
      if (valueToSave !== '') {
        onSave(edgeId, valueToSave, true);
        onClose();
      }
    } else {
      // 完整模式：保存完整的关系类型
      const valueToSave = relationType.trim();
      if (valueToSave !== '') {
        onSave(edgeId, valueToSave, false);
        onClose();
      }
    }
  };
  
  // Save on Enter key press if suggestions are not shown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const handleSearchInput = (e: CustomEvent) => {
    const value = e.detail.value || '';
    setSearchText(value);
    
    // 在简洁模式下与完整模式处理不同
    if (labelMode === RelationshipLabelMode.SIMPLE && !showFullType) {
      // 简洁模式：直接使用输入的值作为简洁标签
      setRelationType(value);
    } else {
      // 完整模式：直接使用输入值作为完整关系类型
      setRelationType(value);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setRelationType(suggestion);
    
    // 根据当前显示模式设置搜索文本
    if (labelMode === RelationshipLabelMode.SIMPLE && !showFullType) {
      setSearchText(getLabelPreview(suggestion));
    } else {
      setSearchText(suggestion);
    }
    
    setShowSuggestions(false);
    // 多次尝试聚焦，确保成功
    const focusAttempts = [50, 150, 300];
    focusAttempts.forEach(delay => {
      setTimeout(() => {
        inputRef.current?.setFocus();
      }, delay);
    });
  };

  // 切换显示模式
  const toggleDisplayMode = () => {
    const newShowFullType = !showFullType;
    setShowFullType(newShowFullType);
    
    // 更新搜索框内容
    if (newShowFullType || labelMode === RelationshipLabelMode.FULL) {
      setSearchText(relationType);
    } else {
      setSearchText(getLabelPreview(relationType));
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="edge-edit-modal" onDidPresent={() => {
      // 在模态框打开完成后也尝试聚焦
      inputRef.current?.setFocus();
    }}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isNewRelation ? '添加自定义关系' : '编辑关系'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>取消</IonButton>
            <IonButton strong={true} onClick={handleSave}>
              {isNewRelation ? '添加' : '保存'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ padding: '10px 5px' }}>
          {labelMode === RelationshipLabelMode.SIMPLE && (
            <IonItem lines="none" className="display-toggle">
              <IonLabel>显示完整关系类型</IonLabel>
              <IonToggle 
                checked={showFullType}
                onIonChange={toggleDisplayMode}
                slot="end"
              />
            </IonItem>
          )}
          
          <IonSearchbar
            ref={inputRef}
            value={searchText}
            onIonInput={handleSearchInput}
            onKeyDown={handleKeyDown}
            placeholder={showFullType ? "完整关系类型名称" : "关系类型名称"}
            debounce={100}
            animated
            showCancelButton="never"
          />

          {showSuggestions && (
            <IonList className="suggestions-list">
              <IonListHeader>
                <IonLabel>已有关系类型</IonLabel>
              </IonListHeader>
              {filteredSuggestions.map((suggestion, index) => (
                <IonItem 
                  key={index} 
                  button 
                  onClick={() => selectSuggestion(suggestion)}
                  detail={false}
                >
                  <IonLabel>{showFullType ? suggestion : getLabelPreview(suggestion)}</IonLabel>
                  <IonLabel slot="end" className="label-preview">
                    {!showFullType ? suggestion : getLabelPreview(suggestion)}
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default EdgeEditModal; 