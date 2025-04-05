import React, { useState } from 'react';
import { 
  IonContent, 
  IonHeader, 
  IonPage, 
  IonTitle, 
  IonToolbar,
  IonButton,
  IonButtons,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonLabel,
  IonToast,
  IonIcon
} from '@ionic/react';
import { refreshOutline, arrowBack } from 'ionicons/icons';
import GraphView from '../components/GraphView';
import { GraphData, GraphNode, GraphEdge, RelationshipType, QuadrantConfig, defaultQuadrantConfig } from '../models/GraphNode';
import './GraphViewDemo.css';

// Demo data
const generateDemoData = (): GraphData => {
  // Create some nodes
  const nodes: GraphNode[] = [
    { id: 'center', label: 'Central Concept' },
    { id: 'father1', label: 'Father 1' },
    { id: 'father2', label: 'Father 2' },
    { id: 'child1', label: 'Child 1' },
    { id: 'child2', label: 'Child 2' },
    { id: 'child3', label: 'Child 3' },
    { id: 'base1', label: 'Base 1' },
    { id: 'base2', label: 'Base 2' },
    { id: 'build1', label: 'Build 1' },
    { id: 'build2', label: 'Build 2' },
    { id: 'build3', label: 'Build 3' },
  ];

  // Create edges with relationship types
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'center', target: 'father1', relationshipType: RelationshipType.FATHER },
    { id: 'e2', source: 'center', target: 'father2', relationshipType: RelationshipType.FATHER },
    { id: 'e3', source: 'center', target: 'child1', relationshipType: RelationshipType.CHILD },
    { id: 'e4', source: 'center', target: 'child2', relationshipType: RelationshipType.CHILD },
    { id: 'e5', source: 'child3', target: 'center', relationshipType: RelationshipType.FATHER },
    { id: 'e6', source: 'center', target: 'base1', relationshipType: RelationshipType.BASE },
    { id: 'e7', source: 'center', target: 'base2', relationshipType: RelationshipType.BASE },
    { id: 'e8', source: 'center', target: 'build1', relationshipType: RelationshipType.BUILD },
    { id: 'e9', source: 'center', target: 'build2', relationshipType: RelationshipType.BUILD },
    { id: 'e10', source: 'center', target: 'build3', relationshipType: RelationshipType.BUILD },
  ];

  return { nodes, edges };
};

const GraphViewDemo: React.FC = () => {
  const [graphData] = useState<GraphData>(generateDemoData());
  const [centralNodeId, setCentralNodeId] = useState<string>('center');
  const [quadrantConfig, setQuadrantConfig] = useState<QuadrantConfig>(defaultQuadrantConfig);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Handle node click to change the central node
  const handleNodeClick = (nodeId: string) => {
    setCentralNodeId(nodeId);
    setToastMessage(`Focused on node: ${nodeId}`);
    setShowToast(true);
  };

  // Handle quadrant configuration changes
  const handleQuadrantChange = (position: keyof QuadrantConfig, value: RelationshipType) => {
    setQuadrantConfig({
      ...quadrantConfig,
      [position]: value
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton routerLink="/home">
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Graph View Demo</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setCentralNodeId('center')}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="graph-controls">
          <h4>Quadrant Configuration</h4>
          <div className="quadrant-config">
            <IonItem>
              <IonLabel>Top</IonLabel>
              <IonSelect 
                value={quadrantConfig.top} 
                onIonChange={e => handleQuadrantChange('top', e.detail.value as RelationshipType)}
              >
                <IonSelectOption value={RelationshipType.FATHER}>Father</IonSelectOption>
                <IonSelectOption value={RelationshipType.CHILD}>Child</IonSelectOption>
                <IonSelectOption value={RelationshipType.BASE}>Base</IonSelectOption>
                <IonSelectOption value={RelationshipType.BUILD}>Build</IonSelectOption>
              </IonSelect>
            </IonItem>
            
            <IonItem>
              <IonLabel>Bottom</IonLabel>
              <IonSelect 
                value={quadrantConfig.bottom} 
                onIonChange={e => handleQuadrantChange('bottom', e.detail.value as RelationshipType)}
              >
                <IonSelectOption value={RelationshipType.FATHER}>Father</IonSelectOption>
                <IonSelectOption value={RelationshipType.CHILD}>Child</IonSelectOption>
                <IonSelectOption value={RelationshipType.BASE}>Base</IonSelectOption>
                <IonSelectOption value={RelationshipType.BUILD}>Build</IonSelectOption>
              </IonSelect>
            </IonItem>
            
            <IonItem>
              <IonLabel>Left</IonLabel>
              <IonSelect 
                value={quadrantConfig.left} 
                onIonChange={e => handleQuadrantChange('left', e.detail.value as RelationshipType)}
              >
                <IonSelectOption value={RelationshipType.FATHER}>Father</IonSelectOption>
                <IonSelectOption value={RelationshipType.CHILD}>Child</IonSelectOption>
                <IonSelectOption value={RelationshipType.BASE}>Base</IonSelectOption>
                <IonSelectOption value={RelationshipType.BUILD}>Build</IonSelectOption>
              </IonSelect>
            </IonItem>
            
            <IonItem>
              <IonLabel>Right</IonLabel>
              <IonSelect 
                value={quadrantConfig.right} 
                onIonChange={e => handleQuadrantChange('right', e.detail.value as RelationshipType)}
              >
                <IonSelectOption value={RelationshipType.FATHER}>Father</IonSelectOption>
                <IonSelectOption value={RelationshipType.CHILD}>Child</IonSelectOption>
                <IonSelectOption value={RelationshipType.BASE}>Base</IonSelectOption>
                <IonSelectOption value={RelationshipType.BUILD}>Build</IonSelectOption>
              </IonSelect>
            </IonItem>
          </div>
        </div>
        
        <div className="graph-view-demo-container">
          <GraphView 
            graphData={graphData} 
            centralNodeId={centralNodeId} 
            quadrantConfig={quadrantConfig}
            onNodeClick={handleNodeClick} 
          />
        </div>
        
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

export default GraphViewDemo; 