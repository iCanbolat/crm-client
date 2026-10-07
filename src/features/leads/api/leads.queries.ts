import { queryOptions } from "@tanstack/react-query"

import { fetchConversionSuggestions } from "./leads.api"

export const leadKeys = {
  all: ["leads"] as const,
  suggestions: (leadId: string) =>
    [...leadKeys.all, "conversion-suggestions", leadId] as const,
}

export const leadQueries = {
  suggestions: (leadId: string) =>
    queryOptions({
      queryKey: leadKeys.suggestions(leadId),
      queryFn: ({ signal }) => fetchConversionSuggestions(leadId, signal),
      staleTime: 0,
    }),
}
