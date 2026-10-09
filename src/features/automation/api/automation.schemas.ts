import { z } from "zod"

import { automationRuleInputSchema } from "@/engine/automation"

export const RUN_STATUSES = ["success", "skipped", "failed"] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const ACTION_RESULT_STATUSES = ["done", "skipped", "failed"] as const

export const automationRuleSchema = automationRuleInputSchema.extend({
  id: z.string(),
  /** When the rule was last switched on (time based rules start here). */
  enabledAt: z.iso.datetime().nullable(),
  lastRun: z
    .object({ status: z.enum(RUN_STATUSES), createdAt: z.iso.datetime() })
    .nullable(),
  runCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type AutomationRule = z.infer<typeof automationRuleSchema>

export const automationRuleListSchema = z.object({
  data: z.array(automationRuleSchema),
})

export const actionResultSchema = z.object({
  type: z.string(),
  status: z.enum(ACTION_RESULT_STATUSES),
  /** Why it was skipped / failed (i18n key part), e.g. `noAssignee`. */
  code: z.string().nullable(),
  /** Display detail, e.g. the assignee's name or the task title. */
  detail: z.string().nullable(),
})
export type ActionResult = z.infer<typeof actionResultSchema>

export const automationRunSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  event: z.string(),
  record: z
    .object({ objectKey: z.string(), recordId: z.string(), title: z.string() })
    .nullable(),
  status: z.enum(RUN_STATUSES),
  /** Why the whole run was skipped, e.g. `conditions`. */
  reason: z.string().nullable(),
  actions: z.array(actionResultSchema),
  createdAt: z.iso.datetime(),
})
export type AutomationRun = z.infer<typeof automationRunSchema>

export const automationRunListSchema = z.object({
  data: z.array(automationRunSchema),
})
