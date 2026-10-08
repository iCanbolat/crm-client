import { z } from "zod"

import { formContentSchema } from "@/engine/forms"
import { supportedLanguages } from "@/lib/i18n"

/**
 * Public API contract (B5.4): what visitors of a form site may see. Kept
 * separate from the admin site schema so the public bundle stays small and
 * nothing internal leaks (owner, mapping targets are part of the content but
 * never the tenant's ids or settings).
 */
export const publicSiteSchema = z.object({
  brand: z.object({
    name: z.string(),
    logoUrl: z.string().nullable(),
    faviconUrl: z.string().nullable(),
    primaryColor: z.string(),
  }),
  seo: z.object({
    title: z.string(),
    description: z.string(),
    ogImageUrl: z.string().nullable(),
  }),
  legal: z.object({
    kvkkUrl: z.string(),
    privacyUrl: z.string(),
    cookieUrl: z.string(),
  }),
  /** Slug of the form shown at `/` (`null` → 404). */
  defaultFormSlug: z.string().nullable(),
})
export type PublicSite = z.infer<typeof publicSiteSchema>

export const publicFormSchema = z.object({
  slug: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  content: formContentSchema,
})
export type PublicForm = z.infer<typeof publicFormSchema>

export const submissionMetaSchema = z.object({
  /** Page the form was submitted from (UTM parameters are read from it). */
  pageUrl: z.string().max(2000),
  referrer: z.string().max(2000),
  embedded: z.boolean(),
  /** Language the visitor filled the form in. */
  language: z.enum(supportedLanguages),
  /** Hidden bot trap; filled → accepted silently, nothing stored. */
  honeypot: z.string().max(500).optional(),
})
export type SubmissionMeta = z.infer<typeof submissionMetaSchema>

export const submitFormInputSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  meta: submissionMetaSchema,
})
export type SubmitFormInput = z.infer<typeof submitFormInputSchema>

export const publicEventSchema = z.object({
  type: z.literal("view"),
  formSlug: z.string(),
})
export type PublicEvent = z.infer<typeof publicEventSchema>
