import { describe, expect, it } from "vitest"

import {
  contrastRatio,
  DEFAULT_FORM_THEME,
  FORM_FONT_STACKS,
  getThemeWarnings,
  pickForeground,
  themeToCssVars,
} from "@/engine/forms"

describe("form theme (B4.6)", () => {
  it("TC-4.6-01 theme tokens become shadcn CSS variables", () => {
    const vars = themeToCssVars({
      ...DEFAULT_FORM_THEME,
      primaryColor: "#0f766e",
      backgroundColor: "#fafaf9",
      textColor: "#1c1917",
      font: "serif",
      radius: "lg",
    })
    expect(vars).toMatchObject({
      "--primary": "#0f766e",
      "--primary-foreground": "#ffffff",
      "--ring": "#0f766e",
      "--background": "#fafaf9",
      "--foreground": "#1c1917",
      "--card": "#fafaf9",
      "--radius": "0.875rem",
      "--form-font": FORM_FONT_STACKS.serif,
    })
    expect(vars["--muted-foreground"]).toBe(
      "color-mix(in oklab, #1c1917 70%, #fafaf9)"
    )
    // Light primaries get dark button text.
    expect(
      themeToCssVars({ ...DEFAULT_FORM_THEME, primaryColor: "#fde047" })[
        "--primary-foreground"
      ]
    ).toBe("#18181b")
  })

  it("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21)
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1)
    expect(contrastRatio("#767676", "#ffffff")).toBe(4.54)
    expect(pickForeground("#2563eb")).toBe("#ffffff")
    expect(pickForeground("#facc15")).toBe("#18181b")
  })

  it("TC-4.6-02 warns about low contrast colors", () => {
    expect(getThemeWarnings(DEFAULT_FORM_THEME)).toEqual([])
    expect(
      getThemeWarnings({ ...DEFAULT_FORM_THEME, textColor: "#cccccc" })
    ).toEqual([{ code: "textContrast", ratio: 1.61 }])
    expect(
      getThemeWarnings({ ...DEFAULT_FORM_THEME, primaryColor: "#777777" })
    ).toEqual([{ code: "buttonContrast", ratio: 4.48 }])
    expect(
      getThemeWarnings({ ...DEFAULT_FORM_THEME, primaryColor: "#fde047" })
    ).toEqual([{ code: "accentContrast", ratio: 1.32 }])
  })
})
