import type { ReportCell, ReportColumnKind } from "@/engine/reports"
import { formatMoney } from "@/lib/currencies"
import { formatNumber } from "@/lib/format"

interface FormatOptions {
  locale: string
  currency: string
}

/** Display text of a report cell; empty values show an em dash. */
export function formatReportCell(
  value: ReportCell,
  kind: ReportColumnKind,
  { locale, currency }: FormatOptions
) {
  if (value === null || value === "") return "—"
  if (typeof value === "string") return value
  switch (kind) {
    case "currency":
      return formatMoney(value, currency, locale)
    case "percent":
      return formatNumber(value / 100, locale, {
        style: "percent",
        maximumFractionDigits: 1,
      })
    default:
      return formatNumber(value, locale)
  }
}
