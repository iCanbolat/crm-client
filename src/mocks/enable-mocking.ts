import { env } from "@/lib/env"

import { worker } from "./browser"
import { loadPersistedDb, startDbPersistence } from "./db/persistence"
import {
  applyScenarioFromSearch,
  getScenarioState,
} from "./scenarios/scenario-store"

const apiBasePath = new URL(env.VITE_API_URL, window.location.origin).pathname

export async function enableMocking() {
  applyScenarioFromSearch(window.location.search)

  if (getScenarioState().persist) loadPersistedDb()
  startDbPersistence()

  await worker.start({
    quiet: true,
    onUnhandledFrame({ frame, defaults }) {
      // Assets, HMR and fonts pass through silently; only unmocked API calls warn.
      if (frame.protocol !== "http") return
      const { request } = frame.data as { request: Request }
      if (new URL(request.url).pathname.startsWith(apiBasePath)) {
        defaults.warn()
      }
    },
  })
}
