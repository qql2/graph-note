// Web 环境下的数据库初始化
export function initializeDatabase(): void {
  // Web 环境下不需要创建目录
  // 数据库会在内存中初始化
  console.log("Initializing database in web environment");
}

// 在应用启动时调用
initializeDatabase();
