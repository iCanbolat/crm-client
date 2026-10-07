import { queryOptions } from "@tanstack/react-query"

import {
  fetchQuote,
  fetchQuoteDraft,
  type QuoteDraftParams,
} from "./quotes.api"

export const quoteKeys = {
  all: ["forwarding", "quotes"] as const,
  detail: (id: string, version?: number) =>
    [...quoteKeys.all, "detail", id, version ?? "latest"] as const,
  details: (id: string) => [...quoteKeys.all, "detail", id] as const,
  draft: (params: QuoteDraftParams) =>
    [
      ...quoteKeys.all,
      "draft",
      params.leadId ?? null,
      params.dealId ?? null,
      params.companyId ?? null,
    ] as const,
}

export const quoteQueries = {
  // Awaited by route loaders: no abort signal (see records.queries).
  detail: (id: string, version?: number) =>
    queryOptions({
      queryKey: quoteKeys.detail(id, version),
      queryFn: () => fetchQuote(id, version),
    }),
  draft: (params: QuoteDraftParams) =>
    queryOptions({
      queryKey: quoteKeys.draft(params),
      queryFn: () => fetchQuoteDraft(params),
      staleTime: 0,
    }),
}
