import React, { useState, useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact, useIonAlert, useIonToast } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Capacitor } from '@capacitor/core';
import SqliteService from './services/sqliteService';
import DbVersionService from './services/dbVersionService';
import StorageService  from './services/storageService';
import AppInitializer from './components/AppInitializer/AppInitializer';
import graphDatabaseService from './services/graph-database/GraphDatabaseService';
import { ThemeService } from './services/ThemeService';
import { ConfigService } from './services/ConfigService';

import UsersPage from './pages/UsersPage/UsersPage';
import GraphDBDemo from './pages/GraphDBDemo';
import GraphViewDemo from './pages/GraphViewDemo';
import SearchPage from './pages/SearchPage';
import AppMenu from './components/AppMenu/AppMenu';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';

export const platform = Capacitor.getPlatform();

// Singleton Services
export const SqliteServiceContext = React.createContext(SqliteService);
export const DbVersionServiceContext = React.createContext(DbVersionService);
export const StorageServiceContext = React.createContext(new StorageService(SqliteService,DbVersionService));

// 定义一个自定义事件名称，用于数据导入成功后通知
export const DATA_IMPORT_SUCCESS_EVENT = 'data-import-success';

setupIonicReact();

const App: React.FC = () => {
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();

  // 初始化主题
  useEffect(() => {
    ThemeService.initTheme();
  }, []);

  // Function to create a new node
  const handleCreateNode = async () => {
    // Initialize the database if not already initialized
    try {
      await graphDatabaseService.initialize({
        dbName: 'graph_demo',
        version: 1,
        verbose: true
      });
      
      const db = graphDatabaseService.getDatabase();
      
      // 加载视图配置
      const viewConfig = ConfigService.loadViewConfig();
      
      // Show dialog to input node label
      presentAlert({
        header: '创建独立节点',
        inputs: [
          {
            name: 'label',
            type: 'text',
            placeholder: '节点名称'
          },
        ],
        buttons: [
          {
            text: '取消',
            role: 'cancel'
          },
          {
            text: '创建',
            handler: async (data) => {
              if (!data.label || data.label.trim() === '') {
                presentToast({
                  message: '节点名称不能为空',
                  duration: 2000,
                  color: 'warning'
                });
                return;
              }
              
              try {
                // Create a new node with the provided label
                const nodeId = await db.addNode({
                  type: 'knowledge',
                  label: data.label.trim()
                });
                
                presentToast({
                  message: `成功创建节点：${data.label}`,
                  duration: 2000,
                  color: 'success'
                });
                
                // 根据配置决定是否自动跳转到新节点
                if (viewConfig.autoFocusNewNode) {
                  // 通过URL参数传递新创建的节点ID，并标记为新节点
                  window.location.href = `/graph-view-demo?node=${nodeId}&new=true`;
                } else {
                  // 如果不自动聚焦，则只跳转到图视图页面，不传递节点ID
                  window.location.href = `/graph-view-demo`;
                }
              } catch (error) {
                console.error('创建节点失败:', error);
                presentToast({
                  message: `创建节点失败: ${error instanceof Error ? error.message : String(error)}`,
                  duration: 3000,
                  color: 'danger'
                });
              }
            }
          }
        ]
      });
    } catch (error) {
      console.error('初始化数据库失败:', error);
      presentToast({
        message: `初始化数据库失败: ${error instanceof Error ? error.message : String(error)}`,
        duration: 3000,
        color: 'danger'
      });
    }
  };

  // 搜索节点和关系
  const handleSearch = () => {
    window.location.href = '/search';
  };

  // 处理数据导入成功
  const handleImportSuccess = () => {
    // 创建并分发一个自定义事件，通知GraphViewDemo页面刷新数据
    const event = new CustomEvent(DATA_IMPORT_SUCCESS_EVENT);
    window.dispatchEvent(event);
  };

  // 添加处理检查数据库状态的函数
  const handleCheckDbStatus = () => {
    // 创建一个新的自定义事件，用于通知当前页面检查数据库状态
    const event = new CustomEvent('check-db-status-event');
    window.dispatchEvent(event);
  };

  // 添加处理手动提交事务的函数
  const handleCommitTransaction = () => {
    // 创建一个新的自定义事件，用于通知当前页面手动提交事务
    const event = new CustomEvent('commit-transaction-event');
    window.dispatchEvent(event);
  };

  return (
    <SqliteServiceContext.Provider value={SqliteService}>
      <DbVersionServiceContext.Provider value={DbVersionService}>
        <StorageServiceContext.Provider value={new StorageService(SqliteService,DbVersionService)}>
          <AppInitializer>
            <IonApp>
              <IonReactRouter>
                <AppMenu 
                  onCreateNode={handleCreateNode} 
                  onSearch={handleSearch}
                  onImportSuccess={handleImportSuccess}
                  onCheckDbStatus={handleCheckDbStatus}
                  onCommitTransaction={handleCommitTransaction}
                />
                <IonRouterOutlet id="main-content">
                  <Route exact path="/">
                    <Redirect to="/graph-view-demo" />
                  </Route>
                  <Route path="/users" component={UsersPage} />
                  <Route path="/graph-demo" component={GraphDBDemo} />
                  <Route path="/graph-view-demo" component={GraphViewDemo} />
                  <Route path="/search" component={SearchPage} />
                </IonRouterOutlet>
              </IonReactRouter>
            </IonApp>
          </AppInitializer>
        </StorageServiceContext.Provider>
      </DbVersionServiceContext.Provider>
    </SqliteServiceContext.Provider>
  )
};

export default App;
