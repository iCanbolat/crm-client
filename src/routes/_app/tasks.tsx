import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"

import {
  MyTasksPage,
  myTasksQuery,
  TASK_SCOPES,
  taskQueries,
  toDay,
} from "@/features/activities"
import { directoryQueries } from "@/features/records"

const TASKS_DEFAULTS = { scope: "today", assignee: "me" } as const

const tasksSearchSchema = z.object({
  scope: z.enum(TASK_SCOPES).default("today").catch("today"),
  assignee: z.enum(["me", "all"]).default("me").catch("me"),
})

export const Route = createFileRoute("/_app/tasks")({
  staticData: { crumb: "tasks" },
  validateSearch: tasksSearchSchema,
  search: { middlewares: [stripSearchParams(TASKS_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        taskQueries.list(myTasksQuery(deps, toDay()))
      ),
      context.queryClient.ensureQueryData(directoryQueries.users()),
    ]),
  component: TasksRoute,
})

function TasksRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // One "today" per visit, matching what the loader requested.
  const today = useMemo(() => toDay(), [])

  return (
    <MyTasksPage
      search={search}
      today={today}
      onSearchChange={(patch) =>
        void navigate({
          search: (prev) => ({ ...prev, ...patch }),
          replace: true,
        })
      }
    />
  )
}
