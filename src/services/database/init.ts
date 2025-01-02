import fs from "fs";
import path from "path";
import os from "os";

export function initializeDatabase(): void {
  const homeDir = os.homedir();
  const appDataDir = path.join(homeDir, ".graph-note");

  // 确保应用数据目录存在
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
}

// 在应用启动时调用
initializeDatabase();
