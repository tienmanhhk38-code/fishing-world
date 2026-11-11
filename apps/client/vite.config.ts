import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:2567", changeOrigin: false },
      "/socket": {
        target: "http://127.0.0.1:2567",
        ws: true,
        rewrite: (path) => path.replace(/^\/socket/, ""),
      },
    },
  },
  build: { chunkSizeWarningLimit: 1600 },
});
