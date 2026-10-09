import { screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ReportResult } from "@/engine/reports"
import { forwardingReports } from "@/modules/forwarding/reports"
import { renderRoute } from "@/test/render"

import { CORE_REPORTS } from "../lib/core-reports"
import { reportToCsv } from "../lib/csv"
import { formatReportCell } from "../lib/format"
import { toReportParams } from "../lib/reports"

describe("reports UI (B7.1)", () => {
  it("lists core and module reports", async () => {
    const { user, router } = await renderRoute("/reports", { as: "manager" })
    expect(
      await screen.findByRole("heading", { name: "Raporlar", level: 1 })
    ).toBeInTheDocument()
    for (const name of [
      "Lead kaynak performansı",
      "Teklif dönüşüm hunisi",
      "Hat bazlı ciro ve marj",
      "Temsilci performansı",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument()
    }
    await user.click(
      screen.getByRole("link", { name: "Teklif dönüşüm hunisi raporunu aç" })
    )
    expect(router.state.location.pathname).toBe("/reports/quoteFunnel")
  })

  it("shows a report with filters in the URL and exports CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:csv")
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    const { user, router } = await renderRoute(
      "/reports/leadSources?range=365d",
      { as: "owner" }
    )
    const table = await screen.findByRole("table", {
      name: "Lead kaynak performansı",
    })
    expect(within(table).getByText("Web formu")).toBeInTheDocument()
    expect(within(table).getByText("Toplam")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Temsilci" }))
    await user.click(await screen.findByRole("option", { name: "Can Öztürk" }))
    expect(router.state.location.search).toMatchObject({
      range: "365d",
      ownerId: "usr_agent",
    })

    await user.click(screen.getByRole("button", { name: "CSV indir" }))
    expect(await screen.findByText("Rapor indirildi.")).toBeInTheDocument()
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect((await blob.text()).split("\r\n")[0]).toBe(
      "Kaynak,Lead,Dönüşen,Kaybedilen,Dönüşüm oranı"
    )
  })

  it("hides the owner filter from agents and 404s inactive reports", async () => {
    await renderRoute("/reports/repPerformance", { as: "agent" })
    expect(
      await screen.findByText("Yalnız sizin kayıtlarınız gösteriliyor.")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "Temsilci" })
    ).not.toBeInTheDocument()
  })

  it("forbids viewers", async () => {
    await renderRoute("/reports", { as: "viewer" })
    expect(
      await screen.findByText("Bu sayfaya erişiminiz yok")
    ).toBeInTheDocument()
  })

  it("404s an unknown report", async () => {
    await renderRoute("/reports/nope", { as: "owner" })
    expect(await screen.findByText("Sayfa bulunamadı")).toBeInTheDocument()
  })
})

describe("report helpers", () => {
  const laneProfit = forwardingReports.find((r) => r.key === "laneProfit")!
  const result: ReportResult = {
    key: "laneProfit",
    range: { from: "2026-01-01", to: "2026-01-31" },
    currency: "USD",
    rows: [
      {
        lane: "İstanbul → Hamburg",
        mode: "Deniz",
        quotes: 2,
        accepted: 1,
        revenue: 1200.5,
        cost: 1000,
        margin: 200.5,
        marginPercent: 16.7,
      },
    ],
    totals: {
      lane: "Toplam",
      mode: null,
      quotes: 2,
      accepted: 1,
      revenue: 1200.5,
      cost: 1000,
      margin: 200.5,
      marginPercent: null,
    },
  }

  it("TC-7.1-04 CSV keeps the report columns, currency and totals", () => {
    const lines = reportToCsv(laneProfit, result, "tr").split("\r\n")
    expect(lines).toEqual([
      "Hat,Taşıma modu,Teklif,Kabul,Ciro (USD),Maliyet (USD),Marj (USD),Marj %",
      "İstanbul → Hamburg,Deniz,2,1,1200.5,1000,200.5,16.7",
      "Toplam,,2,1,1200.5,1000,200.5,",
    ])
    expect(
      reportToCsv(CORE_REPORTS[0]!, { ...result, totals: null }, "en").split(
        "\r\n"
      )[0]
    ).toBe("Source,Leads,Converted,Lost,Conversion rate")
  })

  it("formats cells by kind", () => {
    const options = { locale: "tr", currency: "USD" }
    expect(formatReportCell(null, "number", options)).toBe("—")
    expect(formatReportCell("Fuar", "text", options)).toBe("Fuar")
    expect(formatReportCell(1234, "number", options)).toBe("1.234")
    expect(formatReportCell(16.7, "percent", options)).toBe("%16,7")
    expect(formatReportCell(10, "currency", options)).toBe("$10,00")
  })

  it("adds the owner to the API params only when filtered", () => {
    const now = new Date(2026, 9, 9)
    expect(toReportParams({ range: "30d" }, now)).toEqual({
      from: "2026-09-10",
      to: "2026-10-09",
    })
    expect(
      toReportParams({ range: "30d", ownerId: "usr_agent" }, now)
    ).toMatchObject({ ownerId: "usr_agent" })
  })
})
