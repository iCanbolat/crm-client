import { apiClient } from "@/lib/api"

import {
  exampleItemSchema,
  exampleListResponseSchema,
  type CreateExampleInput,
  type ExampleListParams,
} from "./example.schemas"

export function fetchExamples(params: ExampleListParams, signal?: AbortSignal) {
  return apiClient.get("/examples", {
    query: params,
    signal,
    schema: exampleListResponseSchema,
  })
}

export function createExample(input: CreateExampleInput) {
  return apiClient.post("/examples", {
    body: input,
    schema: exampleItemSchema,
  })
}

export function deleteExample(id: string) {
  return apiClient.delete(`/examples/${encodeURIComponent(id)}`)
}
