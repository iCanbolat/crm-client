import { getScenarioState } from "../scenarios/scenario-store"

import { onDbChange, restoreDb, snapshotDb, type DbSnapshot } from "./index"

/** Bump the version whenever a collection shape changes. */
export const DB_STORAGE_KEY = "msw:db:v9"

export function savePersistedDb() {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(snapshotDb()))
  } catch {
    // Storage full or unavailable — persistence is best effort.
  }
}

export function loadPersistedDb(): boolean {
  const raw = localStorage.getItem(DB_STORAGE_KEY)
  if (!raw) return false

  try {
    restoreDb(JSON.parse(raw) as Partial<DbSnapshot>)
    return true
  } catch {
    localStorage.removeItem(DB_STORAGE_KEY)
    return false
  }
}

export function clearPersistedDb() {
  localStorage.removeItem(DB_STORAGE_KEY)
}

/** Saves every DB change while the `persist` toggle is on. */
export function startDbPersistence() {
  return onDbChange(() => {
    if (getScenarioState().persist) savePersistedDb()
  })
}
