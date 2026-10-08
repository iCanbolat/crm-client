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
    // Read by scripts/check-public-bundle.mjs (public chunk budget, B5.1).
    manifest: true,
  },
  server: {
    // app.localhost (admin) and *.forms.localhost (public renderer) in dev.
    allowedHosts: [".localhost"],
  },
})
