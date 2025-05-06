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
import { GraphNode, GraphEdge, CommonRelationshipTypes, QuadrantConfig, defaultQuadrantConfig } from '../../models/GraphNode';
import { GraphLayoutService } from '../../services/GraphLayoutService';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeLabel: string;
  existingNodes: GraphNode[]; // 所有现有的节点
  existingEdges: GraphEdge[]; // 所有现有的边，用于构建节点间的父子关系
  isNewNode?: boolean; // 是否为新建节点
  relationType?: string; // 关系类型，用于创建新节点时
  sourceNodeId?: string; // 源节点ID，用于创建新节点时
  quadrantConfig?: QuadrantConfig; // 四象限配置，用于判断关系方向
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
  existingEdges = [], // 默认为空数组
  isNewNode = false,
  relationType,
  sourceNodeId,
  quadrantConfig = defaultQuadrantConfig, // 默认使用默认配置
  onSave
}) => {
  // Reference to input for auto-focus
  const inputRef = useRef<HTMLIonSearchbarElement>(null);
  const labelRef = useRef(nodeLabel);
  const [searchText, setSearchText] = useState(nodeLabel);
  // TODO: (AI请勿擅自实现) 现阶段同名就是非独立节点, 可以用非独立节点那套注释前缀法
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<NodeWithPath[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeWithPath | null>(null);

  // 准备带有路径的节点列表，用于区分同名节点
  const nodesWithPath = useMemo(() => {
    // 创建节点之间的父子关系映射
    const nodeParents: Record<string, string[]> = {};
    
    // 初始化节点父子关系映射
    existingNodes.forEach(node => {
      nodeParents[node.id] = [];
    });
    
    // 从边数据构建父子关系，考虑关系的方向性
    existingEdges.forEach(edge => {
      if (edge.source && edge.target && edge.relationshipType) {
        // 避免自环
        if (edge.source !== edge.target) {
          // 判断关系的方向性
          // TODO: (AI请勿擅自实现或修改)未来可以统一定义一个API, 可以把隐式关系类型也考虑进来获取关联节点
          const oppositeType = GraphLayoutService.getOppositeRelationType(edge.relationshipType, quadrantConfig.relationshipTypeConfig);
          
          
          if (oppositeType === CommonRelationshipTypes.FATHER) {
            // source是父节点，target是子节点
            nodeParents[edge.target].push(edge.source);
          } else if (edge.relationshipType === CommonRelationshipTypes.FATHER) {
            // source是子节点，target是父节点
            nodeParents[edge.source].push(edge.target);
          }
        }
      }
    });
    
    // 辅助函数：递归获取节点的路径（包括父节点链）
    const getNodePath = (nodeId: string, depth: number = 0, visited: Set<string> = new Set()): string => {
      // 防止无限递归和设置最大深度
      if (visited.has(nodeId) || depth > 5) {
        return existingNodes.find(n => n.id === nodeId)?.label || nodeId;
      }
      
      visited.add(nodeId);
      
      const node = existingNodes.find(n => n.id === nodeId);
      if (!node) return nodeId;
      
      // 获取同名节点
      const sameNameNodes = existingNodes.filter(n => 
        n.label === node.label && 
        n.id !== node.id && 
        n.id !== nodeId
      );
      
      // 如果没有同名节点，直接返回节点标签
      if (sameNameNodes.length === 0) {
        return node.label;
      }
      
      // 如果有同名节点，尝试使用父节点链来修饰
      if (nodeParents[nodeId] && nodeParents[nodeId].length > 0) {
        // 遍历所有父节点，找到一个合适的
        for (const parentId of nodeParents[nodeId]) {
          const parent = existingNodes.find(n => n.id === parentId);
          if (!parent) continue;
          
          // 递归获取父节点的路径
          const parentPath = getNodePath(parentId, depth + 1, new Set([...visited]));
          
          return `${node.label} (${parentPath})`;
        }
      }
      
      // 如果没有父节点或无法确定父节点，使用ID的前缀作为区分
      return `${node.label} (ID: ${nodeId.substring(0, 6)}...)`;
    };

    // 为每个节点生成路径
    const result: NodeWithPath[] = existingNodes.map(node => {
      // 对当前编辑的节点跳过
      if (node.id === nodeId) return { id: node.id, label: node.label, path: node.label };
      
      // 获取节点的完整路径（包括递归向上的父节点链）
      const path = getNodePath(node.id);
      
      return {
        id: node.id,
        label: node.label,
        path: path
      };
    });
    
    return result;
  }, [existingNodes, existingEdges, nodeId, quadrantConfig]);

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
    // Reset states when modal opens with new node
    labelRef.current = nodeLabel;
    setSearchText(nodeLabel);
    setSelectedNode(null);
  }, [isOpen, nodeLabel]);

  useEffect(() => {
    // 过滤建议
    if (searchText.trim() !== '') {
      const filtered = nodesWithPath.filter(
        node => node.id !== nodeId && 
               (node.label.includes(searchText))
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
        } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchText]);
  // 处理搜索输入变化
  const handleSearchInput = (e: any) => {
    const value = e.detail.value || '';
    setSearchText(value);
    labelRef.current = value;
  };

  // 选择建议
  const selectSuggestion = (node: NodeWithPath) => {
    setSearchText(node.path);
    labelRef.current = node.label;
    setSelectedNode(node);
    setShowSuggestions(false);
    
    // 多次尝试聚焦，确保成功
    const focusAttempts = [50, 150, 300];
    focusAttempts.forEach(delay => {
      setTimeout(() => {
        inputRef.current?.setFocus();
      }, delay);
    });
  };

  const handleSave = () => {
    if (labelRef.current.trim() !== '') {
      if (selectedNode) {
        // 如果选择了现有节点，传递目标节点ID
        onSave(nodeId, labelRef.current.trim(), selectedNode.id);
      } else {
        // 正常编辑/创建节点
        onSave(nodeId, labelRef.current.trim());
      }
      onClose();
    }
  };
  
  // Save on Enter key press if suggestions are not shown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="node-edit-modal" onDidPresent={() => {
      // 在模态框打开完成后也尝试聚焦
      inputRef.current?.setFocus();
    }}>
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
            onKeyUp={handleKeyDown}
            placeholder="输入节点名称"
            debounce={100}
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