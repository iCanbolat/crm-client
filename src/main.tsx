import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"

import { AdminApp } from "@/app/admin-app"

async function bootstrap() {
  // Statically replaced by Vite, so MSW is tree-shaken out of production builds.
  if (import.meta.env.VITE_ENABLE_MSW === "true") {
    const { enableMocking } = await import("@/mocks/enable-mocking")
    await enableMocking()
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>
  )
}

void bootstrap()
