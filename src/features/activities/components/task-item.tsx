import { Link } from "@tanstack/react-router"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { CalendarIcon, FlagIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Checkbox } from "@/components/ui/checkbox"
import { ColorBadge } from "@/engine/field-types"
import { usePermission } from "@/features/auth"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { useUpdateTask } from "../api/activities.mutations"
import type { Task, TaskPriority } from "../api/activities.schemas"
import { classifyTask } from "../lib/tasks"

const PRIORITY_COLORS = {
  high: "red",
  medium: "amber",
  low: "gray",
} as const satisfies Record<TaskPriority, string>

interface TaskItemProps {
  task: Task
  today: string
  /** Hide the related record link (already on that record's page). */
  showRelated?: boolean
  showAssignee?: boolean
}

export function TaskItem({
  task,
  today,
  showRelated = true,
  showAssignee = false,
}: TaskItemProps) {
  const { t } = useTranslation("activities")
  const language = getCurrentLanguage()
  const mutation = useUpdateTask()
  const canEdit = usePermission("update", "record", {
    ownerId: task.assigneeId,
  })
  const scope = classifyTask(task, today)
  const done = task.status === "done"
  const overdueDays = differenceInCalendarDays(
    parseISO(today),
    parseISO(task.dueDate)
  )

  const due =
    scope === "today"
      ? t("tasks.dueToday")
      : scope === "overdue"
        ? t("tasks.overdueBy", { count: overdueDays })
        : formatDate(parseISO(task.dueDate), language)

  return (
    <li className="flex items-start gap-3 py-3">
      <Checkbox
        className="mt-0.5"
        checked={done}
        disabled={!canEdit}
        aria-label={
          done
            ? t("tasks.markOpen", { title: task.title })
            : t("tasks.markDone", { title: task.title })
        }
        onCheckedChange={(checked) =>
          mutation.mutate({
            id: task.id,
            patch: { status: checked ? "done" : "open" },
          })
        }
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-sm font-medium break-words",
            done && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1",
              scope === "overdue" && "font-medium text-destructive"
            )}
          >
            <CalendarIcon className="size-3.5" aria-hidden />
            <time dateTime={task.dueDate}>{due}</time>
          </span>
          <ColorBadge color={PRIORITY_COLORS[task.priority]}>
            <FlagIcon className="mr-1 size-3" aria-hidden />
            {t(`priorities.${task.priority}`)}
          </ColorBadge>
          {showAssignee && task.assigneeName ? (
            <span>{task.assigneeName}</span>
          ) : null}
          {showRelated && task.related ? (
            <Link
              to="/o/$objectKey/$recordId"
              params={{
                objectKey: task.related.objectKey,
                recordId: task.related.recordId,
              }}
              className="truncate text-foreground underline underline-offset-4"
            >
              {task.related.label}
            </Link>
          ) : null}
        </span>
      </div>
    </li>
  )
}
