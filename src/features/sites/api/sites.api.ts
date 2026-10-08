import { apiClient } from "@/lib/api"

import {
  domainListSchema,
  domainSchema,
  siteSchema,
  type CreateDomainInput,
  type UpdateSiteInput,
} from "./sites.schemas"

export function fetchSite(signal?: AbortSignal) {
  return apiClient.get("/sites", { signal, schema: siteSchema })
}

export function updateSite(input: Partial<UpdateSiteInput>) {
  return apiClient.patch("/sites", { body: input, schema: siteSchema })
}

export function fetchDomains(signal?: AbortSignal) {
  return apiClient
    .get("/sites/domains", { signal, schema: domainListSchema })
    .then((response) => response.data)
}

export function createDomain(input: CreateDomainInput) {
  return apiClient.post("/sites/domains", { body: input, schema: domainSchema })
}

export function verifyDomain(id: string) {
  return apiClient.post(`/sites/domains/${id}/verify`, { schema: domainSchema })
}

export function makeDomainPrimary(id: string) {
  return apiClient
    .post(`/sites/domains/${id}/primary`, { schema: domainListSchema })
    .then((response) => response.data)
}

export function deleteDomain(id: string) {
  return apiClient.delete(`/sites/domains/${id}`)
}
