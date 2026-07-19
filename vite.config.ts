import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  base: "/",
  server: {
    host: "::",
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('react-router-dom')) return 'vendor-router';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('jspdf')) return 'vendor-pdf';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('i18next')) return 'vendor-i18n';
          }
        },
      },
      plugins: [
        visualizer({ filename: "dist/bundle-report.html", gzipSize: true, brotliSize: true }),
      ],
    },
  },
}));

