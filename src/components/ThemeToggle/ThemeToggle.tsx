import React, { useState, useEffect } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { sunny, moon, contrast } from 'ionicons/icons';
import { ThemeService, ThemeMode } from '../../services/ThemeService';
import './ThemeToggle.css';

interface ThemeToggleProps {
  showText?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ showText = false }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(ThemeService.getCurrentTheme());

  useEffect(() => {
    // 确保在组件挂载时应用当前主题
    ThemeService.applyTheme(currentTheme);
  }, []);

  const getThemeIcon = (theme: ThemeMode) => {
    switch (theme) {
      case ThemeMode.LIGHT:
        return sunny;
      case ThemeMode.DARK:
        return moon;
      case ThemeMode.SYSTEM:
      default:
        return contrast;
    }
  };

  const getThemeName = (theme: ThemeMode) => {
    switch (theme) {
      case ThemeMode.LIGHT:
        return '亮色主题';
      case ThemeMode.DARK:
        return '暗色主题';
      case ThemeMode.SYSTEM:
      default:
        return '跟随系统';
    }
  };

  const handleToggleTheme = () => {
    const newTheme = ThemeService.toggleTheme();
    setCurrentTheme(newTheme);
  };

  return (
    <div className="theme-toggle-container">
      <IonButton 
        fill="clear" 
        className="theme-toggle-button" 
        onClick={handleToggleTheme}
        title={`${getThemeName(currentTheme)} (点击切换)`}
      >
        <IonIcon icon={getThemeIcon(currentTheme)} />
        {showText && (
          <span className="theme-mode-indicator">{getThemeName(currentTheme)}</span>
        )}
      </IonButton>
    </div>
  );
};

export default ThemeToggle; 