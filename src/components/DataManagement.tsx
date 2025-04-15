import React from 'react';
import { IonButtons, IonToolbar } from '@ionic/react';
import DataExportButton from './DataExportButton';
import DataImportButton from './DataImportButton';

interface DataManagementProps {
  onImportSuccess?: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onImportSuccess }) => {
  return (
    <IonToolbar>
      <IonButtons slot="end">
        <DataImportButton onImportSuccess={onImportSuccess} />
        <DataExportButton />
      </IonButtons>
    </IonToolbar>
  );
};

export default DataManagement; 