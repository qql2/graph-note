import React, { useEffect, useRef, CSSProperties, useState, useCallback, useLayoutEffect } from 'react';
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
  navbarHeight?: number; // 添加导航栏高度参数
}

const ContextMenu: React.FC<ContextMenuProps> = ({ 
  items, 
  position, 
  isOpen, 
  onClose,
  navbarHeight = 56 // 默认 Ionic 导航栏高度
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    visibility: 'hidden', // 初始隐藏，防止闪烁
    maxHeight: '80vh',    // 默认最大高度，防止超出屏幕
    overflowY: 'auto'     // 默认启用滚动
  });
  const [positioned, setPositioned] = useState(false);

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

  // 计算菜单位置的函数
  const calculateMenuPosition = useCallback(() => {
    if (!isOpen || !menuRef.current) return;

    const { x, y } = position;
    const menuRect = menuRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 计算水平方向的位置
    let adjustedX = x;
    if (x + menuRect.width > windowWidth) {
      adjustedX = windowWidth - menuRect.width - 10; // 10px 边距
    }
    if (adjustedX < 10) adjustedX = 10; // 最小边距
    
    // 计算垂直方向的位置和最大高度
    let adjustedY = y;
    let maxMenuHeight;
    
    // 检查是否需要向上展示菜单
    const spaceBelow = windowHeight - y;
    const spaceAbove = y - navbarHeight; // 考虑导航栏高度
    
    // 确保菜单不会被导航栏遮挡
    if (y < navbarHeight + 10) {
      // 如果点击位置太靠近导航栏，将菜单向下移动
      adjustedY = navbarHeight + 10;
    }
    
    // 如果下方空间不足且上方空间更多，则向上展示
    if (menuRect.height > spaceBelow && spaceAbove > spaceBelow) {
      // 向上展示菜单
      const calculatedHeight = Math.min(menuRect.height, spaceAbove - 10);
      adjustedY = y - calculatedHeight;
      maxMenuHeight = spaceAbove - 10;
      
      if (adjustedY < navbarHeight + 10) {
        // 如果调整后的位置会与导航栏重叠，则锚定到导航栏下方
        adjustedY = navbarHeight + 10;
        maxMenuHeight = y - navbarHeight - 20; // 限制高度为可用空间
      }
    } else {
      // 向下展示菜单
      maxMenuHeight = windowHeight - y - 10;
      
      // 检查是否接近顶部，如果是，则确保菜单从导航栏下方开始
      if (y < navbarHeight + menuRect.height / 2) {
        adjustedY = navbarHeight + 10;
        maxMenuHeight = windowHeight - navbarHeight - 20;
      }
    }
    
    // 设置最终样式，保证菜单在视图内且不被导航栏遮挡
    setMenuStyle({
      left: `${adjustedX}px`,
      top: `${adjustedY}px`,
      maxHeight: `${maxMenuHeight}px`,
      overflowY: 'auto',
      visibility: 'visible' // 计算完成后显示
    });
    
    setPositioned(true);
  }, [isOpen, position, navbarHeight]);

  // 初始化菜单位置
  useLayoutEffect(() => {
    if (isOpen) {
      // 重置状态
      setPositioned(false);
      setMenuStyle(prev => ({
        ...prev,
        visibility: 'hidden'
      }));
      
      // 使用 requestAnimationFrame 确保 DOM 已经渲染
      requestAnimationFrame(() => {
        calculateMenuPosition();
      });
    }
  }, [isOpen, calculateMenuPosition]);

  // 监听菜单大小变化和窗口大小变化
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    // 创建 ResizeObserver 监听菜单大小变化
    const resizeObserver = new ResizeObserver(() => {
      if (!positioned) {
        calculateMenuPosition();
      }
    });
    
    resizeObserver.observe(menuRef.current);
    
    // 监听窗口大小变化
    const handleResize = () => calculateMenuPosition();
    window.addEventListener('resize', handleResize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, calculateMenuPosition, positioned]);

  if (!isOpen) return null;

  return (
    <div 
      className="context-menu" 
      ref={menuRef} 
      style={menuStyle}
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