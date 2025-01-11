const path = require('path');
const fs = require('fs');
const TestDataGenerator = require('./test-data-generator');

describe('Complex Graph Queries', () => {
  let generator;
  let testData;
  const dbPath = path.join(__dirname, 'complex-test.sqlite');

  beforeAll(async () => {
    // 确保在开始前清理旧的测试数据库
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (error) {
        console.warn('Warning: Could not delete old test database file:', error.message);
      }
    }
    generator = new TestDataGenerator(dbPath);
    await generator.cleanup(); // 确保数据库是空的
    testData = await generator.generateComplexNetwork();
  });

  afterAll(async () => {
    // 确保先关闭数据库连接
    if (generator) {
      await generator.close();
      generator = null;
    }

    // 然后再尝试删除文件
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (error) {
        console.warn('Warning: Could not delete test database file:', error.message);
      }
    }
  });

  describe('Path Finding', () => {
    test('should find shortest path between colleagues', async () => {
      const path = await generator.db.findShortestPath(
        testData.people[0].id, // Alice
        testData.people[6].id, // Grace
        'KNOWS'
      );

      expect(path).toBeDefined();
      expect(path.nodes.length).toBeGreaterThan(0);
      expect(path.nodes[0].name).toBe('Alice Johnson');
      expect(path.nodes[path.nodes.length - 1].name).toBe('Grace Lee');
    });

    test('should find all JavaScript developers', async () => {
      const jsSkill = testData.skills.find((s) => s.name === 'JavaScript');
      const pattern = {
        nodeType: 'Person',
        relationshipType: 'HAS_SKILL',
        targetType: 'Skill',
      };

      const matches = await generator.db.matchPattern(pattern);
      const jsDevelopers = matches.filter((m) => m.target.id === jsSkill.id);

      expect(jsDevelopers.length).toBeGreaterThan(0);
      expect(jsDevelopers[0].source.role).toBe('Developer');
    });
  });

  describe('Company Analysis', () => {
    test('should find all employees of Tech Corp', async () => {
      const techCorp = testData.companies.find((c) => c.name === 'Tech Corp');
      const pattern = {
        nodeType: 'Person',
        relationshipType: 'WORKS_AT',
        targetType: 'Company',
      };

      const matches = await generator.db.matchPattern(pattern);
      const techEmployees = matches.filter((m) => m.target.id === techCorp.id);

      expect(techEmployees.length).toBeGreaterThan(0);
      expect(techEmployees.some((e) => e.source.role === 'Developer')).toBe(true);
      expect(techEmployees.some((e) => e.source.role === 'Manager')).toBe(true);
    });

    test('should analyze project distribution', async () => {
      const stats = await generator.db.aggregateRelationships('Company', 'OWNS');

      expect(stats).toMatchObject({
        node_type: 'Company',
        relationship_type: 'OWNS',
        count: expect.any(Number),
        unique_sources: expect.any(Number),
        unique_targets: expect.any(Number),
      });
    });
  });

  describe('Skill Analysis', () => {
    test('should find developers with specific skills', async () => {
      const developers = await generator.db.findNodes({
        type: 'Person',
        properties: { role: 'Developer' },
      });

      expect(developers.length).toBeGreaterThan(0);
      expect(developers[0].type).toBe('Person');
    });

    test('should analyze skill distribution', async () => {
      const stats = await generator.db.aggregateRelationships('Person', 'HAS_SKILL');

      expect(stats).toMatchObject({
        node_type: 'Person',
        relationship_type: 'HAS_SKILL',
        count: expect.any(Number),
        unique_sources: expect.any(Number),
        unique_targets: expect.any(Number),
      });
    });
  });

  describe('Project Analysis', () => {
    test('should find all active projects', async () => {
      const activeProjects = await generator.db.findNodes({
        type: 'Project',
        properties: { status: 'In Progress' },
      });

      expect(activeProjects.length).toBeGreaterThan(0);
      expect(activeProjects[0].type).toBe('Project');
      expect(activeProjects[0].status).toBe('In Progress');
    });
  });

  describe('Complex Relationship Analysis', () => {
    test('should find relationships by multiple properties', async () => {
      const person1 = await generator.db.createNode({ type: 'Person', name: 'John' });
      const person2 = await generator.db.createNode({ type: 'Person', name: 'Jane' });

      await generator.db.createRelationship(person1.id, person2.id, 'KNOWS', {
        since: 2020,
        strength: 'strong',
        meetingPlace: 'work',
      });

      const relationships = await generator.db.findRelationships({
        type: 'KNOWS',
        properties: {
          since: 2020,
          strength: 'strong',
        },
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toMatchObject({
        type: 'KNOWS',
        sourceId: person1.id,
        targetId: person2.id,
        since: 2020,
        strength: 'strong',
        meetingPlace: 'work',
      });
    });

    test('should find developers working on the same project', async () => {
      const mobileApp = testData.projects.find((p) => p.name === 'Mobile App');
      const pattern = {
        nodeType: 'Person',
        relationshipType: ['WORKS_ON', 'MANAGES'],
        targetType: 'Project',
      };

      const matches = await generator.db.matchPattern(pattern);
      const teamMembers = matches.filter((m) => m.target.id === mobileApp.id);

      expect(teamMembers.length).toBeGreaterThan(1);
    });

    test('should find companies with JavaScript developers', async () => {
      const jsSkill = testData.skills.find((s) => s.name === 'JavaScript');
      const skillPattern = {
        nodeType: 'Person',
        relationshipType: 'HAS_SKILL',
        targetType: 'Skill',
      };

      const workPattern = {
        nodeType: 'Person',
        relationshipType: 'WORKS_AT',
        targetType: 'Company',
      };

      const skillMatches = await generator.db.matchPattern(skillPattern);
      const jsDevelopers = skillMatches.filter((m) => m.target.id === jsSkill.id);

      const workMatches = await generator.db.matchPattern(workPattern);
      const jsCompanies = workMatches.filter((m) =>
        jsDevelopers.some((d) => d.source.id === m.source.id)
      );

      expect(jsCompanies.length).toBeGreaterThan(0);
    });
  });
});
