import type { AutomationRuleInput } from "@/engine/automation"
import { apiClient } from "@/lib/api"

import {
  automationRuleListSchema,
  automationRuleSchema,
  automationRunListSchema,
} from "./automation.schemas"

const segment = (id: string) => encodeURIComponent(id)

export function fetchAutomations(signal?: AbortSignal) {
  return apiClient.get("/automations", {
    signal,
    schema: automationRuleListSchema,
  })
}

export function fetchAutomation(id: string, signal?: AbortSignal) {
  return apiClient.get(`/automations/${segment(id)}`, {
    signal,
    schema: automationRuleSchema,
  })
}

export function fetchAutomationRuns(id: string, signal?: AbortSignal) {
  return apiClient.get(`/automations/${segment(id)}/runs`, {
    signal,
    schema: automationRunListSchema,
  })
}

export function createAutomation(input: AutomationRuleInput) {
  return apiClient.post("/automations", {
    body: input,
    schema: automationRuleSchema,
  })
}

export function updateAutomation(
  id: string,
  input: Partial<AutomationRuleInput>
) {
  return apiClient.patch(`/automations/${segment(id)}`, {
    body: input,
    schema: automationRuleSchema,
  })
}

export function deleteAutomation(id: string) {
  return apiClient.delete(`/automations/${segment(id)}`)
}
