import { beforeEach, describe, expect, it } from "vitest"

import { apiClient, isApiError } from "@/lib/api"
import i18n from "@/lib/i18n"
import {
  applyScenarioFromSearch,
  DEFAULT_SCENARIO_STATE,
  getScenarioState,
  resetScenarioState,
  setScenarioState,
} from "@/mocks/scenarios/scenario-store"
import { getRequestLanguage } from "@/mocks/utils/http"
import { signInAs } from "@/test/auth"

async function catchError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("Expected the request to fail")
}

beforeEach(() => {
  signInAs("owner")
})

describe("scenario store", () => {
  it("applies a valid ?msw-scenario= param and ignores unknown values", () => {
    applyScenarioFromSearch("?msw-scenario=error")
    expect(getScenarioState().scenario).toBe("error")

    applyScenarioFromSearch("?msw-scenario=bogus")
    expect(getScenarioState().scenario).toBe("error")
  })

  it("persists only the scenario and persist flag", () => {
    setScenarioState({ scenario: "slow", persist: true, delayMs: 999 })

    const stored = JSON.parse(localStorage.getItem("msw:scenario")!)
    expect(stored.state).toEqual({ scenario: "slow", persist: true })

    resetScenarioState()
    expect(getScenarioState()).toEqual(DEFAULT_SCENARIO_STATE)
  })
})

describe("withScenario", () => {
  it("TC-0.4-03 returns a localized 500 envelope in the error scenario", async () => {
    setScenarioState({ scenario: "error" })

    const error = await catchError(apiClient.get("/examples"))

    expect(isApiError(error)).toBe(true)
    expect(error).toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Mock sunucu hatası (senaryo: hata).",
    })
  })

  it("TC-0.4-03 answers in the request language", async () => {
    setScenarioState({ scenario: "error" })
    await i18n.changeLanguage("en")

    const error = await catchError(apiClient.get("/examples"))

    expect(error).toMatchObject({
      message: "Mock server error (scenario: error).",
    })
  })

  it("TC-0.4-06 returns an empty page in the empty scenario", async () => {
    setScenarioState({ scenario: "empty" })

    await expect(
      apiClient.get("/examples", { query: { page: 2 } })
    ).resolves.toEqual({
      data: [],
      meta: { page: 2, pageSize: 5, total: 0 },
    })
  })

  it("TC-0.4-06 fails mutations with 422 in the validation scenario but keeps reads working", async () => {
    setScenarioState({ scenario: "validation" })

    await expect(apiClient.get("/examples")).resolves.toMatchObject({
      meta: { total: 24 },
    })
    const error = await catchError(
      apiClient.post("/examples", { body: { name: "Geçerli isim" } })
    )
    expect(error).toMatchObject({
      status: 422,
      fieldErrors: { name: ["Mock doğrulama hatası (senaryo: doğrulama)."] },
    })
  })

  it("TC-0.4-06 delays responses in the slow scenario", async () => {
    setScenarioState({ scenario: "slow", slowDelayMs: 120 })

    const startedAt = performance.now()
    await apiClient.get("/examples")

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(100)
  })
})

describe("getRequestLanguage", () => {
  it.each([
    ["en-US,en;q=0.9", "en"],
    ["tr-TR", "tr"],
    ["de-DE", "tr"],
    [null, "tr"],
  ])("maps Accept-Language %s to %s", (header, expected) => {
    const request = new Request("http://localhost/api", {
      headers: header ? { "accept-language": header } : {},
    })
    expect(getRequestLanguage(request)).toBe(expected)
  })
})
