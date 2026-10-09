import { percentOf } from "@/engine/reports"
import i18n from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { reportRows, type ReportBody, type ReportContext } from "./registry"

const NO_SOURCE = "__none"

/**
 * Lead source performance (B7.1): leads received per source in the range,
 * how many converted or were lost, and the conversion rate.
 */
export function buildLeadSources(context: ReportContext): ReportBody {
  const t = i18n.getFixedT(context.language, "reports")
  const leads = reportRows(context, "lead")
  const options =
    context.objectDef("lead")?.fields.find((field) => field.key === "source")
      ?.options ?? []
  const label = (value: string) => {
    if (value === NO_SOURCE) return t("mock.noSource")
    const option = options.find((item) => item.value === value)
    return option ? resolveI18nText(option.label, context.language) : value
  }

  const groups = new Map<
    string,
    { leads: number; converted: number; lost: number }
  >()
  for (const lead of leads) {
    const source =
      typeof lead.values.source === "string" && lead.values.source
        ? lead.values.source
        : NO_SOURCE
    const group = groups.get(source) ?? { leads: 0, converted: 0, lost: 0 }
    group.leads += 1
    if (lead.values.stage === "converted") group.converted += 1
    if (lead.values.stage === "lost") group.lost += 1
    groups.set(source, group)
  }

  const rows = [...groups.entries()]
    .sort(([, a], [, b]) => b.leads - a.leads || b.converted - a.converted)
    .map(([source, group]) => ({
      source: label(source),
      ...group,
      conversionRate: percentOf(group.converted, group.leads),
    }))
  const sum = (key: "leads" | "converted" | "lost") =>
    rows.reduce((total, row) => total + row[key], 0)

  return {
    rows,
    totals: rows.length
      ? {
          source: t("mock.total"),
          leads: sum("leads"),
          converted: sum("converted"),
          lost: sum("lost"),
          conversionRate: percentOf(sum("converted"), sum("leads")),
        }
      : null,
  }
}
