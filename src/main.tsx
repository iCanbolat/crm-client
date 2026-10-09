import { StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"

import { resolveAppMode } from "@/app/app-mode"
import { env } from "@/lib/env"
import { installGlobalErrorHandlers } from "@/lib/error-reporting"
import { loadAdminResources } from "@/lib/i18n"

async function loadApp(): Promise<ReactNode> {
  const appMode = resolveAppMode(window.location.host, window.location.search, {
    appHost: env.VITE_APP_HOST,
    allowHostOverride: import.meta.env.DEV,
  })

  // Separate chunks: the public form site never downloads the admin app.
  if (appMode.mode === "public") {
    const { PublicApp } = await import("@/app/public-app")
    return <PublicApp host={appMode.host} />
  }
  const [{ AdminApp }] = await Promise.all([
    import("@/app/admin-app"),
    loadAdminResources(),
  ])
  return <AdminApp />
}

async function bootstrap() {
  installGlobalErrorHandlers()
  // Statically replaced by Vite, so MSW is tree-shaken out of production builds.
  if (import.meta.env.VITE_ENABLE_MSW === "true") {
    const { enableMocking } = await import("@/mocks/enable-mocking")
    await enableMocking()
  }

  const app = await loadApp()
  createRoot(document.getElementById("root")!).render(
    <StrictMode>{app}</StrictMode>
  )
}

void bootstrap()
