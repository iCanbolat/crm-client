import { fireEvent, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { resolveRange } from "@/features/dashboard"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { setScenarioState } from "@/mocks/scenarios/scenario-store"
import { renderRoute, screen } from "@/test/render"

import { buildForwardingDashboard } from "../mocks/dashboard"
import { location } from "../mocks/reference/locations"

const rates = { USD: 1, EUR: 0.5 }
const row = (
  id: string,
  objectKey: string,
  values: Record<string, unknown>
) => ({
  id,
  objectKey,
  values,
})
const quote = (id: string, values: Record<string, unknown>) =>
  row(id, "quote", {
    transportMode: "SEA_FCL",
    origin: location("TRIST"),
    destination: location("DEHAM"),
    ownerId: "u1",
    ...values,
  })

const records = [
  row("l1", "lead", { stage: "new", createdAt: "2026-09-10T10:00:00Z" }),
  row("l2", "lead", { stage: "qualified", createdAt: "2026-09-11T10:00:00Z" }),
  row("l3", "lead", { stage: "converted", createdAt: "2026-09-12T10:00:00Z" }),
  row("l4", "lead", { stage: "new", createdAt: "2026-05-01T10:00:00Z" }),
  quote("q1", {
    status: "accepted",
    createdAt: "2026-09-02T10:00:00Z",
    totalSell: { amount: 1000, currency: "USD" },
    totalBuy: { amount: 800, currency: "USD" },
  }),
  quote("q2", {
    status: "accepted",
    createdAt: "2026-08-20T10:00:00Z",
    totalSell: { amount: 500, currency: "EUR" },
    totalBuy: { amount: 450, currency: "EUR" },
    ownerId: "u2",
  }),
  quote("q3", { status: "rejected", createdAt: "2026-09-03T10:00:00Z" }),
  quote("q4", { status: "sent", createdAt: "2026-09-04T10:00:00Z" }),
  quote("q5", {
    status: "accepted",
    createdAt: "2026-03-01T10:00:00Z",
    totalSell: { amount: 9999, currency: "USD" },
  }),
  row("c1", "company", { name: "Acme" }),
  row("s1", "shipment", {
    shipmentNumber: "SHP-1",
    status: "DEPARTED",
    etd: "2026-09-01",
    eta: "2026-09-20",
    customerId: "c1",
  }),
  row("s2", "shipment", {
    shipmentNumber: "SHP-2",
    status: "DELIVERED",
    etd: "2026-09-02",
    eta: "2026-09-10",
    ata: "2026-09-10",
  }),
  row("s3", "shipment", {
    shipmentNumber: "SHP-3",
    status: "BOOKED",
    etd: "2026-01-02",
  }),
]

const build = (from: string, to: string) =>
  buildForwardingDashboard({
    records,
    range: { from, to },
    today: "2026-10-01",
    currency: "USD",
    rates,
    userName: (id) => `User ${id}`,
  })

describe("forwarding dashboard (B3.7)", () => {
  it("TC-3.7-01 aggregates requests, win rate, revenue, shipments, lanes and reps", () => {
    const data = build("2026-08-01", "2026-09-30")
    expect(data.openRequests).toEqual({
      total: 2,
      byStage: [
        { stage: "new", count: 1 },
        { stage: "contacted", count: 0 },
        { stage: "qualified", count: 1 },
      ],
    })
    // 2 accepted out of 3 decided (the sent quote is still open).
    expect(data.winRate).toEqual({ accepted: 2, decided: 3, rate: 66.7 })
    // EUR converted at 0.5 per USD.
    expect(data.monthly).toEqual([
      { month: "2026-08", revenue: 1000, cost: 900, margin: 100 },
      { month: "2026-09", revenue: 1000, cost: 800, margin: 200 },
    ])
    expect(data.shipmentsByStatus).toEqual([
      { status: "DEPARTED", count: 1 },
      { status: "DELIVERED", count: 1 },
    ])
    expect(data.delayed).toEqual([
      {
        id: "s1",
        shipmentNumber: "SHP-1",
        customer: "Acme",
        eta: "2026-09-20",
        days: 11,
      },
    ])
    expect(data.topLanes).toEqual([
      expect.objectContaining({ mode: "SEA_FCL", quotes: 4, accepted: 2 }),
    ])
    expect(data.reps).toEqual([
      { userId: "u1", name: "User u1", quotes: 3, accepted: 1, revenue: 1000 },
      { userId: "u2", name: "User u2", quotes: 1, accepted: 1, revenue: 1000 },
    ])
  })

  it("TC-3.7-02 the date range applies to every aggregate", () => {
    const data = build("2026-09-01", "2026-09-05")
    expect(data.openRequests.total).toBe(0)
    expect(data.winRate.decided).toBe(2)
    expect(data.monthly.map((item) => item.month)).toEqual(["2026-09"])
    expect(
      data.shipmentsByStatus.reduce((sum, item) => sum + item.count, 0)
    ).toBe(2)

    const empty = build("2025-01-01", "2025-01-31")
    expect(empty.winRate.rate).toBeNull()
    expect(empty.monthly).toEqual([])
    expect(empty.topLanes).toEqual([])
  })

  it("resolves presets and custom ranges", () => {
    const now = new Date(2026, 9, 6)
    expect(resolveRange({ range: "30d" }, now)).toEqual({
      from: "2026-09-07",
      to: "2026-10-06",
    })
    expect(
      resolveRange(
        { range: "custom", from: "2026-09-10", to: "2026-09-01" },
        now
      )
    ).toEqual({ from: "2026-09-01", to: "2026-09-10" })
    expect(resolveRange({ range: "custom" }, now).to).toBe("2026-10-06")
  })

  it("TC-3.7-02 the range filter lives in the URL and refreshes the widgets", async () => {
    const { user, router } = await renderRoute("/dashboard", { as: "owner" })
    const region = await screen.findByRole("region", {
      name: "Teklif kazanma oranı",
    })
    await within(region).findByTestId("win-rate")

    await user.click(screen.getByRole("combobox", { name: "Tarih aralığı" }))
    await user.click(await screen.findByRole("option", { name: "Özel aralık" }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ range: "custom" })
    )
    fireEvent.change(screen.getByLabelText("Başlangıç"), {
      target: { value: "2020-01-01" },
    })
    fireEvent.change(screen.getByLabelText("Bitiş"), {
      target: { value: "2020-01-31" },
    })
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        from: "2020-01-01",
        to: "2020-01-31",
      })
    )
    expect(
      await within(region).findByText("Bu dönem için veri yok.")
    ).toBeInTheDocument()
  })

  it("TC-3.7-03 every widget shows an empty state without data", async () => {
    setScenarioState({ scenario: "empty" })
    await renderRoute("/dashboard", { as: "owner" })
    const revenue = await screen.findByRole("region", {
      name: "Aylık ciro ve marj",
    })
    expect(
      await within(revenue).findByText("Bu dönem için veri yok.")
    ).toBeInTheDocument()
    expect(await screen.findByText("Geciken sevkiyat yok.")).toBeInTheDocument()
    expect(screen.getByTestId("open-requests")).toHaveTextContent("0")
  })

  it("TC-3.1-02 shows no forwarding widgets when the module is inactive", async () => {
    db.workspaces.update(WORKSPACE_IDS.acme, { modules: [] })
    await renderRoute("/dashboard", { as: "owner" })
    expect(
      await screen.findByText(
        "Bu çalışma alanında henüz aktif bir sektör modülü yok."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Teklif kazanma oranı" })
    ).toBeNull()
    expect(screen.queryByRole("link", { name: "Teklifler" })).toBeNull()
  })
})
