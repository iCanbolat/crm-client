import { apiClient } from "@/lib/api"

import {
  formListResponseSchema,
  formSchema,
  formStatsSchema,
  formVersionListSchema,
  formVersionSchema,
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

export function publishForm(id: string) {
  return apiClient.post(`/forms/${segment(id)}/publish`, { schema: formSchema })
}

export function unpublishForm(id: string) {
  return apiClient.post(`/forms/${segment(id)}/unpublish`, {
    schema: formSchema,
  })
}

export function fetchFormVersions(id: string, signal?: AbortSignal) {
  return apiClient.get(`/forms/${segment(id)}/versions`, {
    signal,
    schema: formVersionListSchema,
  })
}

export function fetchFormVersion(
  id: string,
  version: number,
  signal?: AbortSignal
) {
  return apiClient.get(`/forms/${segment(id)}/versions/${version}`, {
    signal,
    schema: formVersionSchema,
  })
}

/** Copies a published version into the draft (B4.7). */
export function restoreFormVersion(id: string, version: number) {
  return apiClient.post(`/forms/${segment(id)}/versions/${version}/restore`, {
    schema: formSchema,
  })
}
