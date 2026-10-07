import { apiClient } from "@/lib/api"

import {
  conversionSuggestionsSchema,
  convertLeadResultSchema,
  type ConvertLeadInput,
} from "./leads.schemas"

const segment = encodeURIComponent

export function fetchConversionSuggestions(
  leadId: string,
  signal?: AbortSignal
) {
  return apiClient.get(`/leads/${segment(leadId)}/convert/suggestions`, {
    signal,
    schema: conversionSuggestionsSchema,
  })
}

export function convertLead(leadId: string, input: ConvertLeadInput) {
  return apiClient.post(`/leads/${segment(leadId)}/convert`, {
    body: input,
    schema: convertLeadResultSchema,
  })
}
