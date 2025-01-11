// Jest setup file
const path = require('path');
const fs = require('fs');

// 在每次测试前清理测试数据库
beforeEach(() => {
  const testDbPath = path.join(__dirname, 'test.sqlite');
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (error) {
      console.warn('Warning: Could not delete test database file:', error.message);
    }
  }
});

// 全局测试超时设置
jest.setTimeout(10000);
