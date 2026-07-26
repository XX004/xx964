import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/predict":     "http://localhost:5000",
      "/transactions":"http://localhost:5000",
      "/admin/stats":              "http://localhost:5000",
      "/admin/set-admin":          "http://localhost:5000",
      "/admin/clear-transactions": "http://localhost:5000",
      "/scenarios":   "http://localhost:5000",
      "/districts":   "http://localhost:5000",
      "/health":      "http://localhost:5000",
      "/socket.io":   { target: "http://localhost:5000", ws: true },
    },
  },
});
