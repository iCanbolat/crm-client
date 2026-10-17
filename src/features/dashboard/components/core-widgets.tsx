import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { DashboardWidget } from "@/components/common/dashboard"
import { Badge } from "@/components/ui/badge"
import {
  compareTasks,
  TaskItem,
  taskQueries,
  toDay,
} from "@/features/activities"
import { usePermission } from "@/features/auth"
import { submissionQueries } from "@/features/submissions"
import { getCurrentLanguage } from "@/lib/i18n"
import { formatRelativeTime } from "@/lib/format"

const LIST_LIMIT = 5

const seeAllClass =
  "text-xs font-medium text-primary underline-offset-4 hover:underline"

/** Niche independent: what the current user should do today. */
export function MyTasksWidget() {
  const { t } = useTranslation("dashboard")
  const today = useMemo(() => toDay(), [])
  const overdue = useQuery(
    taskQueries.list({ scope: "overdue", assignee: "me", today })
  )
  const dueToday = useQuery(
    taskQueries.list({ scope: "today", assignee: "me", today })
  )
  // One state for the card: pending / error follow whichever is behind.
  const query = overdue.isSuccess ? dueToday : overdue

  return (
    <DashboardWidget
      query={query}
      title={t("core.tasks")}
      description={
        overdue.data && dueToday.data
          ? t("core.tasksHint", {
              today: dueToday.data.counts.today,
              overdue: overdue.data.counts.overdue,
            })
          : undefined
      }
      action={
        <Link to="/tasks" className={seeAllClass}>
          {t("seeAll")}
        </Link>
      }
      isEmpty={() => !overdue.data?.data.length && !dueToday.data?.data.length}
      emptyText={t("core.noTasks")}
    >
      {() => {
        const tasks = [
          ...(overdue.data?.data ?? []),
          ...(dueToday.data?.data ?? []),
        ]
          .sort(compareTasks)
          .slice(0, LIST_LIMIT)
        return (
          <ul className="-my-3 flex flex-col divide-y">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} today={today} />
            ))}
          </ul>
        )
      }}
    </DashboardWidget>
  )
}

/** Website / form leads nobody reviewed yet. */
export function NewSubmissionsWidget() {
  const { t } = useTranslation("dashboard")
  const language = getCurrentLanguage()
  const query = useQuery(
    submissionQueries.list({ page: 1, pageSize: LIST_LIMIT, status: "new" })
  )

  return (
    <DashboardWidget
      query={query}
      title={t("core.submissions")}
      description={
        query.data
          ? t("core.submissionsHint", { count: query.data.meta.total })
          : undefined
      }
      action={
        <Link
          to="/submissions"
          search={{ status: "new" }}
          className={seeAllClass}
        >
          {t("seeAll")}
        </Link>
      }
      isEmpty={(data) => data.data.length === 0}
      emptyText={t("core.noSubmissions")}
    >
      {(data) => (
        <ul className="-my-2 flex flex-col divide-y">
          {data.data.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <div className="flex min-w-0 flex-col">
                {item.record ? (
                  <Link
                    to="/o/$objectKey/$recordId"
                    params={{
                      objectKey: item.record.objectKey,
                      recordId: item.record.id,
                    }}
                    className="truncate font-medium underline-offset-4 hover:underline"
                  >
                    {item.contactLabel ?? item.record.title}
                  </Link>
                ) : (
                  <span className="truncate font-medium">
                    {item.contactLabel ?? t("core.anonymous")}
                  </span>
                )}
                <span className="truncate text-xs text-muted-foreground">
                  {item.formName}
                  {item.utm.source ? ` · ${item.utm.source}` : ""}
                </span>
              </div>
              <Badge variant="secondary" className="shrink-0">
                <time dateTime={item.createdAt}>
                  {formatRelativeTime(item.createdAt, language)}
                </time>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </DashboardWidget>
  )
}

/** Core widgets the current user may see, in display order. */
export function useCoreWidgets() {
  const canReadSubmissions = usePermission("read", "submission")
  return [
    { id: "core.tasks", component: MyTasksWidget },
    ...(canReadSubmissions
      ? [{ id: "core.submissions", component: NewSubmissionsWidget }]
      : []),
  ]
}
