import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: { port: 5174, strictPort: true, host: "127.0.0.1" },
  preview: { port: 5274, strictPort: true, host: "127.0.0.1" },
  build: {
    outDir: process.env.VITE_OUT_DIR ?? "dist",
    sourcemap: false,
    ...(process.env.VITE_SINGLE === "1"
      ? { assetsInlineLimit: 4_000_000, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
      : {}),
  },
  optimizeDeps: { include: ["react", "react-dom", "react-router-dom", "@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-search", "qrcode"] },
});
