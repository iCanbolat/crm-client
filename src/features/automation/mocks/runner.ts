import {
  automationRunKey,
  evaluateRuleConditions,
  pickRoundRobin,
  triggerMatches,
  type AutomationAction,
} from "@/engine/automation"
import { sendTemplateFor } from "@/features/messaging/mocks/dispatch"
import { notify } from "@/features/notifications/mocks/store"
import {
  getObjectDef,
  getRecordRef,
  notifyRecordSaved,
} from "@/features/records/mocks/store"
import { db } from "@/mocks/db"
import { onMockEvent, type MockEvent } from "@/mocks/events"
import { registerScheduledCheck } from "@/mocks/scheduler"

import type { ActionResult } from "../api/automation.schemas"
import type { AutomationRow, AutomationRunRow } from "./types"

const DAY_MS = 86_400_000

type RuleEvent = Pick<
  MockEvent,
  "workspaceId" | "type" | "objectKey" | "recordId" | "data"
>

function isoDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const isMember = (workspaceId: string) => (userId: string) =>
  !!db.memberships.findFirst(
    (item) => item.workspaceId === workspaceId && item.userId === userId
  )

const userName = (id: string) => db.users.findById(id)?.name ?? id

const done = (
  type: AutomationAction["type"],
  detail: string | null
): ActionResult => ({ type, status: "done", code: null, detail })
const skipped = (
  type: AutomationAction["type"],
  code: string
): ActionResult => ({ type, status: "skipped", code, detail: null })

/** Runs one action against the record; later actions see earlier changes. */
function execute(
  rule: AutomationRow,
  action: AutomationAction,
  event: RuleEvent,
  key: string,
  now: Date
): ActionResult {
  const { workspaceId } = event
  const row = db.records.findById(event.recordId)
  if (!row) return skipped(action.type, "recordMissing")
  const record = { objectKey: event.objectKey, recordId: event.recordId }
  const recipient = (to: string) =>
    to === "owner" ? String(row.values.ownerId ?? "") : to

  switch (action.type) {
    case "assignRoundRobin": {
      const userId = pickRoundRobin(
        action.userIds,
        rule.lastAssigneeId,
        isMember(workspaceId)
      )
      if (!userId) return skipped(action.type, "noAssignee")
      db.automations.update(rule.id, { lastAssigneeId: userId })
      rule.lastAssigneeId = userId
      if (row.values.ownerId !== userId) {
        const updated = db.records.update(row.id, {
          values: {
            ...row.values,
            ownerId: userId,
            updatedAt: now.toISOString(),
          },
        })!
        // → `record.assigned` → the new owner's notification (B7.2).
        notifyRecordSaved({
          workspaceId,
          objectKey: event.objectKey,
          row: updated,
          previous: row.values,
          actorId: null,
        })
      }
      return done(action.type, userName(userId))
    }
    case "createTask": {
      const assigneeId = recipient(action.assignee)
      if (!assigneeId || !isMember(workspaceId)(assigneeId)) {
        return skipped(action.type, "noAssignee")
      }
      const due = new Date(now.getTime() + action.dueInDays * DAY_MS)
      db.tasks.create({
        id: `tsk_${crypto.randomUUID().slice(0, 12)}`,
        workspaceId,
        title: action.title,
        description: null,
        dueDate: isoDay(due),
        priority: "medium",
        status: "open",
        assigneeId,
        completedAt: null,
        related: record,
        createdBy: rule.createdBy,
        createdAt: now.toISOString(),
      })
      return done(action.type, `${action.title} → ${userName(assigneeId)}`)
    }
    case "sendWhatsAppTemplate": {
      const outcome = sendTemplateFor(
        workspaceId,
        action.templateId,
        record,
        event.data
      )
      return outcome.status === "sent"
        ? done(action.type, null)
        : skipped(action.type, outcome.reason ?? "notConnected")
    }
    case "notify": {
      const userId = recipient(action.to)
      if (!userId || !isMember(workspaceId)(userId)) {
        return skipped(action.type, "noAssignee")
      }
      notify(
        workspaceId,
        [userId],
        {
          type: "automation.notify",
          params: {
            rule: rule.name,
            title:
              getRecordRef(workspaceId, record.objectKey, record.recordId)
                ?.label ?? record.recordId,
          },
          link: record,
          dedupeKey: `automation:${key}`,
        },
        now
      )
      return done(action.type, userName(userId))
    }
  }
}

/**
 * Runs a rule for an event once (TC-7.3-02/04): checks the conditions on the
 * record, executes the actions in order and logs the run.
 */
export function runRule(
  rule: AutomationRow,
  event: RuleEvent,
  now = new Date()
): AutomationRunRow | null {
  const key = automationRunKey(rule.id, event)
  if (db.automationRuns.findFirst((row) => row.key === key)) return null

  const row = db.records.findById(event.recordId)
  const ref = row
    ? getRecordRef(event.workspaceId, event.objectKey, event.recordId)
    : null
  const log = (
    status: AutomationRunRow["status"],
    reason: string | null,
    actions: ActionResult[] = []
  ) =>
    db.automationRuns.create({
      id: `run_${crypto.randomUUID().slice(0, 12)}`,
      workspaceId: event.workspaceId,
      key,
      ruleId: rule.id,
      event: event.type,
      record: ref
        ? {
            objectKey: event.objectKey,
            recordId: event.recordId,
            title: ref.label,
          }
        : null,
      status,
      reason,
      actions,
      createdAt: now.toISOString(),
    })

  if (!row) return log("skipped", "recordMissing")
  const objectDef = getObjectDef(event.workspaceId, event.objectKey)
  if (!evaluateRuleConditions(objectDef, row.values, rule.conditions)) {
    return log("skipped", "conditions")
  }
  const results = rule.actions.map((action) =>
    execute(rule, action, event, key, now)
  )
  return log(
    results.some((result) => result.status === "failed") ? "failed" : "success",
    null,
    results
  )
}

/** Every enabled rule of the workspace the event triggers. */
export function runAutomations(event: RuleEvent, now = new Date()) {
  return db.automations
    .findMany(
      (rule) =>
        rule.workspaceId === event.workspaceId &&
        rule.enabled &&
        triggerMatches(rule.trigger, event)
    )
    .map((rule) => runRule(rule, event, now))
    .filter((run): run is AutomationRunRow => !!run)
}

onMockEvent((event) => {
  if (event.type === "quote.noResponse") return
  runAutomations(event)
})

/**
 * "No answer for N days" (TC-7.3-03): sent quotes whose `sentAt` is at
 * least N days old and after the rule was switched on.
 */
export function runTimedRules(workspaceId: string, now: Date) {
  const rules = db.automations.findMany(
    (rule) =>
      rule.workspaceId === workspaceId &&
      rule.enabled &&
      rule.trigger.type === "quote.noResponse"
  )
  if (!rules.length) return
  const quotes = db.records.findMany(
    (row) =>
      row.workspaceId === workspaceId &&
      row.objectKey === "quote" &&
      row.values.status === "sent" &&
      typeof row.values.sentAt === "string"
  )
  for (const rule of rules) {
    if (rule.trigger.type !== "quote.noResponse") continue
    const cutoff = now.getTime() - rule.trigger.afterDays * DAY_MS
    for (const quote of quotes) {
      const sentAt = String(quote.values.sentAt)
      if (rule.enabledAt && sentAt < rule.enabledAt) continue
      if (Date.parse(sentAt) > cutoff) continue
      runRule(
        rule,
        {
          workspaceId,
          type: "quote.noResponse",
          objectKey: "quote",
          recordId: quote.id,
        },
        now
      )
    }
  }
}

registerScheduledCheck(runTimedRules)
