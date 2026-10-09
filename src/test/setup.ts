import "@testing-library/jest-dom/vitest"
import "./polyfills"

import { cleanup, configure } from "@testing-library/react"
import { toast } from "sonner"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

import { bindApiClientToSession, resetSessionStore } from "@/features/auth"
import { resetUiPreferences } from "@/features/shell"
import i18n, { loadAdminResources } from "@/lib/i18n"
import { resetDb } from "@/mocks/db"
import { server } from "@/mocks/node"
import { resetScenarioState } from "@/mocks/scenarios/scenario-store"

// Lazy chunks (dashboard widgets, charts) resolve slower when every test
// file runs in parallel under coverage.
configure({ asyncUtilTimeout: 3_000 })

beforeAll(async () => {
  server.listen({ onUnhandledFrame: "error" })
  await loadAdminResources()
})

beforeEach(async () => {
  localStorage.clear()
  resetSessionStore()
  resetUiPreferences()
  // Route tests rebind with the router's redirect; API tests only need tokens.
  bindApiClientToSession({ onSessionExpired: () => {} })
  document.documentElement.className = ""
  resetDb()
  resetScenarioState({ delayMs: 0, slowDelayMs: 50 })
  await i18n.changeLanguage("tr")
})

afterEach(() => {
  // sonner keeps toasts in a module-level store and replays active ones on mount.
  toast.dismiss()
  cleanup()
  server.resetHandlers()
  server.events.removeAllListeners()
})

afterAll(() => {
  server.close()
})
