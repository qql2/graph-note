import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), legacy()],
  server: {
    host: "0.0.0.0",
  },
  build: {
    // 开发模式禁用压缩，启用源码映射
    ...(process.env.NODE_ENV !== "production" && {
      minify: false,
      sourcemap: true,
      css: { minify: false },
    }),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
