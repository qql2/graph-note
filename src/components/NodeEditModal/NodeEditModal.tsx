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
  IonSearchbar,
  IonList,
  IonListHeader
} from '@ionic/react';
import './NodeEditModal.css';
import { GraphNode } from '../../models/GraphNode';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeLabel: string;
  existingNodes: GraphNode[]; // 所有现有的节点
  isNewNode?: boolean; // 是否为新建节点
  relationType?: string; // 关系类型，用于创建新节点时
  sourceNodeId?: string; // 源节点ID，用于创建新节点时
  onSave: (nodeId: string, newLabel: string, targetNodeId?: string) => void; // 添加targetNodeId参数用于处理合并节点
}

interface NodeWithPath {
  id: string;
  label: string;
  path: string; // 包含父节点路径的完整标识
}

const NodeEditModal: React.FC<NodeEditModalProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeLabel,
  existingNodes,
  isNewNode = false,
  relationType,
  sourceNodeId,
  onSave
}) => {
  // Reference to input for auto-focus
  const inputRef = useRef<HTMLIonSearchbarElement>(null);
  const [label, setLabel] = useState(nodeLabel);
  const [searchText, setSearchText] = useState(nodeLabel);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<NodeWithPath[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeWithPath | null>(null);

  // 准备带有路径的节点列表，用于区分同名节点
  const nodesWithPath = useMemo(() => {
    // 创建一个映射，键为节点ID，值为该节点的所有父节点ID
    const nodeParents: Record<string, string[]> = {};
    
    // 根据边建立父子关系
    existingNodes.forEach(node => {
      nodeParents[node.id] = [];
    });

    // 为每个节点生成路径
    const result: NodeWithPath[] = existingNodes.map(node => {
      // 对当前编辑的节点跳过
      if (node.id === nodeId) return { id: node.id, label: node.label, path: node.label };
      
      // 查找该节点的路径信息
      let path = node.label;
      
      // 查找与当前节点同名的节点
      const sameNameNodes = existingNodes.filter(n => 
        n.label === node.label && n.id !== node.id && n.id !== nodeId
      );
      
      // 如果有同名节点，添加区分信息
      if (sameNameNodes.length > 0) {
        // 查找父节点信息，这里需要从边的关系中获取
        // 由于我们没有直接传入边的信息，这里简化处理，使用父节点ID作为区分
        if (nodeParents[node.id] && nodeParents[node.id].length > 0) {
          const parentId = nodeParents[node.id][0];
          const parent = existingNodes.find(n => n.id === parentId);
          if (parent) {
            path = `${node.label} (${parent.label})`;
          }
        } else {
          path = `${node.label} (ID: ${node.id.substring(0, 6)}...)`;
        }
      }
      
      return {
        id: node.id,
        label: node.label,
        path: path
      };
    });
    
    return result;
  }, [existingNodes, nodeId]);

  // Auto-focus the input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure the modal is fully rendered
      setTimeout(() => {
        inputRef.current?.setFocus();
      }, 150);
    }
    // Reset states when modal opens with new node
    setLabel(nodeLabel);
    setSearchText(nodeLabel);
    setSelectedNode(null);
  }, [isOpen, nodeLabel]);

  // 处理搜索输入变化
  const handleSearchInput = (e: any) => {
    const value = e.detail.value || '';
    setSearchText(value);
    setLabel(value);
    
    // 过滤建议
    if (value.trim() !== '') {
      const filtered = nodesWithPath.filter(
        node => node.id !== nodeId && 
               (node.label.toLowerCase().includes(value.toLowerCase()) || 
                node.path.toLowerCase().includes(value.toLowerCase()))
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // 选择建议
  const selectSuggestion = (node: NodeWithPath) => {
    setSearchText(node.path);
    setLabel(node.label);
    setSelectedNode(node);
    setShowSuggestions(false);
  };

  const handleSave = () => {
    if (label.trim() !== '') {
      if (selectedNode) {
        // 如果选择了现有节点，传递目标节点ID
        onSave(nodeId, label.trim(), selectedNode.id);
      } else {
        // 正常编辑/创建节点
        onSave(nodeId, label.trim());
      }
      onClose();
    }
  };
  
  // Save on Enter key press if suggestions are not shown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showSuggestions) {
      handleSave();
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="node-edit-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isNewNode ? '新建节点' : '编辑节点'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>取消</IonButton>
            <IonButton strong={true} onClick={handleSave}>
              {isNewNode ? '创建' : '保存'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ padding: '10px 5px' }}>
          <IonSearchbar
            ref={inputRef}
            value={searchText}
            onIonInput={handleSearchInput}
            onKeyDown={handleKeyDown}
            placeholder="输入节点名称"
            debounce={300}
            animated
            showCancelButton="never"
          />

          {showSuggestions && (
            <IonList className="suggestions-list">
              <IonListHeader>
                <IonLabel>已有节点</IonLabel>
              </IonListHeader>
              {filteredSuggestions.map((node, index) => (
                <IonItem 
                  key={index} 
                  button 
                  onClick={() => selectSuggestion(node)}
                  detail={false}
                >
                  <IonLabel>{node.path}</IonLabel>
                </IonItem>
              ))}
            </IonList>
          )}
          
          {selectedNode && (
            <div className="selected-node-info">
              <IonItem lines="none">
                <IonLabel>
                  <h3>已选择现有节点:</h3>
                  <p>{isNewNode ? '将创建关系到此节点' : '将合并到此节点'}</p>
                </IonLabel>
              </IonItem>
            </div>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default NodeEditModal; 