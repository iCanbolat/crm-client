import { queryOptions } from "@tanstack/react-query"

import type { DashboardRange } from "@/engine/modules"
import { apiClient } from "@/lib/api"

import { visaEducationDashboardSchema } from "./dashboard.schemas"

/** One request feeds every visa & education widget (shared query key). */
export const visaEducationDashboardQuery = (range: DashboardRange) =>
  queryOptions({
    queryKey: ["visa-education", "dashboard", range.from, range.to] as const,
    queryFn: ({ signal }) =>
      apiClient.get("/dashboard/visa-education", {
        signal,
        query: { from: range.from, to: range.to },
        schema: visaEducationDashboardSchema,
      }),
    staleTime: 30_000,
  })
