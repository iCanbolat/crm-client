import { useQuery } from "@tanstack/react-query"
import { ListTodoIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Can } from "@/features/auth"

import { taskQueries } from "../api/activities.queries"
import { toDay } from "../lib/tasks"
import { ActivityComposer } from "./activity-composer"
import { ActivityTimeline } from "./activity-timeline"
import { TaskDialog } from "./task-dialog"
import { TaskItem } from "./task-item"

interface RecordTimelineProps {
  objectKey: string
  recordId: string
  /** Record title, shown on tasks created from here. */
  recordLabel: string
}

function RecordTasks({
  objectKey,
  recordId,
  recordLabel,
}: RecordTimelineProps) {
  const { t } = useTranslation("activities")
  const [creating, setCreating] = useState(false)
  const today = toDay()
  const { data, isPending } = useQuery(
    taskQueries.list({
      today,
      objectKey,
      recordId,
      assignee: "all",
      status: "open",
    })
  )

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3 id="record-tasks-title">{t("tasks.openTitle")}</h3>
        </CardTitle>
        <CardAction>
          <Can action="create" resource="record">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("tasks.add")}
              onClick={() => setCreating(true)}
            >
              <PlusIcon />
            </Button>
          </Can>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <LoadingSkeleton rows={2} />
        ) : data?.data.length ? (
          <ul
            aria-labelledby="record-tasks-title"
            className="flex flex-col divide-y"
          >
            {data.data.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                today={today}
                showRelated={false}
                showAssignee
              />
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListTodoIcon className="size-4" aria-hidden />
            {t("tasks.noneOpen")}
          </p>
        )}
      </CardContent>
      <TaskDialog
        open={creating}
        onOpenChange={setCreating}
        related={{ objectKey, recordId, label: recordLabel }}
      />
    </Card>
  )
}

/** "Timeline" tab of a record: log activities, see history and open tasks. */
export function RecordTimeline(props: RecordTimelineProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <Can action="create" resource="record">
          <ActivityComposer
            objectKey={props.objectKey}
            recordId={props.recordId}
          />
        </Can>
        <ActivityTimeline
          objectKey={props.objectKey}
          recordId={props.recordId}
        />
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <RecordTasks {...props} />
      </aside>
    </div>
  )
}
