import type { RecordValues } from "@/engine/metadata"

import type { ForwardingDashboard } from "../api/dashboard.schemas"
import { locationSchema, type LocationValue } from "../api/reference.schemas"
import {
  isTransportMode,
  MILESTONES,
  type Milestone,
  type TransportMode,
} from "../lib/constants"
import { convertCurrency, roundMoney, type FxRates } from "../lib/currency"
import { getDelay } from "../lib/milestones"

interface Row {
  id: string
  objectKey: string
  values: RecordValues
}

export interface DashboardInput {
  records: readonly Row[]
  range: { from: string; to: string }
  today: string
  currency: string
  rates: FxRates
  userName: (id: string) => string
}

const OPEN_LEAD_STAGES = ["new", "contacted", "qualified"]
const DECIDED = ["accepted", "rejected", "expired"]

const day = (value: unknown) =>
  typeof value === "string" && value ? value.slice(0, 10) : null
const inRange = (
  value: unknown,
  { from, to }: { from: string; to: string }
) => {
  const date = day(value)
  return !!date && date >= from && date <= to
}
const money = (value: unknown) =>
  value && typeof value === "object" && "amount" in value
    ? (value as { amount: number; currency: string })
    : null

/**
 * Forwarding dashboard aggregates (B3.7) — pure, so the numbers are unit
 * tested against the same rows the mock API serves (TC-3.7-01).
 */
export function buildForwardingDashboard({
  records,
  range,
  today,
  currency,
  rates,
  userName,
}: DashboardInput): ForwardingDashboard {
  const of = (objectKey: string) =>
    records.filter((row) => row.objectKey === objectKey)
  const toCurrency = (value: unknown) => {
    const amount = money(value)
    return amount
      ? convertCurrency(amount.amount, amount.currency, currency, rates)
      : 0
  }

  // Freight requests received in the range and still open.
  const openLeads = of("lead").filter(
    (row) =>
      inRange(row.values.createdAt, range) &&
      OPEN_LEAD_STAGES.includes(String(row.values.stage))
  )
  const byStage = OPEN_LEAD_STAGES.map((stage) => ({
    stage,
    count: openLeads.filter((row) => row.values.stage === stage).length,
  }))

  // Quotes created in the range.
  const quotes = of("quote").filter((row) =>
    inRange(row.values.createdAt, range)
  )
  const accepted = quotes.filter((row) => row.values.status === "accepted")
  const decided = quotes.filter((row) =>
    DECIDED.includes(String(row.values.status))
  )

  // Monthly revenue of accepted quotes: cost + margin stack to revenue.
  const months = new Map<string, { revenue: number; cost: number }>()
  for (const row of accepted) {
    const month = String(row.values.createdAt).slice(0, 7)
    const current = months.get(month) ?? { revenue: 0, cost: 0 }
    months.set(month, {
      revenue: current.revenue + toCurrency(row.values.totalSell),
      cost: current.cost + toCurrency(row.values.totalBuy),
    })
  }
  const monthly = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, sums]) => ({
      month,
      revenue: roundMoney(sums.revenue),
      cost: roundMoney(sums.cost),
      margin: roundMoney(sums.revenue - sums.cost),
    }))

  // Shipments booked or departing (ETD) in the range.
  const shipments = of("shipment").filter(
    (row) =>
      inRange(row.values.etd, range) || inRange(row.values.createdAt, range)
  )
  const shipmentsByStatus = MILESTONES.map((status) => ({
    status,
    count: shipments.filter((row) => row.values.status === status).length,
  })).filter((item) => item.count > 0)

  // Most quoted lanes.
  const lanes = new Map<
    string,
    {
      mode: TransportMode
      origin: LocationValue
      destination: LocationValue
      quotes: number
      accepted: number
    }
  >()
  for (const row of quotes) {
    const origin = locationSchema.safeParse(row.values.origin)
    const destination = locationSchema.safeParse(row.values.destination)
    const mode = row.values.transportMode
    if (!origin.success || !destination.success || !isTransportMode(mode))
      continue
    const key = `${mode}:${origin.data.code}:${destination.data.code}`
    const lane = lanes.get(key) ?? {
      mode,
      origin: origin.data,
      destination: destination.data,
      quotes: 0,
      accepted: 0,
    }
    lane.quotes += 1
    if (row.values.status === "accepted") lane.accepted += 1
    lanes.set(key, lane)
  }
  const topLanes = [...lanes.values()]
    .sort((a, b) => b.quotes - a.quotes || b.accepted - a.accepted)
    .slice(0, 5)

  const companies = new Map(of("company").map((row) => [row.id, row]))
  const delayed = shipments
    .filter(
      (row) =>
        row.values.status !== "DELIVERED" &&
        getDelay(
          {
            etd: day(row.values.etd),
            eta: day(row.values.eta),
            atd: day(row.values.atd),
            ata: day(row.values.ata),
          },
          today
        ).delayed
    )
    .map((row) => ({
      id: row.id,
      shipmentNumber: String(row.values.shipmentNumber),
      customer:
        (companies.get(String(row.values.customerId))?.values.name as
          string | undefined) ?? null,
      eta: day(row.values.eta)!,
      days: getDelay({ eta: day(row.values.eta) }, today).arrival,
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 8)

  const reps = new Map<
    string,
    { quotes: number; accepted: number; revenue: number }
  >()
  for (const row of quotes) {
    const owner = String(row.values.ownerId)
    const current = reps.get(owner) ?? { quotes: 0, accepted: 0, revenue: 0 }
    current.quotes += 1
    if (row.values.status === "accepted") {
      current.accepted += 1
      current.revenue += toCurrency(row.values.totalSell)
    }
    reps.set(owner, current)
  }

  return {
    range,
    currency,
    openRequests: { total: openLeads.length, byStage },
    winRate: {
      accepted: accepted.length,
      decided: decided.length,
      rate: decided.length
        ? Math.round((accepted.length / decided.length) * 1000) / 10
        : null,
    },
    monthly,
    shipmentsByStatus: shipmentsByStatus as {
      status: Milestone
      count: number
    }[],
    topLanes,
    delayed,
    reps: [...reps.entries()]
      .map(([userId, stats]) => ({
        userId,
        name: userName(userId),
        ...stats,
        revenue: roundMoney(stats.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue || b.quotes - a.quotes),
  }
}
