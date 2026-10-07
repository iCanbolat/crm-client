import { describe, expect, it } from "vitest"

import {
  calcLine,
  calcLineQuantity,
  calcMargin,
  calcQuoteTotals,
  canRevise,
  canTransition,
  formatQuoteNumber,
  isExpired,
  isMarginLow,
  type QuoteLine,
} from "../lib/quote"
import { nextNumber } from "../mocks/quote-logic"

const rates = { USD: 1, EUR: 0.92, TRY: 41.5 }

const line = (extra: Partial<QuoteLine>): QuoteLine => ({
  id: "l",
  code: "OFR",
  basis: "container",
  quantity: 1,
  buyPrice: 0,
  sellPrice: 0,
  currency: "USD",
  ...extra,
})

describe("quote calculations (B3.4)", () => {
  it("TC-3.4-01 computes line totals and quantities from the cargo", () => {
    expect(
      calcLine({ quantity: 2, buyPrice: 1800, sellPrice: 2150.5 })
    ).toEqual({
      buy: 3600,
      sell: 4301,
      profit: 701,
    })
    const cargo = {
      containerCount: 3,
      grossKg: 2500,
      cbm: 4.2,
      chargeableKg: 700,
    }
    expect(calcLineQuantity("container", cargo)).toBe(3)
    expect(calcLineQuantity("kg", cargo)).toBe(700)
    expect(calcLineQuantity("cbm", cargo)).toBe(4.2)
    expect(calcLineQuantity("wm", cargo)).toBe(4.2)
    expect(calcLineQuantity("wm", { grossKg: 300, cbm: 0.2 })).toBe(1)
    expect(calcLineQuantity("shipment", cargo)).toBe(1)
    expect(calcLineQuantity("container", {})).toBe(1)
  })

  it("TC-3.4-01 sums per currency and converts to the quote currency", () => {
    const totals = calcQuoteTotals(
      [
        line({ quantity: 2, buyPrice: 1800, sellPrice: 2100, currency: "USD" }),
        line({
          code: "THC_O",
          quantity: 2,
          buyPrice: 180,
          sellPrice: 220,
          currency: "EUR",
        }),
        line({
          code: "DOC",
          basis: "shipment",
          buyPrice: 50,
          sellPrice: 75,
          currency: "EUR",
        }),
      ],
      "USD",
      rates
    )
    expect(totals.byCurrency).toEqual([
      { currency: "EUR", buy: 410, sell: 515 },
      { currency: "USD", buy: 3600, sell: 4200 },
    ])
    // 410 EUR = 445.65 USD; 515 EUR = 559.78 USD
    expect(totals.buy).toBe(4045.65)
    expect(totals.sell).toBe(4759.78)
    expect(totals.margin).toEqual({ amount: 714.13, percent: 15 })
  })

  it("TC-3.4-02 margin on the selling price and the low margin threshold", () => {
    expect(calcMargin(920, 1000)).toEqual({ amount: 80, percent: 8 })
    expect(isMarginLow(calcMargin(920, 1000))).toBe(false)
    expect(isMarginLow(calcMargin(930, 1000))).toBe(true)
    expect(calcMargin(100, 0)).toEqual({ amount: -100, percent: 0 })
    expect(isMarginLow({ amount: 10, percent: 12 }, 15)).toBe(true)
  })

  it("TC-3.4-03 allows only the documented status transitions", () => {
    expect(canTransition("draft", "sent")).toBe(true)
    expect(canTransition("draft", "accepted")).toBe(false)
    expect(canTransition("sent", "accepted")).toBe(true)
    expect(canTransition("sent", "rejected")).toBe(true)
    expect(canTransition("accepted", "rejected")).toBe(false)
    expect(canTransition("expired", "accepted")).toBe(false)
    expect(canRevise("sent")).toBe(true)
    expect(canRevise("draft")).toBe(false)
    expect(canRevise("accepted")).toBe(false)
  })

  it("TC-3.4-05 a sent quote expires the day after its validity", () => {
    expect(isExpired("sent", "2026-10-05", "2026-10-05")).toBe(false)
    expect(isExpired("sent", "2026-10-05", "2026-10-06")).toBe(true)
    expect(isExpired("draft", "2026-10-05", "2026-10-06")).toBe(false)
    expect(isExpired("sent", null, "2026-10-06")).toBe(false)
  })

  it("numbers quotes per year", () => {
    expect(formatQuoteNumber(2026, 7)).toBe("Q-2026-0007")
    expect(nextNumber("Q", ["Q-2026-0009", "Q-2025-0100", null], 2026)).toBe(
      "Q-2026-0010"
    )
    expect(nextNumber("SHP", [], 2027)).toBe("SHP-2027-0001")
  })
})
