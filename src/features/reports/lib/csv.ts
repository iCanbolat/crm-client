import type { ReportCell, ReportDef, ReportResult } from "@/engine/reports"
import { toCsv } from "@/lib/csv"
import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

const cell = (value: ReportCell | undefined) =>
  value === null || value === undefined ? "" : String(value)

/**
 * Report export (TC-7.1-04): the report's columns in order, raw numbers
 * (spreadsheets format them), money columns labelled with the currency and
 * the totals row last.
 */
export function reportToCsv(
  def: ReportDef,
  result: ReportResult,
  language: Language
) {
  const header = def.columns.map((column) => {
    const label = resolveI18nText(column.label, language)
    return column.kind === "currency" ? `${label} (${result.currency})` : label
  })
  const rows = [...result.rows, ...(result.totals ? [result.totals] : [])]
  return toCsv([
    header,
    ...rows.map((row) => def.columns.map((column) => cell(row[column.key]))),
  ])
}
