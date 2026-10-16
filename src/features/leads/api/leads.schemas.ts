import { z } from "zod"

import { crmRecordSchema } from "@/engine/metadata"

/** Why an existing record is suggested as the lead's match. */
export const MATCH_REASONS = ["email", "domain", "taxNumber", "name"] as const
export type MatchReason = (typeof MATCH_REASONS)[number]

export const conversionMatchSchema = z.object({
  id: z.string(),
  label: z.string(),
  reason: z.enum(MATCH_REASONS),
})
export type ConversionMatch = z.infer<typeof conversionMatchSchema>

export const conversionSuggestionsSchema = z.object({
  companies: z.array(conversionMatchSchema),
  contacts: z.array(conversionMatchSchema),
})
export type ConversionSuggestions = z.infer<typeof conversionSuggestionsSchema>

const requiredText = z.string().trim().min(1).max(160)

export const convertLeadInputSchema = z.object({
  company: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existing"), id: z.string().min(1) }),
    z.object({ mode: z.literal("new"), name: requiredText }),
    // Individuals (B2C modules, B8.4).
    z.object({ mode: z.literal("none") }),
  ]),
  contact: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existing"), id: z.string().min(1) }),
    z.object({ mode: z.literal("new"), name: requiredText }),
    z.object({ mode: z.literal("none") }),
  ]),
  deal: z.discriminatedUnion("create", [
    z.object({ create: z.literal(true), name: requiredText }),
    z.object({ create: z.literal(false) }),
  ]),
  /** Module records to create (`ModuleManifest.leadConversion.targets`). */
  targets: z.array(z.string().min(1)).max(5).default([]),
})
export type ConvertLeadInput = z.input<typeof convertLeadInputSchema>

export const convertLeadResultSchema = z.object({
  lead: crmRecordSchema,
  companyId: z.string().nullable(),
  contactId: z.string().nullable(),
  dealId: z.string().nullable(),
  targets: z
    .array(z.object({ objectKey: z.string(), id: z.string() }))
    .default([]),
})
export type ConvertLeadResult = z.infer<typeof convertLeadResultSchema>
