import { apiClient } from "@/lib/api"

import {
  publicFormSchema,
  publicSiteSchema,
  type PublicEvent,
  type SubmitFormInput,
} from "./public.schemas"

/** The API client sends `X-Public-Host` for every request (B5.1). */
export function fetchPublicSite(host: string, signal?: AbortSignal) {
  return apiClient.get("/public/sites/resolve", {
    signal,
    query: { host },
    schema: publicSiteSchema,
  })
}

export function fetchPublicForm(slug: string, signal?: AbortSignal) {
  return apiClient.get(`/public/forms/${encodeURIComponent(slug)}`, {
    signal,
    schema: publicFormSchema,
  })
}

export function submitPublicForm(slug: string, input: SubmitFormInput) {
  return apiClient.post(
    `/public/forms/${encodeURIComponent(slug)}/submissions`,
    { body: input }
  )
}

/** Fire and forget: analytics never block or break the page. */
export function trackPublicEvent(event: PublicEvent) {
  return apiClient.post("/public/events", { body: event }).catch(() => {})
}
