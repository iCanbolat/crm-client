import { QueryObserver } from "@tanstack/react-query"
import { screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api"
import { ForbiddenError } from "@/lib/rbac"
import { setScenarioState } from "@/mocks/scenarios/scenario-store"
import { renderRoute } from "@/test/render"

import {
  installGlobalErrorHandlers,
  isReportable,
  reportError,
  setErrorReporter,
} from "../error-reporting"
import { createQueryClient } from "../query-client"

const apiError = (status: number, kind: ApiError["kind"] = "http") =>
  new ApiError({ kind, status, code: "X", message: "x" })

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

function spyReporter() {
  const reporter = vi.fn()
  restore = setErrorReporter(reporter)
  return reporter
}

describe("error reporting (B7.4)", () => {
  it("reports bugs, not expected outcomes", () => {
    expect(isReportable(new Error("boom"))).toBe(true)
    expect(isReportable(apiError(500))).toBe(true)
    expect(isReportable(apiError(200, "invalid_response"))).toBe(true)
    expect(isReportable(apiError(404))).toBe(false)
    expect(isReportable(apiError(422))).toBe(false)
    expect(isReportable(apiError(0, "network"))).toBe(false)
    expect(isReportable(new ForbiddenError())).toBe(false)
  })

  it("forwards to the installed reporter and survives a failing one", () => {
    const reporter = spyReporter()
    reportError(new Error("boom"), { source: "window" })
    reportError(apiError(404), { source: "query" })
    expect(reporter).toHaveBeenCalledOnce()
    expect(reporter).toHaveBeenCalledWith(expect.any(Error), {
      source: "window",
    })

    setErrorReporter(() => {
      throw new Error("reporter down")
    })
    expect(() =>
      reportError(new Error("boom"), { source: "window" })
    ).not.toThrow()
  })

  it("catches uncaught errors and unhandled rejections", () => {
    const reporter = spyReporter()
    const uninstall = installGlobalErrorHandlers()
    const error = new Error("uncaught")
    window.dispatchEvent(new ErrorEvent("error", { error }))
    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent
    Object.assign(rejection, { reason: apiError(503) })
    window.dispatchEvent(rejection)
    uninstall()
    window.dispatchEvent(new ErrorEvent("error", { error }))

    expect(reporter.mock.calls.map(([, context]) => context.source)).toEqual([
      "window",
      "unhandledrejection",
    ])
  })

  it("TC-7.4-03 reports failed queries and mutations with their keys", async () => {
    const reporter = spyReporter()
    const client = createQueryClient({ queries: { retry: false } })
    const observer = new QueryObserver(client, {
      queryKey: ["reports", "x"],
      queryFn: () => Promise.reject(apiError(500)),
    })
    const unsubscribe = observer.subscribe(() => {})
    await vi.waitFor(() => expect(reporter).toHaveBeenCalled())
    unsubscribe()
    expect(reporter).toHaveBeenCalledWith(expect.any(ApiError), {
      source: "query",
      tags: { queryKey: '["reports","x"]' },
    })

    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ["save"],
        mutationFn: () => Promise.reject(new Error("save failed")),
      })
      .execute(undefined)
      .catch(() => {})
    expect(reporter).toHaveBeenLastCalledWith(expect.any(Error), {
      source: "mutation",
      tags: { mutationKey: '["save"]' },
    })
  })

  it("TC-7.4-03 reports route errors", async () => {
    const reporter = spyReporter()
    setScenarioState({ scenario: "error" })
    await renderRoute("/reports/leadSources", { as: "owner" })
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(reporter).toHaveBeenCalledWith(expect.any(ApiError), {
      source: "route",
    })
  })
})
