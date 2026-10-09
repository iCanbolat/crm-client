import { percentOf, type ReportRow } from "@/engine/reports"
import {
  reportRows,
  type ReportBody,
  type ReportContext,
} from "@/features/reports/mocks/registry"
import { resolveI18nText } from "@/lib/i18n-text"

import { locationSchema } from "../api/reference.schemas"
import { isTransportMode, t, TRANSPORT_MODE_LABELS } from "../lib/constants"
import { convertCurrency, roundMoney } from "../lib/currency"
import { FX_RATES } from "./reference/carriers"

const SENT = ["sent", "accepted", "rejected", "expired"]
const DECIDED = ["accepted", "rejected", "expired"]

const FUNNEL_STEPS = [
  { key: "created", label: t("Hazırlanan teklifler", "Quotes created") },
  { key: "sent", label: t("Müşteriye gönderilen", "Sent to customer") },
  { key: "accepted", label: t("Kabul edilen", "Accepted") },
] as const

const TOTAL = t("Toplam", "Total")

function moneyIn(context: ReportContext) {
  return (value: unknown) => {
    if (!value || typeof value !== "object" || !("amount" in value)) return 0
    const money = value as { amount: number; currency: string }
    return convertCurrency(
      money.amount,
      money.currency,
      context.currency,
      FX_RATES.rates
    )
  }
}

/**
 * Quote conversion funnel (TC-7.1-01): quotes prepared in the range → sent
 * to the customer → accepted. Each step shows its share of the first step
 * and the conversion from the previous one.
 */
export function buildQuoteFunnel(context: ReportContext): ReportBody {
  const quotes = reportRows(context, "quote")
  const counts = {
    created: quotes.length,
    sent: quotes.filter((row) => SENT.includes(String(row.values.status)))
      .length,
    accepted: quotes.filter((row) => row.values.status === "accepted").length,
  }
  if (!counts.created) return { rows: [], totals: null }
  return {
    rows: FUNNEL_STEPS.map((step, index) => {
      const count = counts[step.key]
      const previous = index ? counts[FUNNEL_STEPS[index - 1]!.key] : count
      return {
        stage: resolveI18nText(step.label, context.language),
        count,
        ofCreated: percentOf(count, counts.created),
        stepRate: index ? percentOf(count, previous) : null,
      }
    }),
    totals: null,
  }
}

/**
 * Revenue and margin per lane (mode + origin → destination). Every quote of
 * the range counts for the lane; money comes from the accepted ones.
 */
export function buildLaneProfit(context: ReportContext): ReportBody {
  const toMoney = moneyIn(context)
  const lanes = new Map<
    string,
    {
      lane: string
      mode: string
      quotes: number
      accepted: number
      revenue: number
      cost: number
    }
  >()
  for (const row of reportRows(context, "quote")) {
    const origin = locationSchema.safeParse(row.values.origin)
    const destination = locationSchema.safeParse(row.values.destination)
    const mode = row.values.transportMode
    if (!origin.success || !destination.success || !isTransportMode(mode))
      continue
    const key = `${mode}:${origin.data.code}:${destination.data.code}`
    const lane = lanes.get(key) ?? {
      lane: `${origin.data.name} (${origin.data.code}) → ${destination.data.name} (${destination.data.code})`,
      mode: resolveI18nText(TRANSPORT_MODE_LABELS[mode], context.language),
      quotes: 0,
      accepted: 0,
      revenue: 0,
      cost: 0,
    }
    lane.quotes += 1
    if (row.values.status === "accepted") {
      lane.accepted += 1
      lane.revenue += toMoney(row.values.totalSell)
      lane.cost += toMoney(row.values.totalBuy)
    }
    lanes.set(key, lane)
  }

  const toRow = (item: {
    revenue: number
    cost: number
  }): Pick<ReportRow, "revenue" | "cost" | "margin" | "marginPercent"> => ({
    revenue: roundMoney(item.revenue),
    cost: roundMoney(item.cost),
    margin: roundMoney(item.revenue - item.cost),
    marginPercent: percentOf(item.revenue - item.cost, item.revenue),
  })
  const items = [...lanes.values()].sort(
    (a, b) => b.revenue - a.revenue || b.quotes - a.quotes
  )
  const sum = (key: "quotes" | "accepted" | "revenue" | "cost") =>
    items.reduce((total, item) => total + item[key], 0)

  return {
    rows: items.map(({ revenue, cost, ...rest }) => ({
      ...rest,
      ...toRow({ revenue, cost }),
    })),
    totals: items.length
      ? {
          lane: resolveI18nText(TOTAL, context.language),
          mode: null,
          quotes: sum("quotes"),
          accepted: sum("accepted"),
          ...toRow({ revenue: sum("revenue"), cost: sum("cost") }),
        }
      : null,
  }
}

/** Per sales rep: leads, quotes, accepted quotes, win rate and revenue. */
export function buildRepPerformance(context: ReportContext): ReportBody {
  const toMoney = moneyIn(context)
  const reps = new Map<
    string,
    {
      leads: number
      quotes: number
      accepted: number
      decided: number
      revenue: number
    }
  >()
  const repOf = (ownerId: unknown) => {
    const id = String(ownerId)
    const rep = reps.get(id) ?? {
      leads: 0,
      quotes: 0,
      accepted: 0,
      decided: 0,
      revenue: 0,
    }
    reps.set(id, rep)
    return rep
  }
  for (const lead of reportRows(context, "lead")) {
    if (lead.values.ownerId) repOf(lead.values.ownerId).leads += 1
  }
  for (const quote of reportRows(context, "quote")) {
    if (!quote.values.ownerId) continue
    const rep = repOf(quote.values.ownerId)
    rep.quotes += 1
    if (DECIDED.includes(String(quote.values.status))) rep.decided += 1
    if (quote.values.status === "accepted") {
      rep.accepted += 1
      rep.revenue += toMoney(quote.values.totalSell)
    }
  }

  const items = [...reps.entries()]
    .map(([userId, rep]) => ({ name: context.userName(userId), ...rep }))
    .sort((a, b) => b.revenue - a.revenue || b.quotes - a.quotes)
  const sum = (key: "leads" | "quotes" | "accepted" | "decided" | "revenue") =>
    items.reduce((total, item) => total + item[key], 0)

  return {
    rows: items.map(({ decided, revenue, ...rest }) => ({
      ...rest,
      winRate: percentOf(rest.accepted, decided),
      revenue: roundMoney(revenue),
    })),
    totals: items.length
      ? {
          name: resolveI18nText(TOTAL, context.language),
          leads: sum("leads"),
          quotes: sum("quotes"),
          accepted: sum("accepted"),
          winRate: percentOf(sum("accepted"), sum("decided")),
          revenue: roundMoney(sum("revenue")),
        }
      : null,
  }
}
