import { getModuleReports } from "@/engine/modules"
import type { ReportDef } from "@/engine/reports"
import { resolveRange } from "@/features/dashboard"
import { canReadField, type Subject } from "@/lib/rbac"

import type { ReportParams, ReportSearch } from "../api/reports.schemas"
import { CORE_REPORTS } from "./core-reports"

/**
 * Core reports + reports of the workspace's active modules, without the
 * ones holding data the reader may not see (Faz 10).
 */
export function getAvailableReports(
  activeModules: readonly string[],
  subject: Subject | null
) {
  return [
    ...CORE_REPORTS,
    ...getModuleReports(activeModules).map(({ report }) => report),
  ].filter((report) => canReadField(subject, report.sensitivity))
}

export function findReport(
  key: string,
  activeModules: readonly string[],
  subject: Subject | null
): ReportDef | undefined {
  return getAvailableReports(activeModules, subject).find(
    (report) => report.key === key
  )
}

/** API parameters of the URL state. */
export function toReportParams(
  search: ReportSearch,
  now = new Date()
): ReportParams {
  const range = resolveRange(search, now)
  return search.ownerId ? { ...range, ownerId: search.ownerId } : range
}
