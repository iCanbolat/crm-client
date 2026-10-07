import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { label } from "../metadata/helpers"
import type { FieldDef, OptionColor } from "../metadata/schemas"

/** Tinted badge colors; text shades keep WCAG AA on the tinted background. */
const OPTION_COLOR_CLASSES: Record<OptionColor, string> = {
  gray: "bg-muted text-foreground",
  blue: "bg-blue-500/15 text-blue-800 dark:text-blue-200",
  green: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  amber: "bg-amber-500/20 text-amber-900 dark:text-amber-200",
  red: "bg-red-500/15 text-red-800 dark:text-red-200",
  violet: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  teal: "bg-teal-500/15 text-teal-800 dark:text-teal-200",
}

export function optionColorClass(color: OptionColor | undefined) {
  return OPTION_COLOR_CLASSES[color ?? "gray"]
}

export function ColorBadge({
  color,
  children,
  className,
}: {
  color?: OptionColor
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center rounded-3xl px-2 text-xs font-medium whitespace-nowrap",
        optionColorClass(color),
        className
      )}
    >
      {children}
    </span>
  )
}

export function OptionBadge({
  field,
  value,
}: {
  field: FieldDef
  value: string
}) {
  const option = field.options?.find((item) => item.value === value)
  return (
    <ColorBadge color={option?.color}>
      {option ? label(option.label, getCurrentLanguage()) : value}
    </ColorBadge>
  )
}

/** Placeholder for empty cells ("—"), announced as "empty". */
export function EmptyValue() {
  const { t } = useTranslation("engine")
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>{t("empty")}</span>
      <span className="sr-only">{t("emptyValue")}</span>
    </span>
  )
}
