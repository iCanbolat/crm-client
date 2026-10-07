import { describe, expect, it } from "vitest"

import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { server } from "@/mocks/node"
import { signInAs } from "@/test/auth"
import { createTestQueryClient } from "@/test/render"

import { authKeys } from "../api/auth.keys"
import {
  ensureSession,
  refreshAccessToken,
  resolveActiveMembership,
  switchWorkspace,
} from "../lib/session"
import {
  getSessionState,
  sessionStore,
  setActiveWorkspaceId,
} from "../lib/session-store"

describe("session lifecycle", () => {
  it("shares one refresh request between concurrent callers", async () => {
    signInAs("owner")
    const before = getSessionState().refreshToken
    let refreshCalls = 0
    server.events.on("request:start", ({ request }) => {
      if (request.url.endsWith("/auth/refresh")) refreshCalls++
    })

    const [first, second] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
    ])

    expect(first).toBe(second)
    expect(first).toMatch(/^mock-at\./)
    expect(refreshCalls).toBe(1)
    // Rotation: a brand new refresh token is stored.
    expect(getSessionState().refreshToken).not.toBe(before)
  })

  it("returns null without tokens and clears the session on a bad refresh", async () => {
    await expect(refreshAccessToken()).resolves.toBeNull()

    sessionStore.setState({ refreshToken: "mock-rt.bozuk" })
    await expect(refreshAccessToken()).resolves.toBeNull()
    expect(getSessionState().refreshToken).toBeNull()
  })

  it("falls back to the first membership when the stored workspace is gone", async () => {
    signInAs("owner")
    setActiveWorkspaceId("ws_silinmis")
    const queryClient = createTestQueryClient()

    const me = await ensureSession(queryClient)

    expect(me?.memberships.map((item) => item.workspaceId)).toEqual([
      WORKSPACE_IDS.acme,
      WORKSPACE_IDS.marmara,
    ])
    expect(getSessionState().activeWorkspaceId).toBe(WORKSPACE_IDS.acme)
    expect(resolveActiveMembership(me!, WORKSPACE_IDS.marmara)?.role).toBe(
      "admin"
    )
  })

  it("switching workspace keeps the identity but drops tenant data", () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(authKeys.me(), { cached: true })
    queryClient.setQueryData(["workspace", "current"], { id: "ws_acme" })
    queryClient.setQueryData(["examples", "list"], [])

    switchWorkspace(queryClient, WORKSPACE_IDS.marmara)

    expect(getSessionState().activeWorkspaceId).toBe(WORKSPACE_IDS.marmara)
    expect(queryClient.getQueryData(authKeys.me())).toEqual({ cached: true })
    expect(queryClient.getQueryData(["workspace", "current"])).toBeUndefined()
    expect(queryClient.getQueryData(["examples", "list"])).toBeUndefined()
  })
})
