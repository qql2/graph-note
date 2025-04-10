import { QuadrantConfig, defaultQuadrantConfig, DepthConfig, defaultDepthConfig, ViewConfig, defaultViewConfig } from '../models/GraphNode';

/**
 * 配置服务 - 负责处理各种配置的加载与保存
 */
export class ConfigService {
  // 存储键名
  private static readonly STORAGE_KEYS = {
    QUADRANT_CONFIG: 'graphNote_quadrantConfig',
    DEPTH_CONFIG: 'graphNote_depthConfig',
    VIEW_CONFIG: 'graphNote_viewConfig',
    CENTRAL_NODE_ID: 'graphNote_centralNodeId'
  };

  /**
   * 检查本地存储是否可用
   */
  private static isLocalStorageAvailable(): boolean {
    try {
      const testKey = '__test_storage__';
      localStorage.setItem(testKey, testKey);
      const result = localStorage.getItem(testKey) === testKey;
      localStorage.removeItem(testKey);
      return result;
    } catch (e) {
      console.warn('本地存储不可用，配置将不会被保存:', e);
      return false;
    }
  }

  /**
   * 保存四象限配置
   * @param config 四象限配置对象
   */
  static saveQuadrantConfig(config: QuadrantConfig): void {
    if (!this.isLocalStorageAvailable()) return;
    try {
      localStorage.setItem(this.STORAGE_KEYS.QUADRANT_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('保存四象限配置失败:', e);
    }
  }

  /**
   * 加载四象限配置
   * @returns 保存的四象限配置或默认配置
   */
  static loadQuadrantConfig(): QuadrantConfig {
    if (!this.isLocalStorageAvailable()) return { ...defaultQuadrantConfig };
    
    const saved = localStorage.getItem(this.STORAGE_KEYS.QUADRANT_CONFIG);
    if (saved) {
      try {
        return JSON.parse(saved) as QuadrantConfig;
      } catch (e) {
        console.error('加载四象限配置失败:', e);
        return { ...defaultQuadrantConfig };
      }
    }
    return { ...defaultQuadrantConfig };
  }

  /**
   * 保存深度配置
   * @param config 深度配置对象
   */
  static saveDepthConfig(config: DepthConfig): void {
    if (!this.isLocalStorageAvailable()) return;
    try {
      localStorage.setItem(this.STORAGE_KEYS.DEPTH_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('保存深度配置失败:', e);
    }
  }

  /**
   * 加载深度配置
   * @returns 保存的深度配置或默认配置
   */
  static loadDepthConfig(): DepthConfig {
    if (!this.isLocalStorageAvailable()) return { ...defaultDepthConfig };
    
    const saved = localStorage.getItem(this.STORAGE_KEYS.DEPTH_CONFIG);
    if (saved) {
      try {
        return JSON.parse(saved) as DepthConfig;
      } catch (e) {
        console.error('加载深度配置失败:', e);
        return { ...defaultDepthConfig };
      }
    }
    return { ...defaultDepthConfig };
  }

  /**
   * 保存视图配置
   * @param config 视图配置对象
   */
  static saveViewConfig(config: ViewConfig): void {
    if (!this.isLocalStorageAvailable()) return;
    try {
      localStorage.setItem(this.STORAGE_KEYS.VIEW_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('保存视图配置失败:', e);
    }
  }

  /**
   * 加载视图配置
   * @returns 保存的视图配置或默认配置
   */
  static loadViewConfig(): ViewConfig {
    if (!this.isLocalStorageAvailable()) return { ...defaultViewConfig };
    
    const saved = localStorage.getItem(this.STORAGE_KEYS.VIEW_CONFIG);
    if (saved) {
      try {
        return JSON.parse(saved) as ViewConfig;
      } catch (e) {
        console.error('加载视图配置失败:', e);
        return { ...defaultViewConfig };
      }
    }
    return { ...defaultViewConfig };
  }

  /**
   * 保存当前聚焦的节点ID
   * @param nodeId 当前聚焦的节点ID
   */
  static saveCentralNodeId(nodeId: string): void {
    if (!this.isLocalStorageAvailable()) return;
    try {
      localStorage.setItem(this.STORAGE_KEYS.CENTRAL_NODE_ID, nodeId);
    } catch (e) {
      console.error('保存聚焦节点ID失败:', e);
    }
  }

  /**
   * 加载上次聚焦的节点ID
   * @returns 保存的节点ID，如果没有则返回空字符串
   */
  static loadCentralNodeId(): string {
    if (!this.isLocalStorageAvailable()) return '';
    
    try {
      const savedId = localStorage.getItem(this.STORAGE_KEYS.CENTRAL_NODE_ID);
      return savedId || '';
    } catch (e) {
      console.error('加载聚焦节点ID失败:', e);
      return '';
    }
  }

  /**
   * 重置所有配置为默认值
   */
  static resetAllConfigs(): void {
    if (!this.isLocalStorageAvailable()) return;
    try {
      localStorage.removeItem(this.STORAGE_KEYS.QUADRANT_CONFIG);
      localStorage.removeItem(this.STORAGE_KEYS.DEPTH_CONFIG);
      localStorage.removeItem(this.STORAGE_KEYS.VIEW_CONFIG);
      localStorage.removeItem(this.STORAGE_KEYS.CENTRAL_NODE_ID);
    } catch (e) {
      console.error('重置配置失败:', e);
    }
  }
} 