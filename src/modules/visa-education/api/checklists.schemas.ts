import { z } from "zod"

import { i18nTextSchema } from "@/engine/metadata"

import { CHECKLIST_STATUSES, DOCUMENT_TYPES } from "../lib/constants"

/** Document checklist of a school / visa application (B8.7). */

export const checklistItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.union([i18nTextSchema, z.string()]),
  category: z.enum(DOCUMENT_TYPES),
  required: z.boolean(),
  status: z.enum(CHECKLIST_STATUSES),
  attachmentId: z.string().nullable(),
  /** Validity end of the document (`yyyy-MM-dd`). */
  expiresAt: z.string().nullable(),
  /** Date the current file was received (`yyyy-MM-dd`). */
  documentDate: z.string().nullable(),
  maxAgeDays: z.number().nullable(),
  note: z.string().nullable(),
  requestedAt: z.string().nullable(),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
  sort: z.number(),
  /** Added by a consultant (may be deleted), not from the template. */
  custom: z.boolean(),
})
export type ChecklistItem = z.infer<typeof checklistItemSchema>

export const checklistSummarySchema = z.object({
  total: z.number(),
  required: z.number(),
  complete: z.number(),
  missing: z.number(),
  outdated: z.number(),
  progress: z.number(),
  ready: z.boolean(),
})
export type ChecklistSummary = z.infer<typeof checklistSummarySchema>

export const checklistResponseSchema = z.object({
  templateKey: z.string().nullable(),
  items: z.array(checklistItemSchema),
  summary: checklistSummarySchema,
})
export type ChecklistResponse = z.infer<typeof checklistResponseSchema>

export const checklistItemPatchSchema = z
  .object({
    status: z.enum(CHECKLIST_STATUSES),
    note: z.string().max(500).nullable(),
    expiresAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    attachmentId: z.string().nullable(),
  })
  .partial()
export type ChecklistItemPatch = z.infer<typeof checklistItemPatchSchema>

export const checklistItemInputSchema = z.object({
  label: z.string().trim().min(1).max(120),
  category: z.enum(DOCUMENT_TYPES),
  required: z.boolean().default(true),
})
export type ChecklistItemInput = z.input<typeof checklistItemInputSchema>

export const applyTemplateInputSchema = z.object({
  templateKey: z.string().min(1),
})
