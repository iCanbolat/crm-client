import type { FormFont, FormRadius, FormTheme } from "./schemas"

/**
 * Form theme → CSS custom properties (plan B4.6). The names are the shadcn
 * tokens the UI components already read (`--primary`, `--radius`, …), so a
 * themed wrapper restyles the renderer without extra classes.
 */

export const FORM_FONT_STACKS: Record<FormFont, string> = {
  default: '"Outfit Variable", ui-sans-serif, system-ui, sans-serif',
  system:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
}

export const FORM_RADIUS_VALUES: Record<FormRadius, string> = {
  none: "0rem",
  sm: "0.25rem",
  md: "0.625rem",
  lg: "0.875rem",
  full: "1.25rem",
}

const LIGHT_TEXT = "#ffffff"
const DARK_TEXT = "#18181b"

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** WCAG 2.1 relative luminance of a `#rrggbb` color. */
export function relativeLuminance(hex: string) {
  const [r, g, b] = channels(hex).map((channel) => {
    const srgb = channel / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio (1–21) of two `#rrggbb` colors, two decimals. */
export function contrastRatio(a: string, b: string) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  ) as [number, number]
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
}

/** Text color (white or near black) readable on `background`. */
export function pickForeground(background: string) {
  return contrastRatio(background, LIGHT_TEXT) >=
    contrastRatio(background, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT
}

/** Minimum contrast of text (WCAG AA) and of UI parts such as borders. */
export const TEXT_CONTRAST_MIN = 4.5
export const UI_CONTRAST_MIN = 3

export interface ThemeWarning {
  code: "buttonContrast" | "textContrast" | "accentContrast"
  ratio: number
}

/** Color combinations that fail WCAG AA (TC-4.6-02). */
export function getThemeWarnings(theme: FormTheme): ThemeWarning[] {
  const warnings: ThemeWarning[] = []
  const button = contrastRatio(
    theme.primaryColor,
    pickForeground(theme.primaryColor)
  )
  if (button < TEXT_CONTRAST_MIN) {
    warnings.push({ code: "buttonContrast", ratio: button })
  }
  const text = contrastRatio(theme.textColor, theme.backgroundColor)
  if (text < TEXT_CONTRAST_MIN) {
    warnings.push({ code: "textContrast", ratio: text })
  }
  const accent = contrastRatio(theme.primaryColor, theme.backgroundColor)
  if (accent < UI_CONTRAST_MIN) {
    warnings.push({ code: "accentContrast", ratio: accent })
  }
  return warnings
}

const mix = (color: string, background: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, ${background})`

/** CSS variables of a themed form container (TC-4.6-01). */
export function themeToCssVars(theme: FormTheme): Record<string, string> {
  const { primaryColor: primary, backgroundColor: bg, textColor: text } = theme
  return {
    "--primary": primary,
    "--primary-foreground": pickForeground(primary),
    "--ring": primary,
    "--background": bg,
    "--foreground": text,
    "--card": bg,
    "--card-foreground": text,
    "--popover": bg,
    "--popover-foreground": text,
    "--muted": mix(text, bg, 6),
    "--muted-foreground": mix(text, bg, 70),
    "--secondary": mix(text, bg, 8),
    "--secondary-foreground": text,
    "--accent": mix(primary, bg, 12),
    "--accent-foreground": text,
    "--border": mix(text, bg, 15),
    "--input": mix(text, bg, 18),
    "--radius": FORM_RADIUS_VALUES[theme.radius],
    "--form-font": FORM_FONT_STACKS[theme.font],
  }
}
