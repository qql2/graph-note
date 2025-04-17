import React, { useState, useRef } from 'react';
import { 
  IonButton, 
  IonIcon, 
  IonToast, 
  IonLoading, 
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonRadioGroup,
  IonRadio,
  IonFooter,
  IonButtons,
  IonText,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle
} from '@ionic/react';
import { cloudUploadOutline, closeOutline } from 'ionicons/icons';
import { graphDatabaseService } from '../services/graph-database';
import { ImportMode, ValidationResult } from '../services/graph-database/core/types';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>(ImportMode.MERGE);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importStats, setImportStats] = useState<{ nodes: number, edges: number } | null>(null);
  const [showDetailedErrors, setShowDetailedErrors] = useState(false);
  const [detailedErrors, setDetailedErrors] = useState<string[]>([]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      
      // 验证文件
      try {
        // 读取文件内容
        const fileContent = await readFileContent(file);
        
        // 验证数据
        const db = graphDatabaseService.getDatabase('DataImportModal');
        const result = await db.validateImportData(fileContent);
        setValidationResult(result);
        
        if (!result.valid) {
			setErrorMessage(`文件验证失败: ${result.errors.join(', ')}`);
			console.error(result.errors.join(', '));
          setShowError(true);
        }
      } catch (error) {
        console.error('File validation error:', error);
        setErrorMessage(`文件读取失败: ${(error as Error).message}`);
        setShowError(true);
        setSelectedFile(null);
      }
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === 'string') {
          resolve(e.target.result);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setErrorMessage('请先选择文件');
      setShowError(true);
      return;
    }

    setImporting(true);
    setDetailedErrors([]);
    setShowDetailedErrors(false);
    
    try {
      // 读取文件内容
      const fileContent = await readFileContent(selectedFile);
      
      // 导入数据
      const db = graphDatabaseService.getDatabase('DataImportModal');
      const result = await db.importFromJson(fileContent, importMode);
      
      if (result.success) {
        setImportStats({
          nodes: result.nodesImported,
          edges: result.edgesImported
        });
        setShowSuccess(true);
        
        if (onImportSuccess) {
          onImportSuccess();
        }
        
        // 清理状态并关闭对话框
        setTimeout(() => {
          resetForm();
          onClose();
        }, 2000);
      } else {
        if (result.errors && result.errors.length > 0) {
          // 设置详细错误信息
          setDetailedErrors(result.errors);
          
          // 简短的错误摘要
          const errorSummary = `导入失败: 发现 ${result.errors.length} 个错误`;
          setErrorMessage(errorSummary);
          
          // 显示详细错误信息
          setShowDetailedErrors(true);
        } else {
          setErrorMessage(`导入失败: 未知错误`);
        }
        
        setShowError(true);
        console.error("Import errors:", result.errors);
      }
    } catch (error) {
      console.error('Import failed:', error);
      setErrorMessage(`导入失败: ${(error as Error).message}`);
      setShowError(true);
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setImportStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>导入数据</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={onClose}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          <div style={{ padding: '16px' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              style={{ display: 'none' }}
            />
            
            <IonButton 
              expand="block" 
              onClick={triggerFileInput}
              disabled={importing}
            >
              <IonIcon slot="start" icon={cloudUploadOutline} />
              选择JSON文件
            </IonButton>
            
            {selectedFile && (
              <div style={{ margin: '16px 0' }}>
                <IonText>
                  <p>已选择: {selectedFile.name}</p>
                </IonText>
                
                {validationResult && validationResult.valid && (
                  <IonText color="success">
                    <p>
                      文件有效，包含 {validationResult.nodeCount} 个节点和 
                      {validationResult.edgeCount} 个关系
                    </p>
                  </IonText>
                )}
              </div>
            )}
            
            {/* 显示详细错误信息 */}
            {showDetailedErrors && detailedErrors.length > 0 && (
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>导入错误</IonCardTitle>
                  <IonCardSubtitle>发现 {detailedErrors.length} 个错误</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonList>
                    {detailedErrors.map((error, index) => (
                      <IonItem key={index}>
                        <IonText color="danger">
                          <p>{error}</p>
                        </IonText>
                      </IonItem>
                    ))}
                  </IonList>
                </IonCardContent>
              </IonCard>
            )}
            
            <IonList>
              <IonRadioGroup value={importMode} onIonChange={e => setImportMode(e.detail.value)}>
                <IonItem>
                  <IonLabel>
                    <h2>合并模式</h2>
                    <p>将导入数据与现有数据合并</p>
                  </IonLabel>
                  <IonRadio slot="start" value={ImportMode.MERGE} />
                </IonItem>
                
                <IonItem>
                  <IonLabel>
                    <h2>替换模式</h2>
                    <p>清空当前数据后导入新数据</p>
                  </IonLabel>
                  <IonRadio slot="start" value={ImportMode.REPLACE} />
                </IonItem>
              </IonRadioGroup>
            </IonList>
          </div>
        </IonContent>
        
        <IonFooter>
          <IonToolbar>
            <IonButtons slot="end">
              <IonButton onClick={onClose}>取消</IonButton>
              <IonButton 
                strong 
                onClick={handleImport} 
                disabled={!selectedFile || importing || (validationResult ? !validationResult.valid : true)}
              >
                导入
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonFooter>
      </IonModal>
      
      {/* 加载指示器 */}
      <IonLoading 
        isOpen={importing} 
        message="正在导入数据..."
      />
      
      {/* 成功提示 */}
      <IonToast
        isOpen={showSuccess}
        onDidDismiss={() => setShowSuccess(false)}
        message={`数据导入成功，已导入 ${importStats?.nodes || 0} 个节点和 ${importStats?.edges || 0} 个关系`}
        duration={2000}
        position="bottom"
        color="success"
      />
      
      {/* 错误提示 */}
      <IonToast
        isOpen={showError}
        onDidDismiss={() => setShowError(false)}
        message={errorMessage}
        duration={3000}
        position="bottom"
        color="danger"
      />
    </>
  );
};

export default DataImportModal; 