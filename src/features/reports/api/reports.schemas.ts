import { z } from "zod"

import {
  DASHBOARD_SEARCH_DEFAULTS,
  dashboardSearchSchema,
} from "@/features/dashboard"

/** Report URL state: the dashboard's date range + an optional owner. */
export const reportSearchSchema = dashboardSearchSchema.extend({
  ownerId: z.string().min(1).optional().catch(undefined),
})
export type ReportSearch = z.infer<typeof reportSearchSchema>

export const REPORT_SEARCH_DEFAULTS = DASHBOARD_SEARCH_DEFAULTS

export interface ReportParams {
  from: string
  to: string
  ownerId?: string
}
