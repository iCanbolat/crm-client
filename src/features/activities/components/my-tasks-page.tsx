import { useSuspenseQuery } from "@tanstack/react-query"
import { CheckCircle2Icon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Can, usePermission } from "@/features/auth"

import { taskQueries } from "../api/activities.queries"
import {
  TASK_SCOPES,
  type TaskQuery,
  type TaskScope,
} from "../api/activities.schemas"
import { TaskDialog } from "./task-dialog"
import { TaskItem } from "./task-item"

export interface MyTasksSearch {
  scope: TaskScope
  assignee: "me" | "all"
}

interface MyTasksPageProps {
  search: MyTasksSearch
  today: string
  onSearchChange: (patch: Partial<MyTasksSearch>) => void
}

export function myTasksQuery(search: MyTasksSearch, today: string): TaskQuery {
  return { scope: search.scope, assignee: search.assignee, today }
}

/** "My tasks": due today, overdue, upcoming and done (B2.6). */
export function MyTasksPage({
  search,
  today,
  onSearchChange,
}: MyTasksPageProps) {
  const { t } = useTranslation("activities")
  const [creating, setCreating] = useState(false)
  // Managers and admins can review the whole team's tasks.
  const canSeeAll = usePermission("update", "record")
  const { data } = useSuspenseQuery(
    taskQueries.list(myTasksQuery(search, today))
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("tasks.pageTitle")}
        description={t("tasks.pageDescription")}
        actions={
          <Can action="create" resource="record">
            <Button onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" />
              {t("tasks.new")}
            </Button>
          </Can>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={search.scope}
          onValueChange={(value) =>
            onSearchChange({ scope: value as TaskScope })
          }
        >
          <TabsList aria-label={t("tasks.scopesLabel")}>
            {TASK_SCOPES.map((scope) => (
              <TabsTrigger key={scope} value={scope}>
                {t(`scopes.${scope}`)}
                <span className="rounded-full bg-background/60 px-1.5 text-xs tabular-nums">
                  {data.counts[scope]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {canSeeAll ? (
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            aria-label={t("tasks.assigneeFilter")}
            value={[search.assignee]}
            onValueChange={(value) => {
              const next = value[0]
              if (next === "me" || next === "all")
                onSearchChange({ assignee: next })
            }}
          >
            <ToggleGroupItem value="me">{t("tasks.mine")}</ToggleGroupItem>
            <ToggleGroupItem value="all">{t("tasks.team")}</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </div>

      {data.data.length === 0 ? (
        <EmptyState
          icon={CheckCircle2Icon}
          title={t(`empty.${search.scope}`)}
          description={t("empty.description")}
        />
      ) : (
        <ul
          aria-label={t(`scopes.${search.scope}`)}
          className="flex flex-col divide-y rounded-3xl border px-4"
        >
          {data.data.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              today={today}
              showAssignee={search.assignee === "all"}
            />
          ))}
        </ul>
      )}
      <TaskDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
