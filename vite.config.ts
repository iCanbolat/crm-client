import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // TanStack Router plugin must run before the React plugin.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // Read by scripts/check-bundles.mjs (bundle budgets, B5.1 / B7.4).
    manifest: true,
    rolldownOptions: {
      treeshake: {
        // Feature barrels (`src/features/*/index.ts`) only re-export: without
        // this, importing one hook from a barrel (breadcrumbs → records) puts
        // every module it re-exports into the importer's chunk (Faz 8 budgets).
        // Other modules keep the default (package.json `sideEffects`).
        moduleSideEffects: (id) =>
          /\/src\/features\/[^/]+\/index\.ts$/.test(id) ? false : undefined,
      },
    },
  },
  server: {
    // app.localhost (admin) and *.forms.localhost (public renderer) in dev.
    allowedHosts: [".localhost"],
  },
})
