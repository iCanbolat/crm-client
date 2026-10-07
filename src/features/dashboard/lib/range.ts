import { z } from "zod"

import type { DashboardRange } from "@/engine/modules"

export const RANGE_PRESETS = ["30d", "90d", "365d", "custom"] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Dashboard URL state: a preset, or a custom `from`/`to` (B3.7). */
export const dashboardSearchSchema = z.object({
  range: z.enum(RANGE_PRESETS).default("90d").catch("90d"),
  from: isoDay.optional().catch(undefined),
  to: isoDay.optional().catch(undefined),
})
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>

export const DASHBOARD_SEARCH_DEFAULTS = { range: "90d" } as const

/** Local calendar day (`yyyy-MM-dd`). */
export function toIsoDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const PRESET_DAYS: Record<Exclude<RangePreset, "custom">, number> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
}

/** The concrete date range every widget is filtered by. */
export function resolveRange(
  search: Pick<DashboardSearch, "range" | "from" | "to">,
  now = new Date()
): DashboardRange {
  const to = toIsoDay(now)
  if (search.range === "custom" && search.from && search.to) {
    return search.from <= search.to
      ? { from: search.from, to: search.to }
      : { from: search.to, to: search.from }
  }
  const days = PRESET_DAYS[search.range === "custom" ? "90d" : search.range]
  const from = new Date(now)
  from.setDate(from.getDate() - (days - 1))
  return { from: toIsoDay(from), to }
}
