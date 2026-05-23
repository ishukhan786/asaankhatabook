import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
        manualChunks: {
          // Core React — smallest, cached longest
          "vendor-react": ["react", "react-dom", "react/jsx-runtime"],
          // React Router
          "vendor-router": ["react-router-dom"],
          // Supabase client
          "vendor-supabase": ["@supabase/supabase-js"],
          // TanStack Query (data fetching)
          "vendor-query": ["@tanstack/react-query"],
          // Charts
          "vendor-charts": ["recharts"],
          // PDF generation — heaviest, lazy loaded
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          // Radix UI primitives
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
          ],
          // Animation
          "vendor-motion": ["framer-motion"],
          // i18n
          "vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
        },
      },
    },
  },
}));
