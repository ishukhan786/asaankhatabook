import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
// import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "::",
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react() /*, mode === "development" && componentTagger()*/].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Target modern Electron Chromium — no need for legacy transpilation
    target: "es2020",
    sourcemap: false,
    // Reduce chunk size warnings threshold for Electron (larger bundles are fine)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split vendor libraries into separate cached chunks
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
          // generate an interactive bundle report at dist/bundle-report.html
          visualizer({ filename: "dist/bundle-report.html", gzipSize: true, brotliSize: true }),
        ],
      },
  },
}));
