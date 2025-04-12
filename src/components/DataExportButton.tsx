import React, { useState } from 'react';
import { IonButton, IonIcon, IonToast, IonLoading } from '@ionic/react';
import { downloadOutline } from 'ionicons/icons';
import { graphDatabaseService } from '../services/graph-database';

const DataExportButton: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleExport = async () => {
    setExporting(true);
    try {
      // 获取数据库实例
      const db = graphDatabaseService.getDatabase();
      
      // 导出数据
      const jsonData = await db.exportToJson({
        prettyPrint: true,
        includeMetadata: true
      });
      
      // 创建Blob和下载链接
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // 创建下载元素
      const a = document.createElement('a');
      a.href = url;
      a.download = `graph-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // 显示成功消息
      setShowSuccess(true);
    } catch (error) {
      console.error('Export failed:', error);
      setErrorMessage((error as Error).message || '导出失败');
      setShowError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <IonButton 
        onClick={handleExport} 
        disabled={exporting}
        fill="clear"
      >
        <IonIcon slot="start" icon={downloadOutline} />
        导出数据
      </IonButton>
      
      {/* 加载指示器 */}
      <IonLoading 
        isOpen={exporting} 
        message="正在导出数据..."
      />
      
      {/* 成功提示 */}
      <IonToast
        isOpen={showSuccess}
        onDidDismiss={() => setShowSuccess(false)}
        message="数据导出成功"
        duration={2000}
        position="bottom"
        color="success"
      />
      
      {/* 错误提示 */}
      <IonToast
        isOpen={showError}
        onDidDismiss={() => setShowError(false)}
        message={`导出失败: ${errorMessage}`}
        duration={3000}
        position="bottom"
        color="danger"
      />
    </>
  );
};

export default DataExportButton; 