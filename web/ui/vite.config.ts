import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build the React app into web/static-react so FastAPI can serve it.
// Dev server proxies /api to the FastAPI backend on :8099.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "../static-react", emptyOutDir: true },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8099" },
  },
});
