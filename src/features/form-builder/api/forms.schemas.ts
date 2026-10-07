import { z } from "zod"

import { formContentSchema } from "@/engine/forms"
import { listSearchSchema, paginatedSchema } from "@/lib/api"
import i18n from "@/lib/i18n"

/** Form builder API contract (plan B4.2 / B4.7) — shared with the mock API. */

export const FORM_STATUSES = ["draft", "published"] as const
export const formStatusSchema = z.enum(FORM_STATUSES)
export type FormStatus = z.infer<typeof formStatusSchema>

export const formStatsSchema = z.object({
  views: z.number().int().min(0),
  submissions: z.number().int().min(0),
  /** Submissions per view, 0…1. */
  conversionRate: z.number().min(0),
})
export type FormStats = z.infer<typeof formStatsSchema>

export const formSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Public path segment: `/f/<slug>`. */
  slug: z.string(),
  status: formStatusSchema,
  /** Live version; `null` until first published. */
  publishedVersion: z.number().int().min(1).nullable(),
  /** The draft differs from the live version. */
  hasUnpublishedChanges: z.boolean(),
  fieldCount: z.number().int().min(0),
  ownerId: z.string(),
  ownerName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  stats: formStatsSchema,
})
export type FormSummary = z.infer<typeof formSummarySchema>

/** A form with its draft content (what the builder edits). */
export const formSchema = formSummarySchema.extend({
  content: formContentSchema,
})
export type Form = z.infer<typeof formSchema>

export const formListResponseSchema = paginatedSchema(formSummarySchema)

export const FORM_LIST_DEFAULTS = { page: 1, pageSize: 20 } as const

export const formListSearchSchema = listSearchSchema.extend({
  status: formStatusSchema.optional().catch(undefined),
})
export type FormListParams = z.infer<typeof formListSearchSchema>

export const FORM_NAME_MIN = 2
export const FORM_NAME_MAX = 80
export const FORM_SLUG_MAX = 60
export const FORM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const formNameSchema = z
  .string()
  .trim()
  .min(FORM_NAME_MIN)
  .max(FORM_NAME_MAX)
export const formSlugSchema = z
  .string()
  .trim()
  .max(FORM_SLUG_MAX)
  .regex(FORM_SLUG_PATTERN, { error: () => i18n.t("forms:slugInvalid") })

export const createFormInputSchema = z.object({
  name: formNameSchema,
  /** Derived from the name (and made unique) when omitted. */
  slug: formSlugSchema.optional(),
})
export type CreateFormInput = z.infer<typeof createFormInputSchema>

/** Draft autosave and settings (B4.2): any subset. */
export const updateFormInputSchema = z.object({
  name: formNameSchema.optional(),
  slug: formSlugSchema.optional(),
  content: formContentSchema.optional(),
})
export type UpdateFormInput = z.infer<typeof updateFormInputSchema>
