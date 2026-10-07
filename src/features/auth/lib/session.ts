import type { QueryClient } from "@tanstack/react-query"

import { isApiError } from "@/lib/api"

import { login, logout, refreshTokens } from "../api/auth.api"
import { authQueries } from "../api/auth.queries"
import type { LoginInput, Me, Membership } from "../api/auth.schemas"
import {
  clearSession,
  getSessionState,
  setActiveWorkspaceId,
  setSessionTokens,
} from "./session-store"

let pendingRefresh: Promise<string | null> | null = null

/**
 * Exchanges the refresh token for a new token pair. Concurrent callers share
 * one request, so parallel 401s never rotate the refresh token twice.
 */
export function refreshAccessToken(): Promise<string | null> {
  pendingRefresh ??= (async () => {
    const { refreshToken } = getSessionState()
    if (!refreshToken) return null

    try {
      const tokens = await refreshTokens(refreshToken)
      setSessionTokens(tokens)
      return tokens.accessToken
    } catch {
      clearSession()
      return null
    }
  })().finally(() => {
    pendingRefresh = null
  })

  return pendingRefresh
}

/** Picks the remembered workspace if still accessible, else the first one. */
export function resolveActiveMembership(
  me: Me,
  activeWorkspaceId = getSessionState().activeWorkspaceId
): Membership | undefined {
  return (
    me.memberships.find(
      (membership) => membership.workspaceId === activeWorkspaceId
    ) ?? me.memberships[0]
  )
}

function syncActiveWorkspace(me: Me) {
  const membership = resolveActiveMembership(me)
  const nextId = membership?.workspaceId ?? null
  if (nextId !== getSessionState().activeWorkspaceId) {
    setActiveWorkspaceId(nextId)
  }
}

/**
 * Resolves the signed-in user for route guards: restores the access token
 * from the refresh token if needed and returns `null` when signed out.
 */
export async function ensureSession(
  queryClient: QueryClient
): Promise<Me | null> {
  const { accessToken, refreshToken } = getSessionState()
  if (!accessToken && !refreshToken) return null

  if (!accessToken && !(await refreshAccessToken())) return null

  try {
    const me = await queryClient.ensureQueryData(authQueries.me())
    syncActiveWorkspace(me)
    return me
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      clearSession()
      return null
    }
    throw error
  }
}

export async function signIn(queryClient: QueryClient, input: LoginInput) {
  const tokens = await login(input)
  // A new identity must never see the previous user's cached data.
  queryClient.clear()
  setSessionTokens(tokens)
  return ensureSession(queryClient)
}

/**
 * Drops the tokens and revokes the refresh token. The query cache is left to
 * the caller: clearing it while protected screens are still mounted would
 * make them refetch without a token (see `useSignOut`).
 */
export async function signOut() {
  const { refreshToken } = getSessionState()
  clearSession()
  try {
    await logout(refreshToken)
  } catch {
    // Revocation is best effort; the local session is already gone.
  }
}

export function switchWorkspace(queryClient: QueryClient, workspaceId: string) {
  setActiveWorkspaceId(workspaceId)
  // Everything except the identity is tenant scoped.
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "auth",
  })
}
