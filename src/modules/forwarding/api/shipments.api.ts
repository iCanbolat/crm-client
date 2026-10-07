import { apiClient } from "@/lib/api"

import { milestoneListSchema, type MilestoneInput } from "./shipments.schemas"

const segment = encodeURIComponent

export function fetchMilestones(shipmentId: string, signal?: AbortSignal) {
  return apiClient.get(`/shipments/${segment(shipmentId)}/milestones`, {
    signal,
    schema: milestoneListSchema,
  })
}

export function recordMilestone(shipmentId: string, input: MilestoneInput) {
  return apiClient.post(`/shipments/${segment(shipmentId)}/milestones`, {
    body: input,
    schema: milestoneListSchema,
  })
}
