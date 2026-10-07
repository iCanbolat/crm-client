import { queryOptions } from "@tanstack/react-query"

import type { DashboardRange } from "@/engine/modules"
import { apiClient } from "@/lib/api"

import { forwardingDashboardSchema } from "./dashboard.schemas"

export const dashboardKeys = {
  forwarding: (range: DashboardRange) =>
    ["forwarding", "dashboard", range.from, range.to] as const,
}

/** One request feeds every forwarding widget (shared query key). */
export const forwardingDashboardQuery = (range: DashboardRange) =>
  queryOptions({
    queryKey: dashboardKeys.forwarding(range),
    queryFn: ({ signal }) =>
      apiClient.get("/dashboard/forwarding", {
        signal,
        query: { from: range.from, to: range.to },
        schema: forwardingDashboardSchema,
      }),
    staleTime: 30_000,
  })
