import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api and /onboarding to the Express API.
// API target is configurable so the web container can reach the api service
// over the docker network (API_PROXY_TARGET=http://api:3000).
const apiTarget = process.env.API_PROXY_TARGET || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/onboarding": { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
