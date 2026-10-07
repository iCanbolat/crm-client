import { apiClient } from "@/lib/api"

import {
  formListResponseSchema,
  formSchema,
  formStatsSchema,
  type CreateFormInput,
  type FormListParams,
  type UpdateFormInput,
} from "./forms.schemas"

const segment = encodeURIComponent

export function fetchForms(params: FormListParams, signal?: AbortSignal) {
  return apiClient.get("/forms", {
    query: params,
    signal,
    schema: formListResponseSchema,
  })
}

export function fetchForm(id: string) {
  return apiClient.get(`/forms/${segment(id)}`, { schema: formSchema })
}

export function fetchFormStats(id: string, signal?: AbortSignal) {
  return apiClient.get(`/forms/${segment(id)}/stats`, {
    signal,
    schema: formStatsSchema,
  })
}

export function createForm(input: CreateFormInput) {
  return apiClient.post("/forms", { body: input, schema: formSchema })
}

export function updateForm(id: string, input: UpdateFormInput) {
  return apiClient.patch(`/forms/${segment(id)}`, {
    body: input,
    schema: formSchema,
  })
}

export function deleteForm(id: string) {
  return apiClient.delete(`/forms/${segment(id)}`)
}
