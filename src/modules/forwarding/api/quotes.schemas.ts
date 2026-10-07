import { z } from "zod"

import { recordRefSchema } from "@/engine/metadata"

import {
  CHARGE_CODES,
  QUOTE_STATUSES,
  TRANSPORT_MODES,
  UNIT_BASES,
} from "../lib/constants"
import { locationSchema } from "./reference.schemas"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const currencyCode = z.string().regex(/^[A-Z]{3}$/)

export const quoteLineSchema = z.object({
  id: z.string().min(1),
  code: z.enum(CHARGE_CODES),
  description: z.string().max(200).nullish(),
  basis: z.enum(UNIT_BASES),
  quantity: z.number().positive(),
  buyPrice: z.number().min(0),
  sellPrice: z.number().min(0),
  currency: currencyCode,
})

export const quoteOptionSchema = z.object({
  id: z.string().min(1),
  carrier: z.string().trim().min(1).max(80),
  transitDays: z.number().int().min(0).max(365).nullish(),
  lines: z.array(quoteLineSchema).min(1),
})

export const containerLineSchema = z.object({
  type: z.string(),
  count: z.number().int().min(1),
})

export const quoteCargoSchema = z.object({
  commodity: z.string().max(120).nullish(),
  containers: z.array(containerLineSchema).nullish(),
  packageCount: z.number().int().min(0).nullish(),
  grossKg: z.number().min(0).nullish(),
  cbm: z.number().min(0).nullish(),
  chargeableKg: z.number().min(0).nullish(),
})

/** What the builder edits (create and draft updates). */
const quoteInputBaseSchema = z.object({
  companyId: z.string().min(1),
  contactId: z.string().nullish(),
  dealId: z.string().nullish(),
  leadId: z.string().nullish(),
  transportMode: z.enum(TRANSPORT_MODES),
  origin: locationSchema,
  destination: locationSchema,
  incoterm: z.string().nullish(),
  currency: currencyCode,
  validUntil: isoDate,
  cargo: quoteCargoSchema,
  options: z.array(quoteOptionSchema).min(1),
  selectedOptionId: z.string().min(1),
  notes: z.string().max(2000).nullish(),
})

export const quoteInputSchema = quoteInputBaseSchema.refine(
  (input) => input.options.some((item) => item.id === input.selectedOptionId),
  { path: ["selectedOptionId"] }
)
export type QuoteInput = z.infer<typeof quoteInputSchema>

export const quoteVersionSummarySchema = z.object({
  version: z.number().int().min(1),
  status: z.enum(QUOTE_STATUSES),
  createdAt: z.string(),
  totalSell: z.number(),
  currency: currencyCode,
})
export type QuoteVersionSummary = z.infer<typeof quoteVersionSummarySchema>

export const quoteSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  status: z.enum(QUOTE_STATUSES),
  version: z.number().int().min(1),
  companyId: z.string(),
  contactId: z.string().nullish(),
  dealId: z.string().nullish(),
  leadId: z.string().nullish(),
  transportMode: z.enum(TRANSPORT_MODES),
  origin: locationSchema,
  destination: locationSchema,
  incoterm: z.string().nullish(),
  currency: currencyCode,
  validUntil: isoDate,
  cargo: quoteCargoSchema,
  options: z.array(quoteOptionSchema),
  selectedOptionId: z.string(),
  notes: z.string().nullish(),
  sentAt: z.string().nullish(),
  shipmentId: z.string().nullish(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Labels of related records. */
  refs: z.record(z.string(), recordRefSchema.nullable()).default({}),
  versions: z.array(quoteVersionSummarySchema),
  /** Older versions are read-only snapshots. */
  editable: z.boolean(),
})
export type Quote = z.infer<typeof quoteSchema>

export const QUOTE_ACTIONS = ["send", "accept", "reject"] as const
export type QuoteAction = (typeof QUOTE_ACTIONS)[number]

export const quoteStatusInputSchema = z.object({
  action: z.enum(QUOTE_ACTIONS),
  /** "Send by email" (mock): recipient and message. */
  email: z
    .object({
      to: z.email(),
      message: z.string().max(2000).optional(),
    })
    .optional(),
})
export type QuoteStatusInput = z.infer<typeof quoteStatusInputSchema>

export const quoteStatusResultSchema = z.object({
  quote: quoteSchema,
  /** Booking created when the quote was accepted. */
  shipmentId: z.string().nullish(),
})

/** Prefill of a new quote from a freight request or a deal. */
export const quoteDraftSchema = quoteInputBaseSchema.partial().extend({
  refs: z.record(z.string(), recordRefSchema.nullable()).default({}),
})
export type QuoteDraft = z.infer<typeof quoteDraftSchema>
