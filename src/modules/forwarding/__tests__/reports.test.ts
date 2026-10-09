import { describe, expect, it } from "vitest"

import type { RecordValues } from "@/engine/metadata"
import type { ReportContext } from "@/features/reports/mocks/registry"

import {
  buildLaneProfit,
  buildQuoteFunnel,
  buildRepPerformance,
} from "../mocks/reports"

const ISTANBUL = {
  code: "TRIST",
  name: "İstanbul",
  country: "TR",
  kind: "port",
}
const HAMBURG = { code: "DEHAM", name: "Hamburg", country: "DE", kind: "port" }
const usd = (amount: number) => ({ amount, currency: "USD" })

let seq = 0
const row = (objectKey: string, values: RecordValues) => ({
  id: `r${++seq}`,
  objectKey,
  values: { createdAt: "2026-09-10T08:00:00.000Z", ownerId: "u1", ...values },
})
const quote = (status: string, values: RecordValues = {}) =>
  row("quote", {
    status,
    transportMode: "SEA_FCL",
    origin: ISTANBUL,
    destination: HAMBURG,
    totalSell: usd(1000),
    totalBuy: usd(800),
    ...values,
  })

const context = (
  records: ReportContext["records"],
  overrides: Partial<ReportContext> = {}
): ReportContext => ({
  records,
  range: { from: "2026-09-01", to: "2026-09-30" },
  ownerId: null,
  language: "tr",
  currency: "USD",
  userName: (id) => ({ u1: "Elif", u2: "Can" })[id] ?? id,
  objectDef: () => undefined,
  ...overrides,
})

describe("forwarding reports (B7.1)", () => {
  it("TC-7.1-01 quote funnel: prepared → sent → accepted with step rates", () => {
    const records = [
      quote("draft"),
      quote("draft"),
      quote("sent"),
      quote("rejected"),
      quote("expired"),
      quote("accepted"),
      quote("accepted"),
      quote("accepted"),
      // Outside the range: ignored.
      quote("accepted", { createdAt: "2026-08-31T23:00:00.000Z" }),
    ]
    const { rows, totals } = buildQuoteFunnel(context(records))
    expect(rows).toEqual([
      {
        stage: "Hazırlanan teklifler",
        count: 8,
        ofCreated: 100,
        stepRate: null,
      },
      {
        stage: "Müşteriye gönderilen",
        count: 6,
        ofCreated: 75,
        stepRate: 75,
      },
      { stage: "Kabul edilen", count: 3, ofCreated: 37.5, stepRate: 50 },
    ])
    expect(totals).toBeNull()
    expect(buildQuoteFunnel(context([])).rows).toEqual([])
    expect(
      buildQuoteFunnel(context(records, { language: "en" })).rows[0]!.stage
    ).toBe("Quotes created")
  })

  it("TC-7.1-02 owner filter narrows every report", () => {
    const records = [
      quote("accepted"),
      quote("accepted", { ownerId: "u2", totalSell: usd(500) }),
      row("lead", { ownerId: "u2" }),
    ]
    const own = context(records, { ownerId: "u2" })
    expect(buildQuoteFunnel(own).rows[0]!.count).toBe(1)
    expect(buildRepPerformance(own).rows).toEqual([
      {
        name: "Can",
        leads: 1,
        quotes: 1,
        accepted: 1,
        winRate: 100,
        revenue: 500,
      },
    ])
  })

  it("groups lanes, converts money and totals the margin", () => {
    const { rows, totals } = buildLaneProfit(
      context([
        quote("accepted", {
          totalSell: { amount: 920, currency: "EUR" },
          totalBuy: usd(700),
        }),
        quote("sent"),
        quote("accepted", { transportMode: "AIR", totalSell: usd(300) }),
        // Unusable lane data is skipped.
        quote("accepted", { origin: null }),
      ])
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      lane: "İstanbul (TRIST) → Hamburg (DEHAM)",
      mode: "Deniz — FCL (komple)",
      quotes: 2,
      accepted: 1,
      cost: 700,
    })
    expect(rows[0]!.revenue).toBeGreaterThan(900)
    expect(rows[1]).toMatchObject({
      mode: "Hava",
      revenue: 300,
      cost: 800,
      margin: -500,
    })
    expect(totals).toMatchObject({ lane: "Toplam", mode: null, quotes: 3 })
    expect(buildLaneProfit(context([])).totals).toBeNull()
  })

  it("ranks reps by revenue with win rate over decided quotes", () => {
    const { rows, totals } = buildRepPerformance(
      context([
        quote("accepted"),
        quote("rejected"),
        quote("sent"),
        quote("accepted", { ownerId: "u2", totalSell: usd(5000) }),
        row("lead", {}),
        row("lead", { ownerId: null }),
        quote("draft", { ownerId: null }),
      ])
    )
    expect(rows.map((item) => item.name)).toEqual(["Can", "Elif"])
    expect(rows[1]).toMatchObject({
      leads: 1,
      quotes: 3,
      accepted: 1,
      winRate: 50,
      revenue: 1000,
    })
    expect(totals).toMatchObject({ quotes: 4, accepted: 2, revenue: 6000 })
    expect(totals!.winRate).toBeCloseTo(66.7)
    expect(buildRepPerformance(context([])).totals).toBeNull()
  })
})
