import { apiClient, isPublicApiClient } from "@/lib/api"

import {
  carrierListSchema,
  fxRatesSchema,
  locationListSchema,
  type LocationKind,
} from "./reference.schemas"
import type { CarrierKind } from "../lib/constants"

/** Location search also serves public form pages (B5.4). */
const locationsPath = () =>
  isPublicApiClient() ? "/public/ref/locations" : "/ref/locations"

export function fetchLocations(
  params: { q?: string; kinds?: readonly LocationKind[] },
  signal?: AbortSignal
) {
  return apiClient
    .get(locationsPath(), {
      signal,
      query: { q: params.q || undefined, kind: params.kinds?.join(",") },
      schema: locationListSchema,
    })
    .then((response) => response.data)
}

export function fetchCarriers(kind?: CarrierKind, signal?: AbortSignal) {
  return apiClient
    .get("/ref/carriers", {
      signal,
      query: { kind },
      schema: carrierListSchema,
    })
    .then((response) => response.data)
}

export function fetchFxRates() {
  return apiClient.get("/ref/fx-rates", { schema: fxRatesSchema })
}
