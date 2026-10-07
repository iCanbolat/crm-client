import { useStore } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

export interface UiPreferences {
  /** Desktop sidebar expanded (true) or collapsed to icons (false). */
  sidebarOpen: boolean
}

export const UI_PREFERENCES_STORAGE_KEY = "ui:preferences"

const DEFAULT_PREFERENCES: UiPreferences = { sidebarOpen: true }

export const uiPreferencesStore = createStore<UiPreferences>()(
  persist(() => DEFAULT_PREFERENCES, {
    name: UI_PREFERENCES_STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
  })
)

export function setSidebarOpen(sidebarOpen: boolean) {
  uiPreferencesStore.setState({ sidebarOpen })
}

export function resetUiPreferences() {
  uiPreferencesStore.setState(DEFAULT_PREFERENCES, true)
}

export function useUiPreferences<T>(selector: (state: UiPreferences) => T) {
  return useStore(uiPreferencesStore, selector)
}
