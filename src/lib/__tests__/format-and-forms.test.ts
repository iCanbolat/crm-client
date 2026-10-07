import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api"
import {
  getCountryFlag,
  getCountryName,
  getDialCode,
  isCountryCode,
} from "@/lib/countries"
import { formatMoney, isCurrency } from "@/lib/currencies"
import { formatDate, formatNumber, formatRelativeTime } from "@/lib/format"
import { applyServerFieldErrors } from "@/lib/forms"

describe("format", () => {
  const date = "2026-03-05T10:00:00.000Z"

  it("formats dates per locale", () => {
    expect(formatDate(date, "tr", { dateStyle: "long", timeZone: "UTC" })).toBe(
      "5 Mart 2026"
    )
    expect(formatDate(date, "en", { dateStyle: "long", timeZone: "UTC" })).toBe(
      "March 5, 2026"
    )
  })

  it("formats numbers and currencies per locale", () => {
    expect(formatNumber(1234.5, "tr")).toBe("1.234,5")
    expect(
      formatNumber(1234.5, "en", { style: "currency", currency: "USD" })
    ).toBe("$1,234.50")
  })
})

describe("relative time, countries and currencies", () => {
  const now = "2026-10-05T12:00:00.000Z"

  it.each([
    ["2026-10-05T11:59:40.000Z", "tr", "şimdi"],
    ["2026-10-05T11:55:00.000Z", "tr", "5 dakika önce"],
    ["2026-10-05T09:00:00.000Z", "en", "3 hours ago"],
    ["2026-10-04T12:00:00.000Z", "tr", "dün"],
    ["2026-10-08T12:00:00.000Z", "en", "in 3 days"],
    ["2026-09-21T12:00:00.000Z", "en", "2 weeks ago"],
    ["2026-07-01T12:00:00.000Z", "en", "3 months ago"],
    ["2024-10-01T12:00:00.000Z", "en", "2 years ago"],
  ])("formatRelativeTime(%s, %s) → %s", (value, locale, expected) => {
    expect(formatRelativeTime(value, locale, now)).toBe(expected)
  })

  it("resolves country names, flags and calling codes", () => {
    expect(getCountryName("DE", "tr")).toBe("Almanya")
    expect(getCountryName("TR", "en")).toBe("Türkiye")
    expect(getCountryName("??", "en")).toBe("??")
    expect(getCountryFlag("TR")).toBe("🇹🇷")
    expect(getCountryFlag("tr")).toBe("")
    expect(getDialCode("TR")).toBe("90")
    expect(isCountryCode("NL")).toBe(true)
    expect(isCountryCode("XX")).toBe(false)
  })

  it("formats money and falls back for unknown currency codes", () => {
    expect(formatMoney(1500, "EUR", "tr")).toBe("€1.500,00")
    expect(formatMoney(1500, "XXX1", "en")).toBe("1,500 XXX1")
    expect(isCurrency("TRY")).toBe(true)
    expect(isCurrency("BTC")).toBe(false)
  })
})

describe("applyServerFieldErrors", () => {
  it("TC-0.3-02 maps 422 field errors onto form fields and focuses the first", () => {
    const setError = vi.fn()
    const error = new ApiError({
      kind: "http",
      status: 422,
      code: "VALIDATION_ERROR",
      message: "x",
      fieldErrors: {
        name: ["Zorunlu"],
        email: ["Geçersiz", "Kullanımda"],
        tags: [],
      },
    })

    expect(applyServerFieldErrors(error, setError)).toBe(true)
    expect(setError).toHaveBeenCalledTimes(2)
    expect(setError).toHaveBeenNthCalledWith(
      1,
      "name",
      { type: "server", message: "Zorunlu" },
      { shouldFocus: true }
    )
    expect(setError).toHaveBeenNthCalledWith(
      2,
      "email",
      { type: "server", message: "Geçersiz" },
      { shouldFocus: false }
    )
  })

  it("ignores errors without field errors", () => {
    const setError = vi.fn()

    expect(applyServerFieldErrors(new Error("x"), setError)).toBe(false)
    expect(
      applyServerFieldErrors(
        new ApiError({ kind: "http", status: 500, code: "X", message: "x" }),
        setError
      )
    ).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })
})
