import type { UseQueryResult } from "@tanstack/react-query"
import { Link, type LinkProps } from "@tanstack/react-router"
import { ArrowUpRightIcon, type LucideIcon } from "lucide-react"
import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type StatTone = "default" | "positive" | "warning" | "destructive"

const TONE_CLASSES: Record<StatTone, string> = {
  default: "bg-primary/10 text-primary",
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  destructive: "bg-destructive/10 text-destructive",
}

interface StatCardProps<T> {
  query: UseQueryResult<T>
  label: string
  icon: LucideIcon
  value: (data: T) => ReactNode
  hint?: (data: T) => ReactNode
  /** Tone of the icon chip; may depend on the data (e.g. overdue > 0). */
  tone?: StatTone | ((data: T) => StatTone)
  isEmpty?: (data: T) => boolean
  emptyText?: ReactNode
  /** Makes the whole card a link to the underlying list. */
  link?: Pick<LinkProps, "to" | "params" | "search">
  testId?: string
}

/** One KPI of the dashboard strip: label, big number, short hint. */
export function StatCard<T>({
  query,
  label,
  icon: Icon,
  value,
  hint,
  tone = "default",
  isEmpty,
  emptyText,
  link,
  testId,
}: StatCardProps<T>) {
  const { t } = useTranslation(["dashboard", "errors", "common"])
  const labelId = useId()
  const data = query.data
  const empty = data !== undefined && (isEmpty?.(data) ?? false)
  const resolvedTone =
    data === undefined || empty
      ? "default"
      : typeof tone === "function"
        ? tone(data)
        : tone

  return (
    <Card
      size="sm"
      role="region"
      aria-labelledby={labelId}
      className={cn(
        "relative h-full gap-3 px-4",
        link && "transition-shadow focus-within:ring-2 hover:shadow-lg"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id={labelId}
          className="text-sm leading-snug font-medium text-muted-foreground"
        >
          {link ? (
            <Link
              {...link}
              className="outline-none after:absolute after:inset-0 after:rounded-4xl"
            >
              {label}
            </Link>
          ) : (
            label
          )}
        </h2>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-2xl",
            TONE_CLASSES[resolvedTone]
          )}
          aria-hidden
        >
          <Icon className="size-4.5" />
        </span>
      </div>
      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : query.isError ? (
        <div className="flex flex-col gap-1">
          <p className="font-heading text-2xl font-semibold text-muted-foreground xl:text-3xl">
            —
          </p>
          <button
            type="button"
            className="relative z-10 self-start text-xs text-destructive underline-offset-4 hover:underline"
            onClick={() => void query.refetch()}
          >
            {t("errors:title")} · {t("common:actions.retry")}
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <p
            className="truncate font-heading text-2xl font-semibold tracking-tight tabular-nums xl:text-3xl"
            data-testid={testId}
          >
            {empty ? "—" : value(query.data)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {empty ? (emptyText ?? t("dashboard:empty")) : hint?.(query.data)}
          </p>
        </div>
      )}
      {link ? (
        <ArrowUpRightIcon
          className="absolute right-4 bottom-4 size-4 text-muted-foreground/60"
          aria-hidden
        />
      ) : null}
    </Card>
  )
}
