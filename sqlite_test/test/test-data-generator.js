const GraphDB = require('../src/core/GraphDB');

class TestDataGenerator {
  constructor(dbPath) {
    this.db = new GraphDB(dbPath);
  }

  async generateComplexNetwork() {
    try {
      // 创建人物节点
      const people = await this.createPeople();

      // 创建公司节点
      const companies = await this.createCompanies();

      // 创建技能节点
      const skills = await this.createSkills();

      // 创建项目节点
      const projects = await this.createProjects();

      // 创建社交关系
      await this.createSocialRelationships(people);

      // 创建工作关系
      await this.createWorkRelationships(people, companies);

      // 创建技能关系
      await this.createSkillRelationships(people, skills);

      // 创建项目关系
      await this.createProjectRelationships(people, projects, companies);

      return {
        people,
        companies,
        skills,
        projects,
      };
    } catch (error) {
      console.error('Error generating test data:', error);
      throw error;
    }
  }

  async createPeople() {
    const peopleData = [
      { type: 'Person', name: 'Alice Johnson', age: 30, city: 'New York', role: 'Developer' },
      { type: 'Person', name: 'Bob Smith', age: 35, city: 'San Francisco', role: 'Manager' },
      { type: 'Person', name: 'Charlie Brown', age: 28, city: 'Chicago', role: 'Designer' },
      { type: 'Person', name: 'Diana Wilson', age: 40, city: 'Boston', role: 'Director' },
      { type: 'Person', name: 'Eve Davis', age: 25, city: 'Seattle', role: 'Developer' },
      { type: 'Person', name: 'Frank Miller', age: 45, city: 'Austin', role: 'CTO' },
      { type: 'Person', name: 'Grace Lee', age: 32, city: 'New York', role: 'Developer' },
      { type: 'Person', name: 'Henry Wang', age: 38, city: 'San Francisco', role: 'Manager' },
    ];

    return await Promise.all(peopleData.map((person) => this.db.createNode(person)));
  }

  async createCompanies() {
    const companiesData = [
      {
        type: 'Company',
        name: 'Tech Corp',
        industry: 'Technology',
        size: 1000,
        location: 'New York',
      },
      {
        type: 'Company',
        name: 'Design Studio',
        industry: 'Design',
        size: 50,
        location: 'San Francisco',
      },
      {
        type: 'Company',
        name: 'Data Systems',
        industry: 'Technology',
        size: 500,
        location: 'Chicago',
      },
      { type: 'Company', name: 'Creative Labs', industry: 'Media', size: 100, location: 'Boston' },
    ];

    return await Promise.all(companiesData.map((company) => this.db.createNode(company)));
  }

  async createSkills() {
    const skillsData = [
      { type: 'Skill', name: 'JavaScript', category: 'Programming', level: 'Advanced' },
      { type: 'Skill', name: 'Python', category: 'Programming', level: 'Advanced' },
      { type: 'Skill', name: 'UI Design', category: 'Design', level: 'Intermediate' },
      { type: 'Skill', name: 'Project Management', category: 'Management', level: 'Expert' },
      { type: 'Skill', name: 'Data Analysis', category: 'Analytics', level: 'Advanced' },
    ];

    return await Promise.all(skillsData.map((skill) => this.db.createNode(skill)));
  }

  async createProjects() {
    const projectsData = [
      { type: 'Project', name: 'Mobile App', status: 'In Progress', budget: 100000, duration: 6 },
      { type: 'Project', name: 'Web Platform', status: 'Completed', budget: 200000, duration: 12 },
      { type: 'Project', name: 'Data Pipeline', status: 'Planning', budget: 150000, duration: 8 },
      { type: 'Project', name: 'UI Redesign', status: 'In Progress', budget: 80000, duration: 4 },
    ];

    return await Promise.all(projectsData.map((project) => this.db.createNode(project)));
  }

  async createSocialRelationships(people) {
    const relationships = [
      { source: 0, target: 1, type: 'KNOWS', properties: { since: 2019, strength: 'Strong' } },
      { source: 0, target: 2, type: 'KNOWS', properties: { since: 2020, strength: 'Medium' } },
      { source: 1, target: 3, type: 'KNOWS', properties: { since: 2018, strength: 'Strong' } },
      { source: 2, target: 4, type: 'KNOWS', properties: { since: 2021, strength: 'Weak' } },
      { source: 3, target: 5, type: 'KNOWS', properties: { since: 2017, strength: 'Strong' } },
      { source: 4, target: 6, type: 'KNOWS', properties: { since: 2020, strength: 'Medium' } },
      { source: 5, target: 7, type: 'KNOWS', properties: { since: 2019, strength: 'Strong' } },
    ];

    for (const rel of relationships) {
      await this.db.createRelationship(
        people[rel.source].id,
        people[rel.target].id,
        rel.type,
        rel.properties
      );
    }
  }

  async createWorkRelationships(people, companies) {
    const relationships = [
      {
        person: 0,
        company: 0,
        type: 'WORKS_AT',
        properties: { since: 2018, position: 'Senior Developer' },
      },
      {
        person: 1,
        company: 0,
        type: 'WORKS_AT',
        properties: { since: 2017, position: 'Project Manager' },
      },
      {
        person: 2,
        company: 1,
        type: 'WORKS_AT',
        properties: { since: 2019, position: 'UI Designer' },
      },
      {
        person: 3,
        company: 2,
        type: 'WORKS_AT',
        properties: { since: 2016, position: 'Director' },
      },
      {
        person: 4,
        company: 2,
        type: 'WORKS_AT',
        properties: { since: 2020, position: 'Developer' },
      },
      { person: 5, company: 3, type: 'WORKS_AT', properties: { since: 2015, position: 'CTO' } },
      {
        person: 6,
        company: 0,
        type: 'WORKS_AT',
        properties: { since: 2019, position: 'Developer' },
      },
      { person: 7, company: 1, type: 'WORKS_AT', properties: { since: 2018, position: 'Manager' } },
    ];

    for (const rel of relationships) {
      await this.db.createRelationship(
        people[rel.person].id,
        companies[rel.company].id,
        rel.type,
        rel.properties
      );
    }
  }

  async createSkillRelationships(people, skills) {
    const relationships = [
      { person: 0, skill: 0, type: 'HAS_SKILL', properties: { level: 'Expert', years: 5 } },
      { person: 0, skill: 1, type: 'HAS_SKILL', properties: { level: 'Intermediate', years: 3 } },
      { person: 1, skill: 3, type: 'HAS_SKILL', properties: { level: 'Expert', years: 8 } },
      { person: 2, skill: 2, type: 'HAS_SKILL', properties: { level: 'Expert', years: 6 } },
      { person: 3, skill: 3, type: 'HAS_SKILL', properties: { level: 'Expert', years: 10 } },
      { person: 4, skill: 0, type: 'HAS_SKILL', properties: { level: 'Advanced', years: 4 } },
      { person: 5, skill: 4, type: 'HAS_SKILL', properties: { level: 'Expert', years: 7 } },
      { person: 6, skill: 1, type: 'HAS_SKILL', properties: { level: 'Advanced', years: 5 } },
      { person: 7, skill: 3, type: 'HAS_SKILL', properties: { level: 'Expert', years: 6 } },
    ];

    for (const rel of relationships) {
      await this.db.createRelationship(
        people[rel.person].id,
        skills[rel.skill].id,
        rel.type,
        rel.properties
      );
    }
  }

  async createProjectRelationships(people, projects, companies) {
    // 人员参与项目
    const personProjects = [
      {
        person: 0,
        project: 0,
        type: 'WORKS_ON',
        properties: { role: 'Lead Developer', since: '2023-01' },
      },
      {
        person: 1,
        project: 0,
        type: 'MANAGES',
        properties: { role: 'Project Manager', since: '2023-01' },
      },
      {
        person: 2,
        project: 3,
        type: 'WORKS_ON',
        properties: { role: 'Designer', since: '2023-02' },
      },
      {
        person: 4,
        project: 1,
        type: 'WORKS_ON',
        properties: { role: 'Developer', since: '2023-03' },
      },
      {
        person: 6,
        project: 2,
        type: 'WORKS_ON',
        properties: { role: 'Developer', since: '2023-04' },
      },
    ];

    // 公司拥有项目
    const companyProjects = [
      {
        company: 0,
        project: 0,
        type: 'OWNS',
        properties: { start_date: '2023-01', budget: 100000 },
      },
      {
        company: 1,
        project: 3,
        type: 'OWNS',
        properties: { start_date: '2023-02', budget: 80000 },
      },
      {
        company: 2,
        project: 1,
        type: 'OWNS',
        properties: { start_date: '2023-03', budget: 200000 },
      },
      {
        company: 2,
        project: 2,
        type: 'OWNS',
        properties: { start_date: '2023-04', budget: 150000 },
      },
    ];

    // 创建人员-项目关系
    for (const rel of personProjects) {
      await this.db.createRelationship(
        people[rel.person].id,
        projects[rel.project].id,
        rel.type,
        rel.properties
      );
    }

    // 创建公司-项目关系
    for (const rel of companyProjects) {
      await this.db.createRelationship(
        companies[rel.company].id,
        projects[rel.project].id,
        rel.type,
        rel.properties
      );
    }
  }

  async close() {
    await this.db.close();
  }

  async cleanup() {
    // 清理所有节点和关系
    this.db.db.exec('DELETE FROM relationship_properties');
    this.db.db.exec('DELETE FROM relationships');
    this.db.db.exec('DELETE FROM node_properties');
    this.db.db.exec('DELETE FROM nodes');
  }
}

module.exports = TestDataGenerator;
