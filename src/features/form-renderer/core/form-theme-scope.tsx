import type { CSSProperties, ReactNode } from "react"

import { themeToCssVars, type FormTheme } from "@/engine/forms"
import { cn } from "@/lib/utils"

export type FormDevice = "desktop" | "mobile"

/** Viewport width of the mobile preview (iPhone class). */
export const MOBILE_PREVIEW_WIDTH = 375

/**
 * Applies a form theme (B4.6): CSS variables, font, background and logo.
 * `device="mobile"` renders the form at phone width for previews.
 */
export function FormThemeScope({
  theme,
  device = "desktop",
  children,
  className,
}: {
  theme: FormTheme
  device?: FormDevice
  children: ReactNode
  className?: string
}) {
  const style = {
    ...themeToCssVars(theme),
    fontFamily: "var(--form-font)",
  } as CSSProperties

  return (
    <div
      data-device={device}
      className={cn(
        "mx-auto w-full max-w-full transition-[width]",
        device === "desktop" && "max-w-2xl",
        className
      )}
      style={device === "mobile" ? { width: MOBILE_PREVIEW_WIDTH } : undefined}
    >
      <div
        data-slot="form-theme"
        style={style}
        className={cn(
          "rounded-3xl border bg-background text-foreground",
          device === "mobile" ? "p-4" : "p-6 sm:p-8"
        )}
      >
        {theme.logoUrl ? (
          <img
            src={theme.logoUrl}
            alt=""
            className="mb-6 h-10 w-auto max-w-[60%] object-contain"
          />
        ) : null}
        {children}
      </div>
    </div>
  )
}
