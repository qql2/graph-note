import React, { useEffect, useState } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, useIonToast } from '@ionic/react';
import { SearchPanel } from '../components/search/SearchPanel';
import { useHistory, useLocation } from 'react-router-dom';
import { GraphNode, GraphEdge } from '../models/GraphNode';
import graphDatabaseService from '../services/graph-database/GraphDatabaseService';
import './SearchPage.css';

const SearchPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const [presentToast] = useIonToast();

  // 初始化数据库
  useEffect(() => {
    const initDb = async () => {
      try {
        await graphDatabaseService.initialize({
          dbName: 'graph_demo',
          version: 1,
          verbose: true
        }, 'SearchPage');
      } catch (error) {
        console.error('初始化数据库失败:', error);
        presentToast({
          message: `初始化数据库失败: ${error instanceof Error ? error.message : String(error)}`,
          duration: 3000,
          color: 'danger'
        });
      }
    };

    initDb();
    
    // 组件卸载时注销数据库使用
    return () => {
      
      graphDatabaseService.closeDatabase('SearchPage', false).catch(err => {
        console.error('注销数据库使用失败:', err);
      });
    };
  }, [presentToast]);

  // 处理返回按钮点击
  const handleBack = () => {
    history.push('/home');
  };

  // 处理节点选择
  const handleNodeSelect = (node: GraphNode) => {
    // 跳转到图形视图页面，显示选中的节点
    history.push(`/graph-view-demo?node=${node.id}`);
  };

  // 处理关系选择
  const handleEdgeSelect = (edge: GraphEdge) => {
    // 跳转到图形视图页面，显示关系的源节点
    history.push(`/graph-view-demo?node=${edge.source}`);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton slot="start" fill="clear" onClick={handleBack}>
            返回
          </IonButton>
          <IonTitle>知识图谱检索</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="search-page-container">
          <SearchPanel 
            onClose={handleBack}
            onSelectNode={handleNodeSelect}
            onSelectEdge={handleEdgeSelect}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SearchPage; 