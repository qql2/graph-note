/**
 * 主题模式枚举
 */
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system' // 跟随系统设置
}

/**
 * 主题服务 - 负责管理应用程序的主题
 */
export class ThemeService {
  // 存储键名
  private static readonly STORAGE_KEY = 'graphNote_themeMode';

  /**
   * 获取当前主题模式
   * @returns 当前的主题模式
   */
  static getCurrentTheme(): ThemeMode {
    try {
      const savedTheme = localStorage.getItem(this.STORAGE_KEY);
      if (savedTheme && Object.values(ThemeMode).includes(savedTheme as ThemeMode)) {
        return savedTheme as ThemeMode;
      }
      return ThemeMode.SYSTEM; // 默认跟随系统
    } catch (e) {
      console.error('获取主题设置失败:', e);
      return ThemeMode.SYSTEM;
    }
  }

  /**
   * 保存主题模式
   * @param mode 要保存的主题模式
   */
  static saveThemeMode(mode: ThemeMode): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, mode);
      this.applyTheme(mode);
    } catch (e) {
      console.error('保存主题设置失败:', e);
    }
  }

  /**
   * 应用主题模式到文档
   * @param mode 要应用的主题模式
   */
  static applyTheme(mode: ThemeMode): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 移除现有的主题类
    document.body.classList.remove('theme-dark', 'theme-light');
    
    // 确定是否应用暗色主题
    const isDarkTheme = mode === ThemeMode.DARK || (mode === ThemeMode.SYSTEM && prefersDark);
    
    // 应用新的主题类
    if (isDarkTheme) {
      document.body.classList.add('theme-dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      // 设置color-scheme属性为dark
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.body.classList.add('theme-light');
      document.documentElement.setAttribute('data-theme', 'light');
      // 设置color-scheme属性为light
      document.documentElement.style.colorScheme = 'light';
    }
    
    // 同步更新meta标签
    this.updateMetaThemeColor(isDarkTheme);
  }
  
  /**
   * 更新meta主题色标签
   * @param isDark 是否为暗色主题
   */
  private static updateMetaThemeColor(isDark: boolean): void {
    // 获取theme-color meta标签，如果不存在则创建一个
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    
    // 设置meta标签的内容
    metaThemeColor.setAttribute('content', isDark ? '#121212' : '#ffffff');
  }

  /**
   * 初始化主题
   * 应在应用启动时调用
   */
  static initTheme(): void {
    const currentTheme = this.getCurrentTheme();
    this.applyTheme(currentTheme);
    
    // 监听系统主题变化
    if (currentTheme === ThemeMode.SYSTEM) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => this.applyTheme(ThemeMode.SYSTEM);
      
      // 使用新旧两种API以确保兼容性
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else if ('addListener' in mediaQuery) {
        // @ts-ignore - 兼容旧版浏览器
        mediaQuery.addListener(handleChange);
      }
    }
  }

  /**
   * 切换主题
   * 在亮色模式、暗色模式和系统模式之间循环切换
   */
  static toggleTheme(): ThemeMode {
    const currentTheme = this.getCurrentTheme();
    let newTheme: ThemeMode;

    if (currentTheme === ThemeMode.LIGHT) {
      newTheme = ThemeMode.DARK;
    } else if (currentTheme === ThemeMode.DARK) {
      newTheme = ThemeMode.SYSTEM;
    } else {
      newTheme = ThemeMode.LIGHT;
    }

    this.saveThemeMode(newTheme);
    return newTheme;
  }
} 