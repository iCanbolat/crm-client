import { http, HttpResponse } from "msw"

import {
  automationRuleInputSchema,
  type AutomationRuleInput,
} from "@/engine/automation"
import { getObjectDef } from "@/features/records/mocks/store"
import type { FieldErrors } from "@/lib/api"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import type { AutomationRule } from "../api/automation.schemas"
import "./runner"
import type { AutomationRow } from "./types"

const RUN_HISTORY_LIMIT = 50

type RequestT = ReturnType<typeof getRequestT>

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown
  } catch {
    return null
  }
}

function toRule(row: AutomationRow): AutomationRule {
  const runs = db.automationRuns.findMany((run) => run.ruleId === row.id)
  const last = runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    trigger: row.trigger,
    conditions: row.conditions,
    actions: row.actions,
    enabledAt: row.enabledAt,
    lastRun: last ? { status: last.status, createdAt: last.createdAt } : null,
    runCount: runs.length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** References the schema cannot check: members, forms, objects. */
function referenceErrors(
  workspaceId: string,
  input: AutomationRuleInput,
  t: RequestT
): FieldErrors | null {
  const errors: FieldErrors = {}
  const member = (id: string) =>
    id === "owner" ||
    !!db.memberships.findFirst(
      (item) => item.workspaceId === workspaceId && item.userId === id
    )
  const { trigger } = input
  if (
    trigger.type === "submission.created" &&
    trigger.formId &&
    db.forms.findById(trigger.formId)?.workspaceId !== workspaceId
  ) {
    errors["trigger.formId"] = [t("mock.notFound")]
  }
  if (
    (trigger.type === "record.created" ||
      trigger.type === "record.stageChanged") &&
    !getObjectDef(workspaceId, trigger.objectKey)
  ) {
    errors["trigger.objectKey"] = [t("mock.notFound")]
  }
  input.actions.forEach((action, index) => {
    const users =
      action.type === "assignRoundRobin"
        ? action.userIds
        : action.type === "createTask"
          ? [action.assignee]
          : action.type === "notify"
            ? [action.to]
            : []
    if (!users.every(member)) {
      errors[`actions.${index}`] = [t("mock.invalidUser")]
    }
  })
  return Object.keys(errors).length ? errors : null
}

function findRule(workspaceId: string, id: string) {
  const row = db.automations.findById(id)
  return row?.workspaceId === workspaceId ? row : undefined
}

/** Automation rules (B7.3): owners/admins manage, managers read. */
export const automationHandlers = [
  http.get(
    apiPath("/automations"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "read", "automation")
        if (denied) return denied
        const rows = db.automations
          .findMany((row) => row.workspaceId === auth.context.workspace.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        return HttpResponse.json({ data: rows.map(toRule) })
      },
      { empty: () => HttpResponse.json({ data: [] }) }
    )
  ),

  http.post(
    apiPath("/automations"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "automation")
      if (denied) return denied
      const t = getRequestT(request)
      const parsed = automationRuleInputSchema.safeParse(
        await readJson(request)
      )
      if (!parsed.success) {
        return apiError(422, "VALIDATION_ERROR", t("validation"))
      }
      const workspaceId = auth.context.workspace.id
      const fieldErrors = referenceErrors(workspaceId, parsed.data, t)
      if (fieldErrors) {
        return apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors,
        })
      }
      const now = new Date().toISOString()
      const row = db.automations.create({
        id: `aut_${crypto.randomUUID().slice(0, 12)}`,
        workspaceId,
        ...parsed.data,
        enabledAt: parsed.data.enabled ? now : null,
        lastAssigneeId: null,
        createdBy: auth.context.user.id,
        createdAt: now,
        updatedAt: now,
      })
      return HttpResponse.json(toRule(row), { status: 201 })
    })
  ),

  http.get(
    apiPath("/automations/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "automation")
      if (denied) return denied
      const row = findRule(auth.context.workspace.id, String(params.id))
      if (!row) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      return HttpResponse.json(toRule(row))
    })
  ),

  http.patch(
    apiPath("/automations/:id"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "automation")
      if (denied) return denied
      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const row = findRule(workspaceId, String(params.id))
      if (!row) return apiError(404, "NOT_FOUND", t("mock.notFound"))

      const parsed = automationRuleInputSchema
        .partial()
        .safeParse(await readJson(request))
      if (!parsed.success) {
        return apiError(422, "VALIDATION_ERROR", t("validation"))
      }
      const next = { ...row, ...parsed.data }
      const fieldErrors = referenceErrors(workspaceId, next, t)
      if (fieldErrors) {
        return apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors,
        })
      }
      const now = new Date().toISOString()
      const updated = db.automations.update(row.id, {
        ...parsed.data,
        // Switching on starts time based rules afresh (no backlog).
        enabledAt:
          next.enabled && !row.enabled
            ? now
            : next.enabled
              ? row.enabledAt
              : null,
        updatedAt: now,
      })!
      return HttpResponse.json(toRule(updated))
    })
  ),

  http.delete(
    apiPath("/automations/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "automation")
      if (denied) return denied
      const row = findRule(auth.context.workspace.id, String(params.id))
      if (!row) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      db.automations.delete(row.id)
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.get(
    apiPath("/automations/:id/runs"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "automation")
      if (denied) return denied
      const row = findRule(auth.context.workspace.id, String(params.id))
      if (!row) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      const runs = db.automationRuns
        .findMany((run) => run.ruleId === row.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, RUN_HISTORY_LIMIT)
        .map(({ workspaceId: _workspaceId, key: _key, ...run }) => run)
      return HttpResponse.json({ data: runs })
    })
  ),
]
