import { graphDatabaseService } from './graph-database/GraphDatabaseService';
import {
  NodeSearchCriteria,
  EdgeSearchCriteria,
  CombinedSearchCriteria,
  SearchResult,
  FullTextSearchOptions
} from '../models/SearchTypes';
import { GraphNode, GraphEdge } from '../models/GraphNode';
import { GraphNode as DbGraphNode, GraphEdge as DbGraphEdge } from './graph-database/core/types';

/**
 * 图形搜索服务 - 提供节点和关系的搜索功能
 */
class GraphSearchService {
  /**
   * 按条件搜索节点
   * @param criteria 节点搜索条件
   * @returns 符合条件的节点列表和总数
   */
  async searchNodes(criteria: NodeSearchCriteria): Promise<{ nodes: GraphNode[]; totalCount: number }> {
    const db = graphDatabaseService.getDatabase('GraphSearchService');
    const result = await db.searchNodes(criteria);

    // 将数据库返回的节点类型转换为应用模型节点类型
    const nodes: GraphNode[] = result.nodes.map((node: DbGraphNode) => ({
      id: node.id!,
      label: node.label,
      description: node.properties?.description as string | undefined,
      metadata: node.properties || {},
      depth: 0
    }));

    return {
      nodes,
      totalCount: result.totalCount
    };
  }

  /**
   * 按条件搜索关系
   * @param criteria 关系搜索条件
   * @returns 符合条件的关系列表和总数
   */
  async searchEdges(criteria: EdgeSearchCriteria): Promise<{ edges: GraphEdge[]; totalCount: number }> {
    const db = graphDatabaseService.getDatabase('GraphSearchService');
    const result = await db.searchEdges(criteria);

    // 将数据库返回的关系类型转换为应用模型关系类型
    const edges: GraphEdge[] = result.edges.map((edge: DbGraphEdge) => ({
      id: edge.id!,
      source: edge.source_id,
      target: edge.target_id,
      relationshipType: edge.type,
      metadata: edge.properties || {}
    }));

    return {
      edges,
      totalCount: result.totalCount
    };
  }

  /**
   * 组合搜索（同时搜索节点和关系）
   * @param criteria 组合搜索条件
   * @returns 搜索结果
   */
  async combinedSearch(criteria: CombinedSearchCriteria): Promise<SearchResult> {
    const nodeResult = criteria.nodes 
      ? await this.searchNodes(criteria.nodes)
      : { nodes: [], totalCount: 0 };
    
    const edgeResult = criteria.edges 
      ? await this.searchEdges(criteria.edges)
      : { edges: [], totalCount: 0 };

    return {
      nodes: nodeResult.nodes,
      edges: edgeResult.edges,
      totalNodeCount: nodeResult.totalCount,
      totalEdgeCount: edgeResult.totalCount
    };
  }

  /**
   * 全文搜索（搜索节点和关系的所有文本内容）
   * @param query 搜索文本
   * @param options 搜索选项
   * @returns 搜索结果
   */
  async fullTextSearch(query: string, options?: FullTextSearchOptions): Promise<SearchResult> {
    const db = graphDatabaseService.getDatabase('GraphSearchService');
    const result = await db.fullTextSearch(query, options);

    // 转换为应用模型格式
    const nodes: GraphNode[] = result.nodes.map((node: DbGraphNode) => ({
      id: node.id!,
      label: node.label,
      description: node.properties?.description as string | undefined,
      metadata: node.properties || {},
      depth: 0
    }));

    const edges: GraphEdge[] = result.edges.map((edge: DbGraphEdge) => ({
      id: edge.id!,
      source: edge.source_id,
      target: edge.target_id,
      relationshipType: edge.type,
      metadata: edge.properties || {}
    }));

    return {
      nodes,
      edges,
      totalNodeCount: result.totalNodeCount,
      totalEdgeCount: result.totalEdgeCount
    };
  }
}

// 导出单例实例
export const graphSearchService = new GraphSearchService();
export default graphSearchService; 