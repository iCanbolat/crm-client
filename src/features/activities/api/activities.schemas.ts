import { z } from "zod"

import i18n from "@/lib/i18n"

export const ACTIVITY_TYPES = ["note", "call", "email", "meeting"] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const DIRECTIONS = ["outbound", "inbound"] as const

export const activitySchema = z.object({
  id: z.string(),
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().nullable(),
  body: z.string(),
  occurredAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(0).nullable(),
  direction: z.enum(DIRECTIONS).nullable(),
  objectKey: z.string(),
  recordId: z.string(),
  createdBy: z.string(),
  createdByName: z.string().nullable(),
  createdAt: z.iso.datetime(),
})
export type Activity = z.infer<typeof activitySchema>

export const activityListSchema = z.object({ data: z.array(activitySchema) })

export const ACTIVITY_BODY_MAX = 5000

export const activityInputSchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    subject: z.string().trim().max(160).nullable().default(null),
    body: z.string().trim().max(ACTIVITY_BODY_MAX).default(""),
    occurredAt: z.iso.datetime({ offset: true }).optional(),
    durationMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .nullable()
      .default(null),
    direction: z.enum(DIRECTIONS).nullable().default(null),
  })
  .refine((input) => input.type !== "note" || input.body.length > 0, {
    path: ["body"],
    error: () => i18n.t("engine:validation.required"),
  })
export type ActivityInput = z.input<typeof activityInputSchema>

/* ---------------------------------------------------------------- tasks */

export const TASK_PRIORITIES = ["low", "medium", "high"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_SCOPES = ["today", "overdue", "upcoming", "done"] as const
export type TaskScope = (typeof TASK_SCOPES)[number]

export const taskRelationSchema = z.object({
  objectKey: z.string(),
  recordId: z.string(),
  label: z.string(),
})

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  /** Local calendar day (`YYYY-MM-DD`). */
  dueDate: z.iso.date(),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(["open", "done"]),
  assigneeId: z.string(),
  assigneeName: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  related: taskRelationSchema.nullable(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
})
export type Task = z.infer<typeof taskSchema>

export const taskCountsSchema = z.object({
  today: z.number().int(),
  overdue: z.number().int(),
  upcoming: z.number().int(),
  done: z.number().int(),
})
export type TaskCounts = z.infer<typeof taskCountsSchema>

export const taskListSchema = z.object({
  data: z.array(taskSchema),
  counts: taskCountsSchema,
})
export type TaskList = z.infer<typeof taskListSchema>

export const TASK_TITLE_MAX = 160

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(TASK_TITLE_MAX),
  description: z.string().trim().max(2000).nullable().default(null),
  dueDate: z.iso.date(),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assigneeId: z.string().min(1),
  related: taskRelationSchema
    .pick({ objectKey: true, recordId: true })
    .nullable()
    .default(null),
})
export type TaskInput = z.input<typeof taskInputSchema>

export const taskPatchSchema = z.object({
  title: taskInputSchema.shape.title.optional(),
  description: taskInputSchema.shape.description.optional(),
  dueDate: taskInputSchema.shape.dueDate.optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().min(1).optional(),
  status: z.enum(["open", "done"]).optional(),
})
export type TaskPatch = z.infer<typeof taskPatchSchema>

/** `GET /tasks` query. */
export interface TaskQuery {
  scope?: TaskScope
  /** Client's local day, so "today" follows the user's time zone. */
  today: string
  assignee?: "me" | "all"
  objectKey?: string
  recordId?: string
  status?: "open" | "done"
}
