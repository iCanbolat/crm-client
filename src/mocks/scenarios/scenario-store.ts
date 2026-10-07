import { useStore } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

export const SCENARIOS = [
  "default",
  "empty",
  "error",
  "slow",
  "validation",
] as const

export type Scenario = (typeof SCENARIOS)[number]

export const SCENARIO_QUERY_PARAM = "msw-scenario"

export interface ScenarioState {
  scenario: Scenario
  /** Artificial latency applied to every mocked response. */
  delayMs: number
  /** Latency used by the `slow` scenario. */
  slowDelayMs: number
  /** Persist the mock database in localStorage across reloads. */
  persist: boolean
}

export const DEFAULT_SCENARIO_STATE: ScenarioState = {
  scenario: "default",
  delayMs: 300,
  slowDelayMs: 2000,
  persist: false,
}

export function isScenario(value: unknown): value is Scenario {
  return SCENARIOS.includes(value as Scenario)
}

export const scenarioStore = createStore<ScenarioState>()(
  persist(() => DEFAULT_SCENARIO_STATE, {
    name: "msw:scenario",
    storage: createJSONStorage(() => localStorage),
    partialize: ({ scenario, persist }) => ({ scenario, persist }),
  })
)

export const getScenarioState = () => scenarioStore.getState()

export function setScenarioState(patch: Partial<ScenarioState>) {
  scenarioStore.setState(patch)
}

export function resetScenarioState(patch: Partial<ScenarioState> = {}) {
  scenarioStore.setState({ ...DEFAULT_SCENARIO_STATE, ...patch }, true)
}

/** `?msw-scenario=error` lets E2E tests and shared links pick a scenario. */
export function applyScenarioFromSearch(search: string) {
  const value = new URLSearchParams(search).get(SCENARIO_QUERY_PARAM)
  if (isScenario(value)) setScenarioState({ scenario: value })
}

export function useScenarioState<T>(selector: (state: ScenarioState) => T) {
  return useStore(scenarioStore, selector)
}
