import { useQuery } from "@tanstack/react-query"
import { HistoryIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import { activityQueries } from "../api/activities.queries"
import type { Activity } from "../api/activities.schemas"
import { ACTIVITY_ICONS } from "./activity-icons"

function ActivityItem({ activity }: { activity: Activity }) {
  const { t } = useTranslation("activities")
  const language = getCurrentLanguage()
  const Icon = ACTIVITY_ICONS[activity.type]
  const meta = [
    activity.direction ? t(`directions.${activity.direction}`) : null,
    activity.durationMinutes !== null
      ? t("timeline.minutes", { count: activity.durationMinutes })
      : null,
  ].filter(Boolean)

  return (
    <li className="group/timeline relative flex gap-3 pb-6 last:pb-0">
      <span
        aria-hidden
        className="absolute top-9 bottom-0 left-4 w-px bg-border group-last/timeline:hidden"
      />
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <article className="flex min-w-0 flex-1 flex-col gap-1">
        <header className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <h3 className="font-medium">
            {t(`types.${activity.type}`)}
            {activity.subject ? `: ${activity.subject}` : ""}
          </h3>
          <time
            dateTime={activity.occurredAt}
            title={formatDate(activity.occurredAt, language, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            className="text-xs text-muted-foreground"
          >
            {formatRelativeTime(activity.occurredAt, language)}
          </time>
        </header>
        {activity.body ? (
          <p className="text-sm whitespace-pre-line">{activity.body}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {[activity.createdByName, ...meta].filter(Boolean).join(" · ")}
        </p>
      </article>
    </li>
  )
}

/** Activity history of a record, newest first. */
export function ActivityTimeline({
  objectKey,
  recordId,
}: {
  objectKey: string
  recordId: string
}) {
  const { t } = useTranslation("activities")
  const query = useQuery(activityQueries.record(objectKey, recordId))

  if (query.isPending) return <LoadingSkeleton rows={3} />
  if (query.isError) {
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    )
  }
  if (query.data.data.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title={t("timeline.emptyTitle")}
        description={t("timeline.emptyDescription")}
      />
    )
  }

  return (
    <ol aria-label={t("timeline.label")} className="flex flex-col">
      {query.data.data.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </ol>
  )
}
