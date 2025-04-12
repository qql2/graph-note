import React, { useEffect, useRef } from 'react';
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
  IonInput 
} from '@ionic/react';
import './NodeEditModal.css';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeLabel: string;
  onSave: (nodeId: string, newLabel: string) => void;
}

const NodeEditModal: React.FC<NodeEditModalProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeLabel,
  onSave
}) => {
  // Reference to input for auto-focus
  const inputRef = useRef<HTMLIonInputElement>(null);
  const [label, setLabel] = React.useState(nodeLabel);

  // Auto-focus the input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure the modal is fully rendered
      setTimeout(() => {
        inputRef.current?.setFocus();
      }, 150);
    }
    // Reset label state when modal opens with new node
    setLabel(nodeLabel);
  }, [isOpen, nodeLabel]);

  const handleSave = () => {
    if (label.trim() !== '') {
      onSave(nodeId, label.trim());
      onClose();
    }
  };
  
  // Save on Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="node-edit-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>编辑节点</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>取消</IonButton>
            <IonButton strong={true} onClick={handleSave}>
              保存
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="stacked">节点名称</IonLabel>
          <IonInput
            ref={inputRef}
            value={label}
            onIonInput={(e) => setLabel(e.detail.value || '')}
            onKeyDown={handleKeyDown}
            placeholder="请输入节点名称"
            clearInput
          />
        </IonItem>
      </IonContent>
    </IonModal>
  );
};

export default NodeEditModal; 