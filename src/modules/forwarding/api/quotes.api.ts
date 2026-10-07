import { apiClient } from "@/lib/api"

import {
  quoteDraftSchema,
  quoteSchema,
  quoteStatusResultSchema,
  type QuoteInput,
  type QuoteStatusInput,
} from "./quotes.schemas"

const segment = encodeURIComponent

export interface QuoteDraftParams {
  leadId?: string
  dealId?: string
  companyId?: string
}

export function fetchQuoteDraft(
  params: QuoteDraftParams,
  signal?: AbortSignal
) {
  return apiClient.get("/quotes/draft", {
    signal,
    query: {
      leadId: params.leadId,
      dealId: params.dealId,
      companyId: params.companyId,
    },
    schema: quoteDraftSchema,
  })
}

export function fetchQuote(id: string, version?: number) {
  return apiClient.get(`/quotes/${segment(id)}`, {
    query: { version },
    schema: quoteSchema,
  })
}

export function createQuote(input: QuoteInput) {
  return apiClient.post("/quotes", { body: input, schema: quoteSchema })
}

export function updateQuote(id: string, input: QuoteInput) {
  return apiClient.patch(`/quotes/${segment(id)}`, {
    body: input,
    schema: quoteSchema,
  })
}

export function reviseQuote(id: string) {
  return apiClient.post(`/quotes/${segment(id)}/revise`, {
    schema: quoteSchema,
  })
}

export function changeQuoteStatus(id: string, input: QuoteStatusInput) {
  return apiClient.post(`/quotes/${segment(id)}/status`, {
    body: input,
    schema: quoteStatusResultSchema,
  })
}
