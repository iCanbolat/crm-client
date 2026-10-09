import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { checkI18n } from "../../scripts/check-i18n.mjs"

const root = resolve(import.meta.dirname, "../..")

function fixture(files: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), "i18n-"))
  for (const [path, content] of Object.entries(files)) {
    const file = join(dir, path)
    mkdirSync(join(file, ".."), { recursive: true })
    writeFileSync(
      file,
      typeof content === "string" ? content : JSON.stringify(content)
    )
  }
  return dir
}

describe("i18n completeness (B7.4)", () => {
  it("TC-7.4-01 TR and EN have the same keys, variables and no gaps", () => {
    expect(checkI18n(root)).toEqual([])
  })

  it("reports missing, empty, mismatched and unknown keys", () => {
    const dir = fixture({
      "src/locales/tr/app.json": {
        title: "Başlık",
        greet: "Merhaba {{name}}",
        empty: "",
        only: "Yalnız TR",
        items_one: "{{count}} öğe",
        items_other: "{{count}} öğe",
      },
      "src/locales/en/app.json": {
        title: "Title",
        greet: "Hello {{user}}",
        empty: "Empty",
        items_one: "{{count}} item",
        items_other: "{{count}} items",
      },
      "src/locales/tr/extra.json": { a: "b" },
      "src/feature.tsx": `t("app:title"); t("app:items"); t("app:nope"); i18n.t("app:greet")`,
    })
    expect(checkI18n(dir).sort()).toEqual(
      [
        "app:greet variables differ (tr: name, en: user)",
        "en:app:only missing",
        "extra: missing in en",
        "src/feature.tsx: unknown key app:nope",
        "tr:app:empty empty",
      ].sort()
    )
  })
})
