import { http, HttpResponse } from "msw"
import { z } from "zod"

import type { FieldErrors } from "@/lib/api"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"
import {
  findRecordRow,
  getObjectDef,
  getRecordRef,
} from "@/features/records/mocks/store"

import {
  activityInputSchema,
  TASK_SCOPES,
  taskInputSchema,
  taskPatchSchema,
  type Activity,
  type Task,
  type TaskCounts,
  type TaskScope,
} from "../api/activities.schemas"
import { classifyTask, compareTasks, toDay } from "../lib/tasks"
import type { ActivityRow, TaskRow } from "./factory"

type RequestT = ReturnType<typeof getRequestT>

const validationError = (t: RequestT, error: z.ZodError) =>
  apiError(422, "VALIDATION_ERROR", t("validation"), {
    fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
  })

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

function toActivity({
  workspaceId: _workspaceId,
  ...row
}: ActivityRow): Activity {
  return {
    ...row,
    createdByName: db.users.findById(row.createdBy)?.name ?? null,
  }
}

function toTask({ workspaceId, ...row }: TaskRow): Task {
  const ref = row.related
    ? getRecordRef(workspaceId, row.related.objectKey, row.related.recordId)
    : null
  return {
    ...row,
    assigneeName: db.users.findById(row.assigneeId)?.name ?? null,
    related:
      row.related && ref
        ? {
            objectKey: row.related.objectKey,
            recordId: row.related.recordId,
            label: ref.label,
          }
        : null,
  }
}

const isDay = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)

export const activitiesHandlers = [
  http.get(
    apiPath("/records/:objectKey/:id/activities"),
    withScenario(
      ({ request, params }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const workspaceId = auth.context.workspace.id
        if (
          !findRecordRow(
            workspaceId,
            String(params.objectKey),
            String(params.id)
          )
        ) {
          return apiError(
            404,
            "NOT_FOUND",
            getRequestT(request)("mock.notFound")
          )
        }
        const data = db.activities
          .findMany(
            (row) =>
              row.workspaceId === workspaceId &&
              row.objectKey === params.objectKey &&
              row.recordId === params.id
          )
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          .map(toActivity)
        return HttpResponse.json({ data })
      },
      { empty: () => HttpResponse.json({ data: [] }) }
    )
  ),

  http.post(
    apiPath("/records/:objectKey/:id/activities"),
    withScenario(
      async ({ request, params }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "create", "record")
        if (denied) return denied
        const t = getRequestT(request)
        const workspaceId = auth.context.workspace.id
        const record = findRecordRow(
          workspaceId,
          String(params.objectKey),
          String(params.id)
        )
        if (!record) return apiError(404, "NOT_FOUND", t("mock.notFound"))

        const parsed = activityInputSchema.safeParse(await readJson(request))
        if (!parsed.success) return validationError(t, parsed.error)

        const now = new Date().toISOString()
        const row = db.activities.create({
          id: `act_${crypto.randomUUID().slice(0, 12)}`,
          workspaceId,
          ...parsed.data,
          occurredAt: parsed.data.occurredAt ?? now,
          objectKey: record.objectKey,
          recordId: record.id,
          createdBy: auth.context.user.id,
          createdAt: now,
        })
        return HttpResponse.json(toActivity(row), { status: 201 })
      },
      { validationErrors: (t) => ({ body: [t("mock.validation")] }) }
    )
  ),

  http.get(
    apiPath("/tasks"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const { workspace, user } = auth.context
        const url = new URL(request.url)
        const query = url.searchParams
        const today = isDay(query.get("today")) ? query.get("today")! : toDay()
        const scope = TASK_SCOPES.find((item) => item === query.get("scope"))
        const objectKey = query.get("objectKey")
        const recordId = query.get("recordId")
        const status = query.get("status")

        const visible = db.tasks.findMany(
          (row) =>
            row.workspaceId === workspace.id &&
            (query.get("assignee") === "all" || row.assigneeId === user.id) &&
            (!objectKey || row.related?.objectKey === objectKey) &&
            (!recordId || row.related?.recordId === recordId) &&
            (!status || row.status === status)
        )
        const counts: TaskCounts = {
          today: 0,
          overdue: 0,
          upcoming: 0,
          done: 0,
        }
        for (const row of visible) counts[classifyTask(row, today)]++

        const data = visible
          .filter(
            (row) => !scope || classifyTask(row, today) === (scope as TaskScope)
          )
          .map(toTask)
          .sort(compareTasks)
        return HttpResponse.json({ data, counts })
      },
      {
        empty: () =>
          HttpResponse.json({
            data: [],
            counts: { today: 0, overdue: 0, upcoming: 0, done: 0 },
          }),
      }
    )
  ),

  http.post(
    apiPath("/tasks"),
    withScenario(
      async ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "create", "record")
        if (denied) return denied
        const t = getRequestT(request)
        const { workspace, user } = auth.context

        const parsed = taskInputSchema.safeParse(await readJson(request))
        if (!parsed.success) return validationError(t, parsed.error)
        const input = parsed.data

        const member = db.memberships.findFirst(
          (item) =>
            item.workspaceId === workspace.id &&
            item.userId === input.assigneeId
        )
        if (!member) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { assigneeId: [t("mock.invalidUser")] },
          })
        }
        if (
          input.related &&
          (!getObjectDef(workspace.id, input.related.objectKey) ||
            !findRecordRow(
              workspace.id,
              input.related.objectKey,
              input.related.recordId
            ))
        ) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { related: [t("mock.invalidRelation")] },
          })
        }

        const row = db.tasks.create({
          id: `tsk_${crypto.randomUUID().slice(0, 12)}`,
          workspaceId: workspace.id,
          ...input,
          status: "open",
          completedAt: null,
          createdBy: user.id,
          createdAt: new Date().toISOString(),
        })
        return HttpResponse.json(toTask(row), { status: 201 })
      },
      { validationErrors: (t) => ({ title: [t("mock.validation")] }) }
    )
  ),

  http.patch(
    apiPath("/tasks/:id"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const row = db.tasks.findById(String(params.id))
      if (!row || row.workspaceId !== auth.context.workspace.id) {
        return apiError(404, "NOT_FOUND", t("mock.notFound"))
      }
      // Agents may only change tasks assigned to them.
      const denied = authorize(request, auth.context, "update", "record", {
        ownerId: row.assigneeId,
      })
      if (denied) return denied

      const parsed = taskPatchSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(t, parsed.error)
      const patch = parsed.data
      const completedAt =
        patch.status === undefined
          ? row.completedAt
          : patch.status === "done"
            ? (row.completedAt ?? new Date().toISOString())
            : null

      const updated = db.tasks.update(row.id, { ...patch, completedAt })!
      return HttpResponse.json(toTask(updated))
    })
  ),
]
