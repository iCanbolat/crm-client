import type { UseQueryResult } from "@tanstack/react-query"
import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/common/error-state"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface DashboardWidgetProps<T> {
  query: UseQueryResult<T>
  title: string
  description?: ReactNode
  /** Header action, e.g. a "see all" link. */
  action?: ReactNode
  isEmpty?: (data: T) => boolean
  emptyText?: ReactNode
  className?: string
  children: (data: T) => ReactNode
}

/** Dashboard card with the loading / error / empty states every widget shares. */
export function DashboardWidget<T>({
  query,
  title,
  description,
  action,
  isEmpty,
  emptyText,
  className,
  children,
}: DashboardWidgetProps<T>) {
  const { t } = useTranslation("dashboard")
  const titleId = useId()
  return (
    <Card
      size="sm"
      className={cn("h-full", className)}
      role="region"
      aria-labelledby={titleId}
    >
      <CardHeader>
        <CardTitle>
          <h2 id={titleId}>{title}</h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex-1">
        {query.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : isEmpty?.(query.data) ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyText ?? t("empty")}
          </p>
        ) : (
          children(query.data)
        )}
      </CardContent>
    </Card>
  )
}
