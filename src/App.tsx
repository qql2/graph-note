import React, { useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact, useIonAlert, useIonToast } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Home from './pages/Home';
import { Capacitor } from '@capacitor/core';
import SqliteService from './services/sqliteService';
import DbVersionService from './services/dbVersionService';
import StorageService  from './services/storageService';
import AppInitializer from './components/AppInitializer/AppInitializer';
import graphDatabaseService from './services/graph-database/GraphDatabaseService';

import UsersPage from './pages/UsersPage/UsersPage';
import GraphDBDemo from './pages/GraphDBDemo';
import GraphViewDemo from './pages/GraphViewDemo';
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


setupIonicReact();

const App: React.FC = () => {
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();

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
                
                // 通过URL参数传递新创建的节点ID
                window.location.href = `/graph-view-demo?node=${nodeId}`;
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

  return (
    <SqliteServiceContext.Provider value={SqliteService}>
      <DbVersionServiceContext.Provider value={DbVersionService}>
        <StorageServiceContext.Provider value={new StorageService(SqliteService,DbVersionService)}>
          <AppInitializer>
            <IonApp>
              <IonReactRouter>
                <AppMenu onCreateNode={handleCreateNode} />
                <IonRouterOutlet id="main-content">
                  <Route exact path="/home">
                    <Home />
                  </Route>
                  <Route exact path="/">
                    <Redirect to="/home" />
                  </Route>
                  <Route path="/users" component={UsersPage} />
                  <Route path="/graph-demo" component={GraphDBDemo} />
                  <Route path="/graph-view-demo" component={GraphViewDemo} />
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
