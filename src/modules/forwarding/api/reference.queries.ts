import { queryOptions } from "@tanstack/react-query"

import type { CarrierKind } from "../lib/constants"
import { fetchCarriers, fetchFxRates, fetchLocations } from "./reference.api"
import type { LocationKind } from "./reference.schemas"

/** Reference data barely changes: cache it for the session. */
const REFERENCE_STALE_TIME = 60 * 60_000

export const referenceKeys = {
  all: ["forwarding", "reference"] as const,
  locations: (q: string, kinds: readonly LocationKind[]) =>
    [...referenceKeys.all, "locations", q, kinds.join(",")] as const,
  carriers: (kind?: CarrierKind) =>
    [...referenceKeys.all, "carriers", kind ?? "all"] as const,
  fxRates: () => [...referenceKeys.all, "fx-rates"] as const,
}

export const referenceQueries = {
  locations: (q: string, kinds: readonly LocationKind[]) =>
    queryOptions({
      queryKey: referenceKeys.locations(q, kinds),
      queryFn: ({ signal }) => fetchLocations({ q, kinds }, signal),
      staleTime: REFERENCE_STALE_TIME,
    }),
  carriers: (kind?: CarrierKind) =>
    queryOptions({
      queryKey: referenceKeys.carriers(kind),
      queryFn: ({ signal }) => fetchCarriers(kind, signal),
      staleTime: REFERENCE_STALE_TIME,
    }),
  // Awaited by loaders and long-lived totals panels: no abort signal.
  fxRates: () =>
    queryOptions({
      queryKey: referenceKeys.fxRates(),
      queryFn: () => fetchFxRates(),
      staleTime: REFERENCE_STALE_TIME,
    }),
}
