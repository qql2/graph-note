import fs from "fs";
import path from "path";
import os from "os";

// 创建测试目录
const testDir = path.join(os.tmpdir(), "graph-note-test");
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// 清理函数
export function cleanup() {
  if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir);
    for (const file of files) {
      fs.unlinkSync(path.join(testDir, file));
    }
    fs.rmdirSync(testDir);
  }
}

// 在所有测试完成后清理
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit();
});
