import React, { useEffect, useRef, CSSProperties } from 'react';
import { IonList, IonItem, IonIcon, IonLabel } from '@ionic/react';
import './ContextMenu.css';

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ items, position, isOpen, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 处理点击菜单外部关闭菜单
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 处理Esc键关闭菜单
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // 防止菜单超出屏幕边界
  const adjustPosition = (): CSSProperties => {
    if (!menuRef.current) {
      return {
        left: `${position.x}px`,
        top: `${position.y}px`,
      };
    }

    const { x, y } = position;
    const { width, height } = menuRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const adjustedX = x + width > windowWidth ? windowWidth - width : x;
    const adjustedY = y + height > windowHeight ? windowHeight - height : y;

    return {
      left: `${adjustedX}px`,
      top: `${adjustedY}px`,
    };
  };

  if (!isOpen) return null;

  return (
    <div 
      className="context-menu" 
      ref={menuRef} 
      style={adjustPosition()}
    >
      <IonList className="context-menu-list">
        {items.map((item) => (
          <IonItem 
            key={item.id} 
            button 
            onClick={() => {
              item.onClick();
              onClose();
            }}
            disabled={item.disabled}
            className="context-menu-item"
          >
            {item.icon && <IonIcon icon={item.icon} slot="start" />}
            <IonLabel>{item.label}</IonLabel>
          </IonItem>
        ))}
      </IonList>
    </div>
  );
};

export default ContextMenu; 