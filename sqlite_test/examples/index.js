const GraphDB = require('../src/core/GraphDB');

async function runExample() {
  try {
    // 初始化数据库
    const db = new GraphDB('example.sqlite');

    // 创建节点
    console.log('Creating nodes...');
    const person1 = await db.createNode({ name: 'Alice', age: 30, type: 'Person' });
    const person2 = await db.createNode({ name: 'Bob', age: 25, type: 'Person' });
    const movie = await db.createNode({ title: 'The Matrix', year: 1999, type: 'Movie' });

    // 创建关系
    console.log('Creating relationships...');
    await db.createRelationship(person1.id, person2.id, 'KNOWS', { since: 2020 });
    await db.createRelationship(person1.id, movie.id, 'WATCHED', { rating: 5 });
    await db.createRelationship(person2.id, movie.id, 'WATCHED', { rating: 4 });

    // 查询示例
    console.log('Querying relationships...');
    const results = await db.query(`
      MATCH (p:Person)-[r:WATCHED]->(m:Movie)
      WHERE m.title = 'The Matrix'
      RETURN p.name, r.rating
    `);

    console.log('Query results:', results);
  } catch (error) {
    console.error('Error running example:', error);
  }
}

runExample();
