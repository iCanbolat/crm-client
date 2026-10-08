import { z } from "zod"

import { i18nTextSchema } from "../metadata/schemas"

/** Languages every message template is submitted in. */
export const TEMPLATE_LANGUAGES = ["tr", "en"] as const
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number]

/**
 * Review status of a template on the tenant's WhatsApp Business Account.
 * Meta's PAUSED/DISABLED follow quality issues; `disabled` is also used for
 * versions a module no longer ships.
 */
export const TEMPLATE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "paused",
  "disabled",
] as const
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number]

/**
 * Where the value of a `{{n}}` placeholder comes from:
 * - `field`: a field of the record the message is about (formatted)
 * - `recipient`: the person receiving it (`name` or `firstName`)
 * - `workspace`: the sender company (`name`)
 * - `event`: data of the event that triggered the message (e.g. document type)
 */
export const templateVariableSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("field"), field: z.string().min(1) }),
  z.object({
    kind: z.literal("recipient"),
    field: z.enum(["name", "firstName"]),
  }),
  z.object({ kind: z.literal("workspace"), field: z.literal("name") }),
  z.object({ kind: z.literal("event"), field: z.string().min(1) }),
])
export type TemplateVariableSource = z.infer<
  typeof templateVariableSourceSchema
>

export const templateVariableSchema = z.object({
  source: templateVariableSourceSchema,
  /** Sample value Meta reviews the template with. */
  example: i18nTextSchema,
})
export type TemplateVariable = z.infer<typeof templateVariableSchema>

export const templateContentSchema = z.object({
  /** Plain text header (no variables). */
  header: z.string().optional(),
  body: z.string(),
  footer: z.string().optional(),
})
export type TemplateContent = z.infer<typeof templateContentSchema>

/**
 * A utility template a sector module ships (Faz 6). Read-only for tenants:
 * the platform submits it to their WABA and keeps it in sync.
 * `variables[i]` fills `{{i + 1}}` in every language.
 */
export interface MessageTemplateDef {
  id: string
  /** Meta template name: lowercase, digits and `_`, versioned (`_v1`). */
  name: string
  category: "utility"
  /** Object the message is about (its record fills the variables). */
  objectKey: string
  label: z.infer<typeof i18nTextSchema>
  content: Record<TemplateLanguage, TemplateContent>
  variables: TemplateVariable[]
}

/** Something that happened to a record, e.g. a shipment milestone. */
export interface MessageEvent {
  type: string
  objectKey: string
  recordId: string
  /** Extra data matched by triggers and read by `event` variables. */
  data?: Record<string, string>
}

/** Sends a template when an event happens (tenant switches it on). */
export interface MessageTriggerDef {
  id: string
  event: string
  /** Every entry must equal the event's `data` value. */
  match?: Record<string, string>
  templateId: string
  label: z.infer<typeof i18nTextSchema>
}

export const MESSAGE_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]
