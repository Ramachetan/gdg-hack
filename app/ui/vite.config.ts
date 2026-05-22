import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Build the React app directly into app/static/dist so FastAPI can serve it.
// The dev server proxies WebSocket + REST traffic to the FastAPI app on :8000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../static/dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": { target: "ws://localhost:8000", ws: true },
      "/annotations": "http://localhost:8000",
      "/static": "http://localhost:8000",
    },
  },
});
