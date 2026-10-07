import { useStore } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

import type { AuthTokens } from "../api/auth.schemas"

export interface SessionState {
  /** Kept in memory only — never persisted. */
  accessToken: string | null
  /**
   * Persisted so a reload can silently restore the session. With a real
   * backend this moves to an httpOnly cookie (see plan, Faz 1 notes).
   */
  refreshToken: string | null
  /** Active tenant; sent as `X-Tenant-Id` with every request. */
  activeWorkspaceId: string | null
}

export const SESSION_STORAGE_KEY = "auth:session"

const EMPTY_SESSION: SessionState = {
  accessToken: null,
  refreshToken: null,
  activeWorkspaceId: null,
}

export const sessionStore = createStore<SessionState>()(
  persist(() => EMPTY_SESSION, {
    name: SESSION_STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
    partialize: ({ refreshToken, activeWorkspaceId }) => ({
      refreshToken,
      activeWorkspaceId,
    }),
  })
)

export const getSessionState = () => sessionStore.getState()

export function setSessionTokens(tokens: AuthTokens) {
  sessionStore.setState({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  })
}

export function setActiveWorkspaceId(activeWorkspaceId: string | null) {
  sessionStore.setState({ activeWorkspaceId })
}

/** Drops the tokens but remembers the last workspace for the next sign-in. */
export function clearSession() {
  sessionStore.setState({ accessToken: null, refreshToken: null })
}

export function resetSessionStore() {
  sessionStore.setState(EMPTY_SESSION, true)
}

export function hasSessionTokens() {
  const { accessToken, refreshToken } = getSessionState()
  return accessToken !== null || refreshToken !== null
}

export function useSessionState<T>(selector: (state: SessionState) => T) {
  return useStore(sessionStore, selector)
}
