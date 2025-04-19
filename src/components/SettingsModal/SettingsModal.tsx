import React, { useState, useEffect } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonRange,
  IonList,
  IonRadioGroup,
  IonRadio,
  IonListHeader,
  IonAlert,
  IonToggle
} from '@ionic/react';
import { close, refresh, sunny, moon, contrast } from 'ionicons/icons';
import { 
  QuadrantConfig, 
  DepthConfig, 
  ViewConfig, 
  QuadrantPosition, 
  CommonRelationshipTypes,
  RelationshipLabelMode,
  RelationshipTypeConfig,
  defaultQuadrantConfig,
  defaultDepthConfig,
  defaultViewConfig,
  defaultRelationshipTypeConfig
} from '../../models/GraphNode';
import { ThemeService, ThemeMode } from '../../services/ThemeService';
import RelationshipConfig from '../RelationshipConfig';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quadrantConfig: QuadrantConfig;
  depthConfig: DepthConfig;
  viewConfig: ViewConfig;
  relationshipTypeConfig: RelationshipTypeConfig;
  knownRelationshipTypes: string[];
  onQuadrantChange: (position: QuadrantPosition, value: string[]) => void;
  onDepthChange: (relationshipType: string, value: number) => void;
  onRelationshipLabelModeChange: (value: RelationshipLabelMode) => void;
  onAutoFocusNewNodeChange: (value: boolean) => void;
  onUnconfiguredPositionChange: (position: QuadrantPosition) => void;
  onRelationshipTypeConfigChange: (newConfig: RelationshipTypeConfig) => void;
  onResetAllConfigs: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  quadrantConfig,
  depthConfig,
  viewConfig,
  relationshipTypeConfig,
  knownRelationshipTypes,
  onQuadrantChange,
  onDepthChange,
  onRelationshipLabelModeChange,
  onAutoFocusNewNodeChange,
  onUnconfiguredPositionChange,
  onRelationshipTypeConfigChange,
  onResetAllConfigs
}) => {
  // 显示确认对话框的状态
  const [showAlert, setShowAlert] = useState(false);
  const [alertHeader, setAlertHeader] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmHandler, setConfirmHandler] = useState<() => void>(() => {});
  
  // 当前主题模式
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(ThemeService.getCurrentTheme());

  // 显示确认对话框
  const showConfirmDialog = (header: string, message: string, onConfirm: () => void) => {
    setAlertHeader(header);
    setAlertMessage(message);
    setConfirmHandler(() => onConfirm);
    setShowAlert(true);
  };

  // 关系类型的中文名称映射
  const getRelationshipTypeName = (type: string) => {
    switch (type) {
      case CommonRelationshipTypes.FATHER:
        return '父节点关系';
      case CommonRelationshipTypes.CHILD:
        return '子节点关系';
      case CommonRelationshipTypes.BASE:
        return '基础关系';
      case CommonRelationshipTypes.BUILD:
        return '构建关系';
      default:
        return `自定义关系: ${type}`;
    }
  };

  // 关系标签模式的中文名称
  const labelModeNames = {
    [RelationshipLabelMode.NONE]: '不显示',
    [RelationshipLabelMode.SIMPLE]: '简洁显示',
    [RelationshipLabelMode.FULL]: '完整显示'
  };

  // 重置所有配置
  const handleResetAllConfigs = () => {
    showConfirmDialog(
      '重置所有配置',
      '确定要重置所有配置为默认值吗？这将恢复默认的四象限布局、深度和视图设置。',
      () => {
        onResetAllConfigs();
      }
    );
  };
  
  // 切换主题
  const handleThemeChange = (mode: ThemeMode) => {
    ThemeService.saveThemeMode(mode);
    setCurrentTheme(mode);
  };

  // 获取主题图标
  const getThemeIcon = (mode: ThemeMode) => {
    switch (mode) {
      case ThemeMode.LIGHT:
        return sunny;
      case ThemeMode.DARK:
        return moon;
      case ThemeMode.SYSTEM:
      default:
        return contrast;
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="settings-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>图形视图设置</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="settings-content">
        <div className="settings-section">
          <h4>主题设置</h4>
          <div className="theme-options">
            <IonList>
              <IonRadioGroup 
                value={currentTheme}
                onIonChange={e => handleThemeChange(e.detail.value as ThemeMode)}
              >
                <IonItem>
                  <IonLabel>
                    <div className="theme-option">
                      <IonIcon icon={sunny} className="theme-icon light-icon" />
                      <span>亮色主题</span>
                    </div>
                  </IonLabel>
                  <IonRadio slot="start" value={ThemeMode.LIGHT} />
                </IonItem>
                
                <IonItem>
                  <IonLabel>
                    <div className="theme-option">
                      <IonIcon icon={moon} className="theme-icon dark-icon" />
                      <span>暗色主题</span>
                    </div>
                  </IonLabel>
                  <IonRadio slot="start" value={ThemeMode.DARK} />
                </IonItem>
                
                <IonItem>
                  <IonLabel>
                    <div className="theme-option">
                      <IonIcon icon={contrast} className="theme-icon system-icon" />
                      <span>跟随系统</span>
                    </div>
                  </IonLabel>
                  <IonRadio slot="start" value={ThemeMode.SYSTEM} />
                </IonItem>
              </IonRadioGroup>
            </IonList>
          </div>

          <h4>关系组配置</h4>
          <div className="quadrant-config">
            <IonItem>
              <IonLabel>上方关系组</IonLabel>
              <IonSelect 
                value={quadrantConfig[QuadrantPosition.TOP]} 
                onIonChange={e => onQuadrantChange(QuadrantPosition.TOP, e.detail.value as string[])}
                multiple={true}
                placeholder="选择上方关系类型"
              >
                {knownRelationshipTypes.map(type => (
                  <IonSelectOption key={type} value={type}>
                    {getRelationshipTypeName(type)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            
            <IonItem>
              <IonLabel>下方关系组</IonLabel>
              <IonSelect 
                value={quadrantConfig[QuadrantPosition.BOTTOM]} 
                onIonChange={e => onQuadrantChange(QuadrantPosition.BOTTOM, e.detail.value as string[])}
                multiple={true}
                placeholder="选择下方关系类型"
              >
                {knownRelationshipTypes.map(type => (
                  <IonSelectOption key={type} value={type}>
                    {getRelationshipTypeName(type)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            
            <IonItem>
              <IonLabel>左侧关系组</IonLabel>
              <IonSelect 
                value={quadrantConfig[QuadrantPosition.LEFT]} 
                onIonChange={e => onQuadrantChange(QuadrantPosition.LEFT, e.detail.value as string[])}
                multiple={true}
                placeholder="选择左侧关系类型"
              >
                {knownRelationshipTypes.map(type => (
                  <IonSelectOption key={type} value={type}>
                    {getRelationshipTypeName(type)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            
            <IonItem>
              <IonLabel>右侧关系组</IonLabel>
              <IonSelect 
                value={quadrantConfig[QuadrantPosition.RIGHT]} 
                onIonChange={e => onQuadrantChange(QuadrantPosition.RIGHT, e.detail.value as string[])}
                multiple={true}
                placeholder="选择右侧关系类型"
              >
                {knownRelationshipTypes.map(type => (
                  <IonSelectOption key={type} value={type}>
                    {getRelationshipTypeName(type)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            
            <IonItem>
              <IonLabel>未分配关系类型显示位置</IonLabel>
              <IonSelect 
                value={quadrantConfig.unconfiguredTypesPosition} 
                onIonChange={e => onUnconfiguredPositionChange(e.detail.value as QuadrantPosition)}
                placeholder="选择未分配关系类型的显示位置"
              >
                <IonSelectOption value={QuadrantPosition.TOP}>上方关系组</IonSelectOption>
                <IonSelectOption value={QuadrantPosition.BOTTOM}>下方关系组</IonSelectOption>
                <IonSelectOption value={QuadrantPosition.LEFT}>左侧关系组</IonSelectOption>
                <IonSelectOption value={QuadrantPosition.RIGHT}>右侧关系组</IonSelectOption>
              </IonSelect>
            </IonItem>
            
            <p className="description-text">
              注意：每个关系组可以包含多种关系类型。未分配到任何关系组的关系类型将会显示在指定的未分配关系组位置，若未指定则自动分配到未被配置的关系组中。
            </p>
          </div>
          
          <RelationshipConfig 
            relationshipConfig={relationshipTypeConfig}
            onConfigChange={onRelationshipTypeConfigChange}
          />
          
          <h4>深度配置</h4>
          <p className="description-text">
            设置每种关系类型的递归深度。例如，父节点深度设为3将显示"父亲的父亲的父亲"，但不会显示父亲的其他类型关系。
            每层节点会按层级排列，如父节点的父节点会显示在父节点的更上方区域。
          </p>
          <div className="depth-config">
            {knownRelationshipTypes.map(type => (
              <IonItem key={type}>
                <IonLabel>
                  {getRelationshipTypeName(type)}
                  <p className="relation-description">
                    {type === CommonRelationshipTypes.FATHER && '递归显示上层父节点（层级越深越靠上）'}
                    {type === CommonRelationshipTypes.CHILD && '递归显示下层子节点（层级越深越靠下）'}
                    {type === CommonRelationshipTypes.BASE && '递归显示基础关系节点（层级越深越靠左）'}
                    {type === CommonRelationshipTypes.BUILD && '递归显示构建关系节点（层级越深越靠右）'}
                    {![CommonRelationshipTypes.FATHER, CommonRelationshipTypes.CHILD, 
                       CommonRelationshipTypes.BASE, CommonRelationshipTypes.BUILD].includes(type) && 
                       '递归显示自定义关系节点（根据所在关系组决定位置）'}
                  </p>
                </IonLabel>
                <div className="depth-slider">
                  <span className="depth-value">{depthConfig[type] || 3}</span>
                  <IonRange
                    min={1}
                    max={5}
                    step={1}
                    snaps={true}
                    value={depthConfig[type] || 3}
                    onIonChange={e => onDepthChange(type, e.detail.value as number)}
                  />
                </div>
              </IonItem>
            ))}
          </div>
          
          <h4>显示设置</h4>
          <div className="view-config">
            <IonList>
              <IonRadioGroup 
                value={viewConfig.showRelationshipLabels} 
                onIonChange={e => onRelationshipLabelModeChange(e.detail.value)}
              >
                <IonListHeader>
                  <IonLabel>关系标签显示方式</IonLabel>
                </IonListHeader>
                
                {Object.values(RelationshipLabelMode).map(mode => (
                  <IonItem key={mode}>
                    <IonLabel>{labelModeNames[mode]}</IonLabel>
                    <IonRadio slot="start" value={mode} />
                  </IonItem>
                ))}
              </IonRadioGroup>
            </IonList>
            
            <IonItem lines="none" className="auto-focus-toggle">
              <IonLabel>
                自动聚焦新节点
                <p className="setting-description">创建新节点后自动将视图聚焦于该节点</p>
              </IonLabel>
              <IonToggle
                checked={viewConfig.autoFocusNewNode}
                onIonChange={e => onAutoFocusNewNodeChange(e.detail.checked)}
              />
            </IonItem>
          </div>
          
          <div className="config-actions">
            <p className="config-note">所有配置已自动保存</p>
            <IonButton 
              size="small" 
              fill="clear" 
              className="reset-config-button"
              onClick={handleResetAllConfigs}
            >
              <IonIcon icon={refresh} slot="start" />
              重置所有配置
            </IonButton>
          </div>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertHeader}
          message={alertMessage}
          buttons={[
            {
              text: '取消',
              role: 'cancel',
              handler: () => setShowAlert(false)
            },
            {
              text: '确认',
              handler: () => {
                confirmHandler();
                setShowAlert(false);
              }
            }
          ]}
        />
      </IonContent>
    </IonModal>
  );
};

export default SettingsModal; 