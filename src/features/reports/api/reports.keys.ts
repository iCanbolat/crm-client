import type { ReportParams } from "./reports.schemas"

export const reportKeys = {
  all: ["reports"] as const,
  detail: (key: string, params: ReportParams) =>
    [...reportKeys.all, key, params] as const,
}
