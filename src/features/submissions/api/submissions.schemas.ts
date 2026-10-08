import { z } from "zod"

import { listSearchSchema, paginatedSchema } from "@/lib/api"

/**
 * Form submissions inbox (B5.5/B5.6).
 * - `new`: arrived (a record was created or linked) and nobody reviewed it
 * - `processed`: handled by the team
 * - `spam`: junk; kept for the record, hidden from the default view
 * - `failed`: the CRM mapping could not create a record (manual conversion)
 */
export const SUBMISSION_STATUSES = [
  "new",
  "processed",
  "spam",
  "failed",
] as const
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES)
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>

export const UTM_KEYS = [
  "source",
  "medium",
  "campaign",
  "term",
  "content",
] as const
export type UtmKey = (typeof UTM_KEYS)[number]

export const utmSchema = z.object({
  source: z.string().nullable(),
  medium: z.string().nullable(),
  campaign: z.string().nullable(),
  term: z.string().nullable(),
  content: z.string().nullable(),
})
export type Utm = z.infer<typeof utmSchema>

export const submissionRecordSchema = z.object({
  objectKey: z.string(),
  id: z.string(),
  title: z.string(),
})

export const submissionSummarySchema = z.object({
  id: z.string(),
  formId: z.string(),
  formName: z.string(),
  formVersion: z.number().int(),
  status: submissionStatusSchema,
  /** Name / e-mail of the visitor when the form asked for them. */
  contactLabel: z.string().nullable(),
  utm: utmSchema,
  record: submissionRecordSchema.nullable(),
  createdAt: z.string(),
})
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>

export const submissionAnswerSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** Display value in the request language (`""` = not answered). */
  value: z.string(),
})
export type SubmissionAnswer = z.infer<typeof submissionAnswerSchema>

export const submissionSchema = submissionSummarySchema.extend({
  answers: z.array(submissionAnswerSchema),
  referrer: z.string().nullable(),
  pageUrl: z.string().nullable(),
  embedded: z.boolean(),
  language: z.string(),
  /** Why no record could be created (`failed`). */
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
})
export type Submission = z.infer<typeof submissionSchema>

export const submissionListSchema = paginatedSchema(submissionSummarySchema)

export const SUBMISSION_LIST_DEFAULTS = { page: 1, pageSize: 20 } as const

export const submissionListSearchSchema = listSearchSchema.extend({
  status: submissionStatusSchema.optional().catch(undefined),
  formId: z.string().optional().catch(undefined),
})
export type SubmissionListParams = z.infer<typeof submissionListSearchSchema>

export const updateSubmissionInputSchema = z.object({
  status: z.enum(["new", "processed", "spam"]),
})
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionInputSchema>
