import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import {
  ApiError,
  apiClient,
  buildUrl,
  configureApiClient,
  isApiError,
} from "@/lib/api"
import i18n from "@/lib/i18n"
import { server } from "@/mocks/node"

const API = "http://localhost:3000/api"

async function catchError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("Expected the request to fail")
}

describe("apiClient", () => {
  afterEach(() => {
    configureApiClient({
      getAccessToken: undefined,
      getTenantId: undefined,
      refreshAccessToken: undefined,
      onAuthFailure: undefined,
    })
  })

  it("builds URLs against the API base and skips empty query values", () => {
    const url = buildUrl("/examples", {
      page: 2,
      q: "",
      status: ["active", "archived"],
      sort: undefined,
      archived: false,
    })

    expect(url.toString()).toBe(
      `${API}/examples?page=2&status=active&status=archived&archived=false`
    )
  })

  it("parses successful responses with the given zod contract", async () => {
    server.use(http.get(`${API}/ping`, () => HttpResponse.json({ ok: true })))

    const result = await apiClient.get("/ping", {
      schema: z.object({ ok: z.boolean() }),
    })

    expect(result).toEqual({ ok: true })
  })

  it("sends JSON bodies plus language, auth and tenant headers", async () => {
    let captured: Request | undefined
    server.use(
      http.post(`${API}/echo`, async ({ request }) => {
        captured = request.clone()
        return HttpResponse.json(await request.json(), { status: 201 })
      })
    )
    configureApiClient({
      getAccessToken: () => "token-123",
      getTenantId: () => "tenant-1",
    })
    await i18n.changeLanguage("en")

    const result = await apiClient.post("/echo", { body: { name: "Acme" } })

    expect(result).toEqual({ name: "Acme" })
    expect(captured?.headers.get("content-type")).toBe("application/json")
    expect(captured?.headers.get("accept-language")).toBe("en")
    expect(captured?.headers.get("authorization")).toBe("Bearer token-123")
    expect(captured?.headers.get("x-tenant-id")).toBe("tenant-1")
  })

  it("returns undefined for 204 responses", async () => {
    server.use(
      http.delete(
        `${API}/items/1`,
        () => new HttpResponse(null, { status: 204 })
      )
    )

    await expect(apiClient.delete("/items/1")).resolves.toBeUndefined()
  })

  it("TC-0.3-01 maps an API error envelope (4xx) to ApiError", async () => {
    server.use(
      http.get(`${API}/secret`, () =>
        HttpResponse.json(
          { error: { code: "FORBIDDEN", message: "Yetkiniz yok" } },
          { status: 403 }
        )
      )
    )

    const error = await catchError(apiClient.get("/secret"))

    expect(isApiError(error)).toBe(true)
    expect(error).toMatchObject({
      kind: "http",
      status: 403,
      code: "FORBIDDEN",
      message: "Yetkiniz yok",
    })
  })

  it("TC-0.3-01 maps 5xx responses without an envelope", async () => {
    server.use(
      http.get(`${API}/boom`, () => new HttpResponse("oops", { status: 503 }))
    )

    const error = await catchError(apiClient.get("/boom"))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      kind: "http",
      status: 503,
      code: "HTTP_503",
      details: "oops",
    })
    expect((error as ApiError).isServerError).toBe(true)
  })

  it("TC-0.3-01 maps network failures to a NETWORK_ERROR", async () => {
    server.use(http.get(`${API}/offline`, () => HttpResponse.error()))

    const error = await catchError(apiClient.get("/offline"))

    expect(error).toMatchObject({
      kind: "network",
      status: 0,
      code: "NETWORK_ERROR",
    })
  })

  it("TC-0.3-01 rejects responses that break the contract", async () => {
    server.use(http.get(`${API}/ping`, () => HttpResponse.json({ ok: "yes" })))

    const error = await catchError(
      apiClient.get("/ping", { schema: z.object({ ok: z.boolean() }) })
    )

    expect(error).toMatchObject({
      kind: "invalid_response",
      code: "INVALID_RESPONSE",
    })
    expect((error as ApiError).details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ["ok"] })])
    )
  })

  it("TC-0.3-02 preserves 422 field errors", async () => {
    server.use(
      http.post(`${API}/examples`, () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Geçersiz",
              fieldErrors: { name: ["Zorunlu alan"], email: ["Geçersiz"] },
            },
          },
          { status: 422 }
        )
      )
    )

    const error = (await catchError(
      apiClient.post("/examples", { body: {} })
    )) as ApiError

    expect(error.isValidationError).toBe(true)
    expect(error.fieldErrors).toEqual({
      name: ["Zorunlu alan"],
      email: ["Geçersiz"],
    })
  })

  it("rethrows aborts untouched so TanStack Query can cancel", async () => {
    server.use(
      http.get(`${API}/slow`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return HttpResponse.json({})
      })
    )
    const controller = new AbortController()

    const promise = catchError(
      apiClient.get("/slow", { signal: controller.signal })
    )
    controller.abort()
    const error = await promise

    expect(isApiError(error)).toBe(false)
    expect((error as Error).name).toBe("AbortError")
  })

  describe("401 handling", () => {
    function protectedEndpoint(validToken: string) {
      const seen: (string | null)[] = []
      server.use(
        http.get(`${API}/private`, ({ request }) => {
          const header = request.headers.get("authorization")
          seen.push(header)
          return header === `Bearer ${validToken}`
            ? HttpResponse.json({ ok: true })
            : HttpResponse.json(
                { error: { code: "TOKEN_EXPIRED", message: "expired" } },
                { status: 401 }
              )
        })
      )
      return seen
    }

    it("TC-1.1-04 refreshes the token once and replays the request", async () => {
      let token = "stale"
      const seen = protectedEndpoint("fresh")
      const refreshAccessToken = vi.fn(async () => {
        token = "fresh"
        return token
      })
      const onAuthFailure = vi.fn()
      configureApiClient({
        getAccessToken: () => token,
        refreshAccessToken,
        onAuthFailure,
      })

      await expect(apiClient.get("/private")).resolves.toEqual({ ok: true })

      expect(refreshAccessToken).toHaveBeenCalledTimes(1)
      expect(seen).toEqual(["Bearer stale", "Bearer fresh"])
      expect(onAuthFailure).not.toHaveBeenCalled()
    })

    it("TC-1.1-04 reports an unrecoverable session when refresh fails", async () => {
      protectedEndpoint("fresh")
      const onAuthFailure = vi.fn()
      configureApiClient({
        getAccessToken: () => "stale",
        refreshAccessToken: async () => null,
        onAuthFailure,
      })

      const error = await catchError(apiClient.get("/private"))

      expect(error).toMatchObject({ status: 401, code: "TOKEN_EXPIRED" })
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
    })

    it("does not loop when the replayed request is rejected again", async () => {
      const seen = protectedEndpoint("never")
      const refreshAccessToken = vi.fn(async () => "still-wrong")
      const onAuthFailure = vi.fn()
      configureApiClient({
        getAccessToken: () => "stale",
        refreshAccessToken,
        onAuthFailure,
      })

      await expect(apiClient.get("/private")).rejects.toMatchObject({
        status: 401,
      })
      expect(seen).toHaveLength(2)
      expect(refreshAccessToken).toHaveBeenCalledTimes(1)
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
    })

    it("skips token and refresh for public endpoints (auth: false)", async () => {
      const seen = protectedEndpoint("fresh")
      const refreshAccessToken = vi.fn(async () => "fresh")
      configureApiClient({ getAccessToken: () => "stale", refreshAccessToken })

      await expect(
        apiClient.get("/private", { auth: false })
      ).rejects.toMatchObject({ status: 401 })
      expect(seen).toEqual([null])
      expect(refreshAccessToken).not.toHaveBeenCalled()
    })
  })
})
