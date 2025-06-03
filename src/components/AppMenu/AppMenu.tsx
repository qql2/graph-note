import React, { FC } from 'react';
import './AppMenu.css';
import { IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
         IonList, IonItem, IonButton, IonLabel} from '@ionic/react';
import DataManagement from '../DataManagement';

interface AppMenuProps {
  onCreateNode?: () => void; // Add callback for creating a new node
  onSearch?: () => void; // Add callback for searching nodes and edges
  onImportSuccess?: () => void; // Add callback for import success
  onCheckDbStatus?: () => void; // 添加检查数据库状态的回调
  onCommitTransaction?: () => void; // 添加手动提交事务的回调
  developerMode?: boolean; // 是否启用开发者模式
}

const AppMenu: FC<AppMenuProps> = ({ 
  onCreateNode, 
  onSearch, 
  onImportSuccess, 
  onCheckDbStatus, 
  onCommitTransaction,
  developerMode = false 
}) => {
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

  const handleSearch = () => {
    closeMenu();
    if (onSearch) {
      onSearch();
    }
  };

  // 添加处理检查数据库状态的函数
  const handleCheckDbStatus = () => {
    closeMenu();
    if (onCheckDbStatus) {
      onCheckDbStatus();
    }
  };

  // 添加处理手动提交事务的函数
  const handleCommitTransaction = () => {
    closeMenu();
    if (onCommitTransaction) {
      onCommitTransaction();
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
          <IonItem onClick={handleSearch}>
            <IonButton size="default" expand="full">搜索节点和关系</IonButton>
          </IonItem>
          
          {/* 开发者选项 - 只在开发者模式启用时显示 */}
          {developerMode && (
            <>
              {/* 调试工具 */}
              <IonItem>
                <IonLabel>数据库调试工具</IonLabel>
              </IonItem>
              <IonItem onClick={handleCheckDbStatus}>
                <IonButton size="default" expand="full" color="warning">检查数据库状态</IonButton>
              </IonItem>
              <IonItem onClick={handleCommitTransaction}>
                <IonButton size="default" expand="full" color="danger">手动提交事务</IonButton>
              </IonItem>
              {/* 导航链接 */}
              <IonItem>
                <IonLabel>开发者页面</IonLabel>
              </IonItem>
              <IonItem onClick={closeMenu}>
                <IonButton size="default" routerLink="/users" expand="full">Managing Users</IonButton>
              </IonItem>
              <IonItem onClick={closeMenu}>
                <IonButton size="default" routerLink="/graph-demo" expand="full">Graph Database Demo</IonButton>
              </IonItem>
              <IonItem onClick={closeMenu}>
                <IonButton size="default" routerLink="/database-management" expand="full">Database Management</IonButton>
              </IonItem>
            </>
          )}
          
          <IonItem onClick={closeMenu}>
            <IonButton size="default" routerLink="/graph-view-demo" expand="full">Graph View Demo</IonButton>
          </IonItem>
          
          {/* 数据导入导出部分 */}
          <IonItem>
            <IonLabel>数据管理</IonLabel>
          </IonItem>
          <div style={{ padding: '0 16px' }}>
            <DataManagement onImportSuccess={onImportSuccess} />
          </div>
        </IonList>
      </IonContent>
    </IonMenu>
  )
};
export default AppMenu;
