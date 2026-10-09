import { z } from "zod"

import { conditionSchema, type Condition } from "../logic/conditions"
import type { ObjectDef, RecordValues } from "../metadata/schemas"
import { matchesConditions } from "../records/query"

/* ----------------------------------------------------------------------------
 * Simple automation rules (B7.3): trigger → conditions → actions. Pure, so
 * the rule editor, the mock backend and tests share the same semantics.
 * ------------------------------------------------------------------------- */

export const AUTOMATION_TRIGGER_TYPES = [
  "submission.created",
  "record.created",
  "record.stageChanged",
  "quote.noResponse",
] as const
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number]

export const automationTriggerSchema = z.discriminatedUnion("type", [
  /** A web form submission created (or linked) a record; `formId` null = any form. */
  z.object({
    type: z.literal("submission.created"),
    formId: z.string().min(1).nullable(),
  }),
  z.object({ type: z.literal("record.created"), objectKey: z.string().min(1) }),
  /** Moved to `stage` (null = any stage) of the object's pipeline. */
  z.object({
    type: z.literal("record.stageChanged"),
    objectKey: z.string().min(1),
    stage: z.string().min(1).nullable(),
  }),
  /** A sent quote still has no answer `afterDays` days later. */
  z.object({
    type: z.literal("quote.noResponse"),
    afterDays: z.number().int().min(1).max(30),
  }),
])
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>

export const AUTOMATION_ACTION_TYPES = [
  "assignRoundRobin",
  "createTask",
  "sendWhatsAppTemplate",
  "notify",
] as const
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number]

/** `owner` = the record's owner at the time the action runs. */
const recipientSchema = z.union([z.literal("owner"), z.string().min(1)])

export const automationActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("assignRoundRobin"),
    userIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal("createTask"),
    title: z.string().trim().min(1).max(200),
    dueInDays: z.number().int().min(0).max(30),
    assignee: recipientSchema,
  }),
  z.object({
    type: z.literal("sendWhatsAppTemplate"),
    templateId: z.string().min(1),
  }),
  z.object({ type: z.literal("notify"), to: recipientSchema }),
])
export type AutomationAction = z.infer<typeof automationActionSchema>

export const automationRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
  trigger: automationTriggerSchema,
  conditions: z.array(conditionSchema).max(10),
  actions: z.array(automationActionSchema).min(1).max(5),
})
export type AutomationRuleInput = z.infer<typeof automationRuleInputSchema>

/** Event as the rules see it (the mock's domain events). */
export interface AutomationEvent {
  type: string
  objectKey: string
  data?: Record<string, string>
}

/** Object whose fields the conditions test (`null` = decided by the event). */
export function triggerObjectKey(trigger: AutomationTrigger): string | null {
  switch (trigger.type) {
    case "record.created":
    case "record.stageChanged":
      return trigger.objectKey
    case "quote.noResponse":
      return "quote"
    case "submission.created":
      // Usually a lead: whatever the form maps to.
      return "lead"
  }
}

/** Does the event fire this trigger? (Conditions are checked separately.) */
export function triggerMatches(
  trigger: AutomationTrigger,
  event: AutomationEvent
) {
  if (event.type !== trigger.type) return false
  switch (trigger.type) {
    case "submission.created":
      return !trigger.formId || event.data?.formId === trigger.formId
    case "record.created":
      return event.objectKey === trigger.objectKey
    case "record.stageChanged":
      return (
        event.objectKey === trigger.objectKey &&
        (!trigger.stage || event.data?.stage === trigger.stage)
      )
    case "quote.noResponse":
      return event.objectKey === "quote"
  }
}

/** All conditions (AND) against the record's values (TC-7.3-01). */
export function evaluateRuleConditions(
  objectDef: ObjectDef | undefined,
  values: RecordValues,
  conditions: readonly Condition[]
) {
  if (!conditions.length) return true
  // Conditions about an object that no longer exists never pass.
  if (!objectDef) return false
  return matchesConditions(objectDef, values, conditions)
}

/**
 * Next assignee of a round-robin: the user after the last one picked, in
 * the configured order. Users who left the workspace are skipped.
 */
export function pickRoundRobin(
  userIds: readonly string[],
  lastUserId: string | null,
  isMember: (userId: string) => boolean = () => true
) {
  const candidates = userIds.filter(isMember)
  if (!candidates.length) return null
  const last = lastUserId ? candidates.indexOf(lastUserId) : -1
  return candidates[(last + 1) % candidates.length]!
}

/**
 * Idempotency key of one rule run: the same rule never runs twice for the
 * same record and event (a stage change counts per target stage).
 */
export function automationRunKey(
  ruleId: string,
  event: AutomationEvent & { recordId: string }
) {
  const stage = event.type === "record.stageChanged" ? event.data?.stage : null
  return [ruleId, event.type, event.objectKey, event.recordId, stage]
    .filter(Boolean)
    .join(":")
}
