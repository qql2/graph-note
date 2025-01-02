import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/services/database/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    coverage: {
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{js,ts}"],
      exclude: ["src/**/*.{test,spec}.{js,ts}", "src/**/*.d.ts"],
    },
    deps: {
      inline: [/@ionic\/react/],
    },
    alias: {
      "ionicons/components": "ionicons/dist/types/components",
    },
  },
});
