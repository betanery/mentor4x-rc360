import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { resolvePublicBackend } from "./scripts/public-backend-config.mjs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const backend = resolvePublicBackend(process.env);

  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(backend.url),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(backend.projectId),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(backend.publishableKey),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  // Let Rollup derive shared chunks from the import graph. Manually grouping
  // React-dependent libraries can create cycles that run before React initializes.
  };
});
