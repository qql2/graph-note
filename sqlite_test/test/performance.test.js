const GraphDB = require('../src/core/GraphDB');
const fs = require('fs');
const path = require('path');

const TEST_DB_PATH = path.join(__dirname, 'perf_test.db');
let db;
let testNodes = [];

// 测试数据生成函数
function generateTestData(nodeCount, relationshipCount) {
  const nodes = [];
  const relationships = [];

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      type: 'TestNode',
      name: `Node${i}`,
      value: Math.random() * 1000,
      timestamp: Date.now(),
    });
  }

  for (let i = 0; i < relationshipCount; i++) {
    const fromNode = Math.floor(Math.random() * nodeCount);
    const toNode = Math.floor(Math.random() * nodeCount);
    relationships.push({
      from: fromNode,
      to: toNode,
      type: 'TEST_RELATION',
      properties: {
        weight: Math.random() * 100,
        timestamp: Date.now(),
      },
    });
  }

  return { nodes, relationships };
}

// 性能统计函数
function calculateStats(times) {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    avg: Math.round(avg),
    min: Math.round(min),
    max: Math.round(max),
    median: Math.round(median),
    samples: times.length,
  };
}

// 性能测试套件
describe('性能测试', () => {
  const ITERATIONS = 5; // 每个测试重复次数
  const BATCH_SIZE = 1000;
  const QUERY_COUNT = 100;

  beforeEach(async () => {
    // 每次测试前清理并重新创建数据库
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new GraphDB(TEST_DB_PATH);
    testNodes = [];
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('基础操作性能', () => {
    test('批量创建节点性能', async () => {
      const times = [];
      console.log('\n节点创建性能测试:');

      for (let i = 0; i < ITERATIONS; i++) {
        const nodes = generateTestData(BATCH_SIZE, 0).nodes;
        const start = Date.now();

        for (const node of nodes) {
          const result = await db.createNode(node);
          testNodes.push(result);
        }

        const duration = Date.now() - start;
        times.push(duration);
        console.log(
          `  迭代 ${i + 1}: ${duration}ms (${Math.round(BATCH_SIZE / (duration / 1000))} ops/s)`
        );
      }

      const stats = calculateStats(times);
      console.log('  统计:', {
        平均耗时: `${stats.avg}ms`,
        最小耗时: `${stats.min}ms`,
        最大耗时: `${stats.max}ms`,
        中位数: `${stats.median}ms`,
        平均吞吐量: `${Math.round(BATCH_SIZE / (stats.avg / 1000))} ops/s`,
      });
    });

    test('批量创建关系性能', async () => {
      const times = [];
      console.log('\n关系创建性能测试:');

      // 先创建足够的节点
      const nodes = generateTestData(BATCH_SIZE, 0).nodes;
      for (const node of nodes) {
        const result = await db.createNode(node);
        testNodes.push(result);
      }

      for (let i = 0; i < ITERATIONS; i++) {
        const relationships = generateTestData(0, BATCH_SIZE).relationships;
        const start = Date.now();

        for (const rel of relationships) {
          const fromNode = testNodes[rel.from];
          const toNode = testNodes[rel.to];
          await db.createRelationship(fromNode.id, toNode.id, rel.type, rel.properties);
        }

        const duration = Date.now() - start;
        times.push(duration);
        console.log(
          `  迭代 ${i + 1}: ${duration}ms (${Math.round(BATCH_SIZE / (duration / 1000))} ops/s)`
        );
      }

      const stats = calculateStats(times);
      console.log('  统计:', {
        平均耗时: `${stats.avg}ms`,
        最小耗时: `${stats.min}ms`,
        最大耗时: `${stats.max}ms`,
        中位数: `${stats.median}ms`,
        平均吞吐量: `${Math.round(BATCH_SIZE / (stats.avg / 1000))} ops/s`,
      });
    });

    test('节点查询性能', async () => {
      const times = [];
      console.log('\n节点查询性能测试:');

      // 先创建测试数据
      const nodes = generateTestData(BATCH_SIZE, 0).nodes;
      for (const node of nodes) {
        await db.createNode(node);
      }

      for (let i = 0; i < ITERATIONS; i++) {
        const start = Date.now();

        for (let j = 0; j < QUERY_COUNT; j++) {
          const randomValue = Math.floor(Math.random() * 1000);
          await db.findNodes({
            type: 'TestNode',
            properties: {
              value: { $gt: randomValue },
            },
          });
        }

        const duration = Date.now() - start;
        times.push(duration);
        console.log(
          `  迭代 ${i + 1}: ${duration}ms (${Math.round(QUERY_COUNT / (duration / 1000))} qps)`
        );
      }

      const stats = calculateStats(times);
      console.log('  统计:', {
        平均耗时: `${stats.avg}ms`,
        最小耗时: `${stats.min}ms`,
        最大耗时: `${stats.max}ms`,
        中位数: `${stats.median}ms`,
        平均吞吐量: `${Math.round(QUERY_COUNT / (stats.avg / 1000))} qps`,
      });
    });
  });

  describe('复杂查询性能', () => {
    beforeEach(async () => {
      // 创建测试数据
      const nodes = generateTestData(BATCH_SIZE, 0).nodes;
      for (const node of nodes) {
        const result = await db.createNode(node);
        testNodes.push(result);
      }

      const relationships = generateTestData(0, BATCH_SIZE).relationships;
      for (const rel of relationships) {
        const fromNode = testNodes[rel.from];
        const toNode = testNodes[rel.to];
        await db.createRelationship(fromNode.id, toNode.id, rel.type, rel.properties);
      }
    });

    test('最短路径查询性能', async () => {
      const times = [];
      console.log('\n最短路径查询性能测试:');

      for (let i = 0; i < ITERATIONS; i++) {
        const startNode = testNodes[0];
        const endNode = testNodes[testNodes.length - 1];

        const start = Date.now();
        await db.findShortestPath(startNode.id, endNode.id, 'TEST_RELATION');
        const duration = Date.now() - start;

        times.push(duration);
        console.log(`  迭代 ${i + 1}: ${duration}ms`);
      }

      const stats = calculateStats(times);
      console.log('  统计:', {
        平均耗时: `${stats.avg}ms`,
        最小耗时: `${stats.min}ms`,
        最大耗时: `${stats.max}ms`,
        中位数: `${stats.median}ms`,
      });
    });

    test('模式匹配查询性能', async () => {
      const times = [];
      console.log('\n模式匹配查询性能测试:');

      for (let i = 0; i < ITERATIONS; i++) {
        const start = Date.now();
        await db.matchPattern({
          nodeType: 'TestNode',
          relationshipType: 'TEST_RELATION',
          targetType: 'TestNode',
        });
        const duration = Date.now() - start;

        times.push(duration);
        console.log(`  迭代 ${i + 1}: ${duration}ms`);
      }

      const stats = calculateStats(times);
      console.log('  统计:', {
        平均耗时: `${stats.avg}ms`,
        最小耗时: `${stats.min}ms`,
        最大耗时: `${stats.max}ms`,
        中位数: `${stats.median}ms`,
      });
    });
  });

  describe('内存使用分析', () => {
    test('内存占用测试', async () => {
      const memoryStats = [];
      console.log('\n内存使用测试:');

      for (let i = 0; i < ITERATIONS; i++) {
        const initialMemory = process.memoryUsage();

        // 执行一系列操作
        const { nodes } = generateTestData(BATCH_SIZE, 0);
        for (const node of nodes) {
          await db.createNode(node);
        }

        const finalMemory = process.memoryUsage();
        const diff = {
          heapUsed: Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024),
          heapTotal: Math.round((finalMemory.heapTotal - initialMemory.heapTotal) / 1024 / 1024),
          rss: Math.round((finalMemory.rss - initialMemory.rss) / 1024 / 1024),
        };

        memoryStats.push(diff);
        console.log(`  迭代 ${i + 1} 内存增长:`, {
          'Heap Used': `${diff.heapUsed}MB`,
          'Heap Total': `${diff.heapTotal}MB`,
          RSS: `${diff.rss}MB`,
        });
      }

      // 计算平均内存增长
      const avgMemoryGrowth = {
        heapUsed: Math.round(
          memoryStats.reduce((sum, stat) => sum + stat.heapUsed, 0) / ITERATIONS
        ),
        heapTotal: Math.round(
          memoryStats.reduce((sum, stat) => sum + stat.heapTotal, 0) / ITERATIONS
        ),
        rss: Math.round(memoryStats.reduce((sum, stat) => sum + stat.rss, 0) / ITERATIONS),
      };

      console.log('  平均内存增长:', {
        'Heap Used': `${avgMemoryGrowth.heapUsed}MB`,
        'Heap Total': `${avgMemoryGrowth.heapTotal}MB`,
        RSS: `${avgMemoryGrowth.rss}MB`,
      });
    });
  });
});
