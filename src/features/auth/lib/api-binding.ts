import { configureApiClient } from "@/lib/api"

import { refreshAccessToken } from "./session"
import { clearSession, getSessionState } from "./session-store"

/**
 * Wires the session into the API client: bearer token, `X-Tenant-Id`,
 * silent refresh on 401 and a callback once the session is unrecoverable.
 */
export function bindApiClientToSession(options: {
  onSessionExpired: () => void
}) {
  configureApiClient({
    getAccessToken: () => getSessionState().accessToken,
    getTenantId: () => getSessionState().activeWorkspaceId,
    refreshAccessToken,
    onAuthFailure: () => {
      clearSession()
      options.onSessionExpired()
    },
  })
}
