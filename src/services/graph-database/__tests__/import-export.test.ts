import { graphDatabaseService } from '..';
import { ImportMode } from '../core/types';

describe('Graph Database Import/Export', () => {
  beforeAll(async () => {
    // 初始化数据库
    await graphDatabaseService.initialize({
      dbName: 'test_import_export',
      version: 1,
      verbose: false
    });
  });

  afterAll(async () => {
    // 关闭数据库
    await graphDatabaseService.closeDatabase();
  });

  beforeEach(async () => {
    // 清空数据库
    const db = graphDatabaseService.getDatabase();
    await db.clear();
  });

  it('should export empty database to valid JSON', async () => {
    const db = graphDatabaseService.getDatabase();
    
    // 导出空数据库
    const json = await db.exportToJson();
    
    // 验证JSON格式
    expect(typeof json).toBe('string');
    
    const data = JSON.parse(json);
    expect(data).toHaveProperty('metadata');
    expect(data).toHaveProperty('data');
    expect(data.data).toHaveProperty('nodes');
    expect(data.data).toHaveProperty('edges');
    expect(Array.isArray(data.data.nodes)).toBe(true);
    expect(Array.isArray(data.data.edges)).toBe(true);
    expect(data.data.nodes.length).toBe(0);
    expect(data.data.edges.length).toBe(0);
  });

  it('should export database with nodes and edges', async () => {
    const db = graphDatabaseService.getDatabase();
    
    // 添加测试数据
    const node1Id = await db.addNode({
      type: 'test',
      label: 'Test Node 1'
    });
    
    const node2Id = await db.addNode({
      type: 'test',
      label: 'Test Node 2'
    });
    
    await db.addEdge({
      source_id: node1Id,
      target_id: node2Id,
      type: 'test_relation'
    });
    
    // 导出数据
    const json = await db.exportToJson();
    const data = JSON.parse(json);
    
    // 验证导出的数据
    expect(data.data.nodes.length).toBe(2);
    expect(data.data.edges.length).toBe(1);
    expect(data.data.nodes[0].label).toBe('Test Node 1');
    expect(data.data.nodes[1].label).toBe('Test Node 2');
    expect(data.data.edges[0].source_id).toBe(node1Id);
    expect(data.data.edges[0].target_id).toBe(node2Id);
    expect(data.data.edges[0].type).toBe('test_relation');
  });

  it('should validate import data correctly', async () => {
    const db = graphDatabaseService.getDatabase();
    
    // 有效的导入数据
    const validData = {
      metadata: {
        version: '1.0'
      },
      data: {
        nodes: [
          { id: 'test1', type: 'test', label: 'Test 1' },
          { id: 'test2', type: 'test', label: 'Test 2' }
        ],
        edges: [
          { id: 'edge1', source_id: 'test1', target_id: 'test2', type: 'test_relation' }
        ]
      }
    };
    
    // 无效的导入数据
    const invalidData = {
      data: {
        nodes: [
          { id: 'test1' } // 缺少必需字段
        ],
        edges: []
      }
    };
    
    // 验证有效数据
    const validResult = await db.validateImportData(JSON.stringify(validData));
    expect(validResult.valid).toBe(true);
    expect(validResult.nodeCount).toBe(2);
    expect(validResult.edgeCount).toBe(1);
    
    // 验证无效数据
    const invalidResult = await db.validateImportData(JSON.stringify(invalidData));
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  it('should import data in REPLACE mode', async () => {
    const db = graphDatabaseService.getDatabase();
    
    // 先添加一些初始数据
    await db.addNode({
      type: 'initial',
      label: 'Initial Node'
    });
    
    // 准备导入数据
    const importData = {
      data: {
        nodes: [
          { id: 'test1', type: 'test', label: 'Test 1' },
          { id: 'test2', type: 'test', label: 'Test 2' }
        ],
        edges: [
          { id: 'edge1', source_id: 'test1', target_id: 'test2', type: 'test_relation' }
        ]
      }
    };
    
    // 导入数据（替换模式）
    const result = await db.importFromJson(JSON.stringify(importData), ImportMode.REPLACE);
    
    // 验证导入结果
    expect(result.success).toBe(true);
    expect(result.nodesImported).toBe(2);
    expect(result.edgesImported).toBe(1);
    
    // 验证数据库中的内容
    const nodes = await db.getNodes();
    const edges = await db.getEdges();
    
    expect(nodes.length).toBe(2);
    expect(edges.length).toBe(1);
    
    // 确认初始数据已被替换
    const initialNodes = nodes.filter(node => node.type === 'initial');
    expect(initialNodes.length).toBe(0);
  });

  it('should import data in MERGE mode', async () => {
    const db = graphDatabaseService.getDatabase();
    
    // 先添加一些初始数据
    await db.addNode({
      id: 'initial1',
      type: 'initial',
      label: 'Initial Node'
    });
    
    // 准备导入数据
    const importData = {
      data: {
        nodes: [
          { id: 'test1', type: 'test', label: 'Test 1' },
          // 尝试更新已存在的节点
          { id: 'initial1', type: 'updated', label: 'Updated Node' }
        ],
        edges: [
          { id: 'edge1', source_id: 'test1', target_id: 'initial1', type: 'test_relation' }
        ]
      }
    };
    
    // 导入数据（合并模式）
    const result = await db.importFromJson(JSON.stringify(importData), ImportMode.MERGE);
    
    // 验证导入结果
    expect(result.success).toBe(true);
    
    // 验证数据库中的内容
    const nodes = await db.getNodes();
    const edges = await db.getEdges();
    
    expect(nodes.length).toBe(2); // 1个初始节点（已更新）+ 1个新节点
    expect(edges.length).toBe(1);
    
    // 确认初始节点已被更新
    const updatedNode = nodes.find(node => node.id === 'initial1');
    expect(updatedNode).toBeDefined();
    expect(updatedNode?.type).toBe('updated');
    expect(updatedNode?.label).toBe('Updated Node');
  });

  it('should handle edge ID conflicts in MERGE mode', async () => {
    const db = graphDatabaseService.getDatabase();
    
    // 创建初始节点和边
    const node1Id = await db.addNode({
      id: 'test1',
      type: 'test',
      label: 'Test Node 1'
    });
    
    const node2Id = await db.addNode({
      id: 'test2',
      type: 'test',
      label: 'Test Node 2'
    });
    
    // 添加一个带特定ID的边
    const existingEdgeId = 'edge1';
    await db.addEdge({
      id: existingEdgeId,
      source_id: node1Id,
      target_id: node2Id,
      type: 'original_relation',
      properties: { weight: 1 }
    });
    
    // 准备导入数据，包含相同ID的边但属性和类型不同
    const importData = {
      data: {
        nodes: [
          { id: 'test1', type: 'test', label: 'Test Node 1' },
          { id: 'test2', type: 'test', label: 'Test Node 2' }
        ],
        edges: [
          { 
            id: existingEdgeId, 
            source_id: 'test1', 
            target_id: 'test2', 
            type: 'updated_relation',
            properties: { weight: 2, note: 'Updated edge' } 
          }
        ]
      }
    };
    
    // 导入数据（合并模式）
    const result = await db.importFromJson(JSON.stringify(importData), ImportMode.MERGE);
    
    // 验证导入结果
    expect(result.success).toBe(true);
    expect(result.edgesImported).toBe(1);
    
    // 验证边是否已更新，而不是添加新的
    const edges = await db.getEdges();
    expect(edges.length).toBe(1); // 仍然只有一条边
    
    const updatedEdge = edges[0];
    expect(updatedEdge.id).toBe(existingEdgeId);
    expect(updatedEdge.type).toBe('updated_relation'); // 类型应该更新
    expect(updatedEdge.properties).toHaveProperty('weight', 2); // 属性应该更新
    expect(updatedEdge.properties).toHaveProperty('note', 'Updated edge'); // 应该添加新属性
  });

  it('should handle foreign key constraints for edges', async () => {
    const db = graphDatabaseService.getDatabase();
    
    // 准备导入数据，包含引用不存在节点的边
    const importData = {
      data: {
        nodes: [
          { id: 'test1', type: 'test', label: 'Test Node 1' }
          // 没有创建test2节点
        ],
        edges: [
          // 这条边引用了一个不存在的节点
          { id: 'edge1', source_id: 'test1', target_id: 'test2', type: 'invalid_relation' }
        ]
      }
    };
    
    // 导入数据
    const result = await db.importFromJson(JSON.stringify(importData), ImportMode.REPLACE);
    
    // 验证导入结果
    expect(result.success).toBe(false); // 应该失败，因为有错误
    expect(result.nodesImported).toBe(1); // 节点应该成功导入
    expect(result.edgesImported).toBe(0); // 边应该导入失败
    expect(result.errors.length).toBeGreaterThan(0); // 应该有错误信息
    
    // 错误信息应该包含关于目标节点不存在的说明
    const targetNodeError = result.errors.find(error => 
      error.includes('test2') && error.includes('does not exist')
    );
    expect(targetNodeError).toBeDefined();
    
    // 验证数据库状态
    const nodes = await db.getNodes();
    const edges = await db.getEdges();
    
    expect(nodes.length).toBe(1); // 应该只有一个节点
    expect(edges.length).toBe(0); // 不应该有任何边
  });
}); 