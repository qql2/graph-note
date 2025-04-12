import React, { FC } from 'react';
import './AppMenu.css';
import { IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
         IonList, IonItem, IonButton, IonLabel} from '@ionic/react';
import DataManagement from '../DataManagement';

interface AppMenuProps {
  onCreateNode?: () => void; // Add callback for creating a new node
}

const AppMenu: FC<AppMenuProps> = ({ onCreateNode }) => {
  const closeMenu = () => {
    const menu = document.querySelector('ion-menu');
    menu!.close();
  };

  const handleCreateNode = () => {
    closeMenu();
    if (onCreateNode) {
      onCreateNode();
    }
  };

  return (
    <IonMenu className="AppMenu" side="end" contentId="main-content">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Menu Content</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem onClick={handleCreateNode}>
            <IonButton size="default" expand="full">创建独立节点</IonButton>
          </IonItem>
          <IonItem onClick={closeMenu}>
            <IonButton size="default" routerLink="/users" expand="full">Managing Users</IonButton>
          </IonItem>
          <IonItem onClick={closeMenu}>
            <IonButton size="default" routerLink="/graph-demo" expand="full">Graph Database Demo</IonButton>
          </IonItem>
          <IonItem onClick={closeMenu}>
            <IonButton size="default" routerLink="/graph-view-demo" expand="full">Graph View Demo</IonButton>
          </IonItem>
          {/* 数据导入导出部分 */}
          <IonItem>
            <IonLabel>数据管理</IonLabel>
          </IonItem>
          <div style={{ padding: '0 16px' }}>
            <DataManagement />
          </div>
          {/* ... other menu items */}
        </IonList>
      </IonContent>
    </IonMenu>
  )
};
export default AppMenu;
