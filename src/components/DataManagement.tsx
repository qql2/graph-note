import React from 'react';
import { IonButtons, IonToolbar } from '@ionic/react';
import DataExportButton from './DataExportButton';
import DataImportButton from './DataImportButton';

const DataManagement: React.FC = () => {
  return (
    <IonToolbar>
      <IonButtons slot="end">
        <DataImportButton />
        <DataExportButton />
      </IonButtons>
    </IonToolbar>
  );
};

export default DataManagement; 