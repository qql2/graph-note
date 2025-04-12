import React, { useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { cloudUploadOutline } from 'ionicons/icons';
import DataImportModal from './DataImportModal';

const DataImportButton: React.FC = () => {
  const [showImportModal, setShowImportModal] = useState(false);

  return (
    <>
      <IonButton 
        onClick={() => setShowImportModal(true)} 
        fill="clear"
      >
        <IonIcon slot="start" icon={cloudUploadOutline} />
        导入数据
      </IonButton>
      
      <DataImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />
    </>
  );
};

export default DataImportButton; 