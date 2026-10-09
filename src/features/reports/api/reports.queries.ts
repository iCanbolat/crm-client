import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { fetchReport } from "./reports.api"
import { reportKeys } from "./reports.keys"
import type { ReportParams } from "./reports.schemas"

export const reportQueries = {
  detail: (key: string, params: ReportParams) =>
    queryOptions({
      queryKey: reportKeys.detail(key, params),
      queryFn: ({ signal }) => fetchReport(key, params, signal),
      placeholderData: keepPreviousData,
    }),
}
