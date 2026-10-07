import "@testing-library/jest-dom/vitest"
import "./polyfills"

import { cleanup } from "@testing-library/react"
import { toast } from "sonner"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

import { bindApiClientToSession, resetSessionStore } from "@/features/auth"
import { resetUiPreferences } from "@/features/shell"
import i18n from "@/lib/i18n"
import { resetDb } from "@/mocks/db"
import { server } from "@/mocks/node"
import { resetScenarioState } from "@/mocks/scenarios/scenario-store"

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" })
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
