import { apiClient } from "@/lib/api"

import {
  carrierListSchema,
  fxRatesSchema,
  locationListSchema,
  type LocationKind,
} from "./reference.schemas"
import type { CarrierKind } from "../lib/constants"

export function fetchLocations(
  params: { q?: string; kinds?: readonly LocationKind[] },
  signal?: AbortSignal
) {
  return apiClient
    .get("/ref/locations", {
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
