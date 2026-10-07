import { describe, expect, it, vi } from "vitest"

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

import { ApiError } from "@/lib/api"
import { createQueryClient, shouldRetryQuery } from "@/lib/query-client"

const httpError = (status: number, fieldErrors?: Record<string, string[]>) =>
  new ApiError({
    kind: "http",
    status,
    code: `HTTP_${status}`,
    message: "x",
    fieldErrors,
  })

async function runMutation(
  mutationFn: () => Promise<unknown>,
  meta?: { suppressErrorToast?: boolean; successMessage?: string }
) {
  const client = createQueryClient()
  const mutation = client.getMutationCache().build(client, { mutationFn, meta })
  await mutation.execute(undefined).catch(() => {})
}

describe("shouldRetryQuery", () => {
  it("never retries client errors or contract violations", () => {
    expect(shouldRetryQuery(0, httpError(404))).toBe(false)
    expect(shouldRetryQuery(0, httpError(422))).toBe(false)
    expect(
      shouldRetryQuery(
        0,
        new ApiError({
          kind: "invalid_response",
          status: 200,
          code: "INVALID_RESPONSE",
          message: "x",
        })
      )
    ).toBe(false)
  })

  it("retries server and network errors at most twice", () => {
    expect(shouldRetryQuery(0, httpError(503))).toBe(true)
    expect(shouldRetryQuery(1, new Error("network"))).toBe(true)
    expect(shouldRetryQuery(2, httpError(503))).toBe(false)
  })
})

describe("createQueryClient", () => {
  it("applies defaults and lets callers override them", () => {
    const client = createQueryClient({ queries: { staleTime: 0 } })
    const defaults = client.getDefaultOptions()

    expect(defaults.queries?.staleTime).toBe(0)
    expect(defaults.queries?.retry).toBe(shouldRetryQuery)
    expect(defaults.mutations?.retry).toBe(false)
  })

  it("shows a success toast when the mutation declares a message", async () => {
    await runMutation(() => Promise.resolve("ok"), {
      successMessage: "Kaydedildi",
    })

    expect(toast.success).toHaveBeenCalledWith("Kaydedildi")
  })

  it("shows a localized error toast for failed mutations", async () => {
    await runMutation(() => Promise.reject(httpError(500)))

    expect(toast.error).toHaveBeenCalledWith(
      "Sunucuda bir hata oluştu. Lütfen biraz sonra tekrar deneyin."
    )
  })

  it("skips the toast for validation errors and suppressed mutations", async () => {
    await runMutation(() => Promise.reject(httpError(422, { name: ["x"] })))
    await runMutation(() => Promise.reject(httpError(500)), {
      suppressErrorToast: true,
    })

    expect(toast.error).not.toHaveBeenCalled()
  })
})
