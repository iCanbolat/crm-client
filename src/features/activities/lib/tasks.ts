import { format } from "date-fns"

import type { Task, TaskScope } from "../api/activities.schemas"

/** Local calendar day as `YYYY-MM-DD`. */
export function toDay(date: Date = new Date()) {
  return format(date, "yyyy-MM-dd")
}

/** Today / overdue / upcoming for open tasks; done ones are "done". */
export function classifyTask(
  task: Pick<Task, "status" | "dueDate">,
  today: string
): TaskScope {
  if (task.status === "done") return "done"
  if (task.dueDate < today) return "overdue"
  if (task.dueDate === today) return "today"
  return "upcoming"
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const

/** Earliest due first, then by priority; done tasks newest first. */
export function compareTasks(a: Task, b: Task) {
  if (a.status === "done" && b.status === "done") {
    return (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
  }
  return (
    a.dueDate.localeCompare(b.dueDate) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.title.localeCompare(b.title, "tr")
  )
}
