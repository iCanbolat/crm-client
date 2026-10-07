import { describe, expect, it } from "vitest"

import { resolveI18nText } from "@/lib/i18n-text"
import { sanitizeRedirect } from "@/lib/redirect"

describe("sanitizeRedirect", () => {
  it.each([
    ["/o/lead", "/o/lead"],
    ["/examples?page=2#top", "/examples?page=2#top"],
  ])("TC-1.1-03 keeps same-origin path %s", (input, expected) => {
    expect(sanitizeRedirect(input)).toBe(expected)
  })

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "o/lead",
    "/login",
    "/login?redirect=/x",
    "/forgot-password",
    "",
    undefined,
    42,
  ])("rejects %s", (input) => {
    expect(sanitizeRedirect(input)).toBeUndefined()
  })
})

describe("resolveI18nText", () => {
  it("picks the language and falls back to Turkish", () => {
    expect(resolveI18nText({ tr: "Teklif", en: "Quote" }, "en")).toBe("Quote")
    expect(resolveI18nText({ tr: "Teklif", en: "" }, "en")).toBe("Teklif")
  })
})
