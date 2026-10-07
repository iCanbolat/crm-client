import { apiClient } from "@/lib/api"

import { boardResponseSchema, type BoardParams } from "./pipelines.schemas"

export function fetchBoard(
  objectKey: string,
  params: BoardParams,
  signal?: AbortSignal
) {
  return apiClient.get(`/records/${encodeURIComponent(objectKey)}/board`, {
    query: {
      q: params.q,
      filters: params.filters?.length
        ? JSON.stringify(params.filters)
        : undefined,
    },
    signal,
    schema: boardResponseSchema,
  })
}
