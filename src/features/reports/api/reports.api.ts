import { reportResultSchema } from "@/engine/reports"
import { apiClient } from "@/lib/api"

import type { ReportParams } from "./reports.schemas"

export function fetchReport(
  key: string,
  params: ReportParams,
  signal?: AbortSignal
) {
  return apiClient.get(`/reports/${encodeURIComponent(key)}`, {
    signal,
    query: { ...params },
    schema: reportResultSchema,
  })
}
