import type { LucideIcon } from "lucide-react"
import { z } from "zod"

import type { I18nText } from "@/lib/i18n-text"

/** How a report column is formatted (table, chart tooltip and CSV). */
export const REPORT_COLUMN_KINDS = [
  "text",
  "number",
  "currency",
  "percent",
] as const
export type ReportColumnKind = (typeof REPORT_COLUMN_KINDS)[number]

export interface ReportColumn {
  key: string
  label: I18nText
  kind: ReportColumnKind
}

/** One chart above the table: a label column against a numeric column. */
export interface ReportChart {
  kind: "funnel" | "bar"
  labelKey: string
  valueKey: string
}

/**
 * A ready-made report (B7.1). The definition lives in the client (core
 * reports or a module manifest); the API computes its rows for a date range
 * and an optional owner (`GET /api/reports/:key`).
 */
export interface ReportDef {
  key: string
  label: I18nText
  description: I18nText
  icon: LucideIcon
  columns: ReportColumn[]
  chart?: ReportChart
}

const cellSchema = z.union([z.string(), z.number(), z.null()])
export type ReportCell = z.infer<typeof cellSchema>
export type ReportRow = Record<string, ReportCell>

/** API response of a report; text cells are already localized. */
export const reportResultSchema = z.object({
  key: z.string(),
  range: z.object({ from: z.string(), to: z.string() }),
  /** Currency of every `currency` column (ISO 4217). */
  currency: z.string(),
  rows: z.array(z.record(z.string(), cellSchema)),
  totals: z.record(z.string(), cellSchema).nullable(),
})
export type ReportResult = z.infer<typeof reportResultSchema>

/** Share in percent with one decimal; `null` when the base is zero. */
export function percentOf(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null
}
