import { http, HttpResponse } from "msw"

import { foldText } from "@/engine/logic"
import { authenticate } from "@/mocks/auth/authenticate"
import { authenticatePublic } from "@/mocks/auth/authenticate-public"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiPath } from "@/mocks/utils/http"

import {
  LOCATION_KINDS,
  type LocationKind,
  type LocationValue,
} from "../api/reference.schemas"
import { CARRIER_KINDS, CONTAINER_TYPES, INCOTERMS } from "../lib/constants"
import { CARRIERS, FX_RATES } from "./reference/carriers"
import { LOCATIONS } from "./reference/locations"

const LOCATION_LIMIT = 20

function parseKinds(raw: string | null): LocationKind[] {
  const kinds = (raw ?? "")
    .split(",")
    .filter((kind): kind is LocationKind =>
      LOCATION_KINDS.includes(kind as LocationKind)
    )
  return kinds.length ? kinds : [...LOCATION_KINDS]
}

/**
 * Port/airport autocomplete (TC-3.2-04): exact code first, then codes and
 * names that start with the term, then anything containing it.
 */
export function searchLocations(
  q: string,
  kinds: readonly LocationKind[],
  limit = LOCATION_LIMIT
): LocationValue[] {
  const needle = foldText(q)
  const candidates = LOCATIONS.filter((item) => kinds.includes(item.kind))
  if (!needle) return candidates.slice(0, limit)

  const rank = (item: LocationValue) => {
    const code = foldText(item.code)
    const name = foldText(item.name)
    if (code === needle) return 0
    if (code.startsWith(needle) || name.startsWith(needle)) return 1
    if (name.includes(needle) || foldText(item.country) === needle) return 2
    return -1
  }
  return candidates
    .map((item) => ({ item, score: rank(item) }))
    .filter(({ score }) => score >= 0)
    .sort(
      (a, b) =>
        a.score - b.score || a.item.name.localeCompare(b.item.name, "tr")
    )
    .slice(0, limit)
    .map(({ item }) => item)
}

function locationsHandler(
  defaultKinds?: LocationKind[],
  { isPublic = false }: { isPublic?: boolean } = {}
) {
  return withScenario(({ request }) => {
    // Public form pages search locations too (B5.4): tenant from the host.
    const auth = isPublic ? authenticatePublic(request) : authenticate(request)
    if (!auth.ok) return auth.response
    const url = new URL(request.url)
    const kinds = defaultKinds ?? parseKinds(url.searchParams.get("kind"))
    return HttpResponse.json({
      data: searchLocations(url.searchParams.get("q") ?? "", kinds),
    })
  })
}

export const referenceHandlers = [
  http.get(apiPath("/ref/locations"), locationsHandler()),
  http.get(
    apiPath("/public/ref/locations"),
    locationsHandler(undefined, { isPublic: true })
  ),
  http.get(apiPath("/ref/ports"), locationsHandler(["port"])),
  http.get(apiPath("/ref/airports"), locationsHandler(["airport"])),

  http.get(
    apiPath("/ref/carriers"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const kind = new URL(request.url).searchParams.get("kind")
      const valid = CARRIER_KINDS.find((item) => item === kind)
      return HttpResponse.json({
        data: valid ? CARRIERS.filter((item) => item.kind === valid) : CARRIERS,
      })
    })
  ),

  http.get(
    apiPath("/ref/containers"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      return HttpResponse.json({ data: CONTAINER_TYPES })
    })
  ),

  http.get(
    apiPath("/ref/incoterms"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      return HttpResponse.json({ data: INCOTERMS })
    })
  ),

  http.get(
    apiPath("/ref/fx-rates"),
    // Rates feed totals across the module: like metadata, latency only.
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        return HttpResponse.json(FX_RATES)
      },
      { critical: true }
    )
  ),
]
