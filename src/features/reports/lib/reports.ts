import { getModuleReports } from "@/engine/modules"
import type { ReportDef } from "@/engine/reports"
import { resolveRange } from "@/features/dashboard"

import type { ReportParams, ReportSearch } from "../api/reports.schemas"
import { CORE_REPORTS } from "./core-reports"

/** Core reports + reports of the workspace's active modules. */
export function getAvailableReports(activeModules: readonly string[]) {
  return [
    ...CORE_REPORTS,
    ...getModuleReports(activeModules).map(({ report }) => report),
  ]
}

export function findReport(
  key: string,
  activeModules: readonly string[]
): ReportDef | undefined {
  return getAvailableReports(activeModules).find((report) => report.key === key)
}

/** API parameters of the URL state. */
export function toReportParams(
  search: ReportSearch,
  now = new Date()
): ReportParams {
  const range = resolveRange(search, now)
  return search.ownerId ? { ...range, ownerId: search.ownerId } : range
}
