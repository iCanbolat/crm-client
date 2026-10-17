import { describe, expect, it } from "vitest"

import { fromOptionDrafts, toOptionDrafts, uniqueKey } from "../lib/drafts"

describe("option draft helpers", () => {
  it("generates unique keys and option values from labels", () => {
    expect(uniqueKey("Müşteri Segmenti", ["musteriSegmenti"])).toBe(
      "musteriSegmenti2"
    )
    expect(uniqueKey("", [], "option")).toBe("option")
    const options = fromOptionDrafts([
      ...toOptionDrafts([{ value: "a", label: { tr: "A", en: "A" } }]),
      {
        id: "x",
        value: null,
        labelTr: "Büyük Firma",
        labelEn: "",
        color: "blue",
      },
    ])
    expect(options).toEqual([
      { value: "a", label: { tr: "A", en: "A" } },
      {
        value: "buyukFirma",
        label: { tr: "Büyük Firma", en: "Büyük Firma" },
        color: "blue",
      },
    ])
  })
})
