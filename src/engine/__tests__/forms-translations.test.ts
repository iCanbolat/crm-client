import { describe, expect, it } from "vitest"

import { getMissingTranslations } from "@/engine/forms"

import { formContent, formField, tt } from "./form-fixtures"

describe("form translations (B4.3)", () => {
  it("TC-4.3-03 reports texts missing in one of the form's languages", () => {
    const content = formContent(
      [
        formField("name", "text", { label: { tr: "Ad", en: "" } }),
        formField("mode", "radio", {
          label: tt("Mod", "Mode"),
          options: [{ value: "air", label: { tr: "Hava", en: "" } }],
          placeholder: { tr: "", en: "" },
          helpText: { tr: "", en: "Pick one" },
        }),
        formField("line", "divider", { label: { tr: "Ayırıcı", en: "" } }),
      ],
      { steps: [{ id: "step1", title: { tr: "İletişim", en: "" } }] }
    )
    content.settings.successMessage = { tr: "Teşekkürler", en: "" }

    expect(getMissingTranslations(content)).toEqual([
      { scope: "step", id: "step1", property: "title", language: "en" },
      { scope: "field", id: "f_name", property: "label", language: "en" },
      { scope: "field", id: "f_mode", property: "helpText", language: "tr" },
      { scope: "field", id: "f_mode", property: "options.0", language: "en" },
      {
        scope: "settings",
        id: "settings",
        property: "successMessage",
        language: "en",
      },
    ])

    // A Turkish-only form needs no English.
    content.settings.languages = ["tr"]
    expect(getMissingTranslations(content)).toEqual([])
  })
})
