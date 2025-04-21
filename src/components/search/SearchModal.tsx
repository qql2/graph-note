import React from 'react';
import { 
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent
} from '@ionic/react';
import { close } from 'ionicons/icons';
import { SearchPanel } from './SearchPanel';
import { GraphNode, GraphEdge } from '../../models/GraphNode';
import './SearchModal.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNode?: (node: GraphNode) => void;
  onSelectEdge?: (edge: GraphEdge) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelectNode,
  onSelectEdge
}) => {
  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={onClose}
      className="search-modal"
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>知识图谱检索</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="search-modal-container">
          <SearchPanel 
            onClose={onClose}
            onSelectNode={onSelectNode}
            onSelectEdge={onSelectEdge}
            isModal={true}
          />
        </div>
      </IonContent>
    </IonModal>
  );
};

export default SearchModal; 