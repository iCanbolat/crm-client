import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { searchRecords } from "./search.api"
import { SEARCH_MIN_LENGTH } from "./search.schemas"

export const searchKeys = {
  all: ["search"] as const,
  results: (q: string) => [...searchKeys.all, q] as const,
}

export const searchQueries = {
  results: (q: string) =>
    queryOptions({
      queryKey: searchKeys.results(q),
      queryFn: ({ signal }) => searchRecords(q, signal),
      enabled: q.length >= SEARCH_MIN_LENGTH,
      placeholderData: keepPreviousData,
      staleTime: 10_000,
    }),
}
