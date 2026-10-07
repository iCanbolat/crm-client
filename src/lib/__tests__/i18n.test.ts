import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import i18n, {
  getCurrentLanguage,
  LANGUAGE_STORAGE_KEY,
  warnMissingKey,
} from "@/lib/i18n"

describe("i18n", () => {
  it("TC-0.2-03 switches TR ↔ EN, syncs <html lang> and caches the choice", async () => {
    expect(i18n.t("notFound.title")).toBe("Sayfa bulunamadı")
    expect(document.documentElement.lang).toBe("tr")

    await i18n.changeLanguage("en")

    expect(i18n.t("notFound.title")).toBe("Page not found")
    expect(document.documentElement.lang).toBe("en")
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en")
    expect(getCurrentLanguage()).toBe("en")
  })

  it("normalizes regional variants to a supported language", async () => {
    await i18n.changeLanguage("en-GB")
    expect(getCurrentLanguage()).toBe("en")

    await i18n.changeLanguage("de")
    expect(getCurrentLanguage()).toBe("tr")
  })

  it("TC-0.2-03 localizes zod validation messages with the active language", async () => {
    // zod 4 builds `error` lazily, so read the message right after parsing.
    const message = () =>
      z.string().min(3).safeParse("a").error?.issues[0]?.message

    const tr = message()
    await i18n.changeLanguage("en")
    const en = message()

    expect(tr).toMatch(/çok küçük/i)
    expect(en).toMatch(/too small/i)
  })

  it("TC-0.2-03 warns about missing keys in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const value = i18n.t("does.not.exist" as never)

    expect(value).toBe("does.not.exist")
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing translation "common:does.not.exist"')
    )
  })

  it("formats missing key warnings with the requested languages", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    warnMissingKey(["tr", "en"], "errors", "x.y")

    expect(warn).toHaveBeenCalledWith(
      '[i18n] Missing translation "errors:x.y" (tr, en)'
    )
  })
})
