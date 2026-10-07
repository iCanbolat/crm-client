import { apiClient } from "@/lib/api"

import { searchResponseSchema } from "./search.schemas"

export function searchRecords(q: string, signal?: AbortSignal) {
  return apiClient.get("/search", {
    query: { q },
    signal,
    schema: searchResponseSchema,
  })
}
