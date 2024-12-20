import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.ionic.starter",
  appName: "graph-note",
  webDir: "dist",
  server: {
    androidScheme: "http",
    cleartext: true,
    allowNavigation: ["192.168.5.20:*"],
  },
};

export default config;
