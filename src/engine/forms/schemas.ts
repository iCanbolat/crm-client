import type { LucideIcon } from "lucide-react"
import { z } from "zod"

import type { I18nText } from "@/lib/i18n-text"
import { supportedLanguages } from "@/lib/i18n"

import { conditionSchema } from "../logic/conditions"
import {
  FIELD_KEY_PATTERN,
  i18nTextSchema,
  selectOptionSchema,
} from "../metadata/schemas"

/**
 * Form definition contract (plan B4.1). A form's content is a versioned JSON
 * document: the builder edits a draft of it, publishing freezes a copy
 * (B4.7), and the builder preview as well as the public renderer (Faz 5)
 * render it with the same core (`features/form-renderer`).
 *
 * Rules and mapping reference fields by `id` (stable while the answer `key`
 * may be renamed); submitted answers are keyed by `key`.
 */

export const FORM_SCHEMA_VERSION = 2

/** Answer fields of the builder palette. */
export const FORM_INPUT_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "select",
  "radio",
  "checkboxes",
  "date",
  "file",
  "consent",
  "hidden",
] as const

/** Content-only blocks: no answer. */
export const FORM_LAYOUT_TYPES = ["heading", "paragraph", "divider"] as const

/** Everything the palette offers; module blocks may add engine field types. */
export const FORM_PALETTE_TYPES = [
  ...FORM_INPUT_TYPES,
  ...FORM_LAYOUT_TYPES,
] as const
export type FormPaletteType = (typeof FORM_PALETTE_TYPES)[number]
export type FormLayoutType = (typeof FORM_LAYOUT_TYPES)[number]

export const FORM_FIELD_WIDTHS = ["full", "half"] as const
export type FormFieldWidth = (typeof FORM_FIELD_WIDTHS)[number]

/** Where a hidden field takes its value from (UTM, referrer, …). */
export const PREFILL_KINDS = ["static", "query", "referrer"] as const
export type PrefillKind = (typeof PREFILL_KINDS)[number]

export const formPrefillSchema = z.object({
  kind: z.enum(PREFILL_KINDS),
  /** Query parameter name (`utm_source`, …) for `query`. */
  param: z.string().optional(),
  /** Fixed value for `static`. */
  value: z.string().optional(),
})

const languageSchema = z.enum(supportedLanguages)

export const formValidationSchema = z.object({
  /** Text: minimum length · number: minimum value. */
  min: z.number().optional(),
  /** Text: maximum length · number: maximum value. */
  max: z.number().optional(),
  pattern: z.string().optional(),
})

export const formFieldSchema = z.object({
  id: z.string().min(1),
  /** Answer key of the submission (`companyName`, `utmSource`, …). */
  key: z.string().regex(FIELD_KEY_PATTERN),
  /** Palette type or an engine field type contributed by a module block. */
  type: z.string().min(1),
  stepId: z.string().min(1),
  label: i18nTextSchema,
  placeholder: i18nTextSchema.optional(),
  helpText: i18nTextSchema.optional(),
  required: z.boolean().optional(),
  validation: formValidationSchema.optional(),
  defaultValue: z.unknown().optional(),
  width: z.enum(FORM_FIELD_WIDTHS),
  options: z.array(selectOptionSchema).optional(),
  /** Paragraph text, consent details. */
  content: i18nTextSchema.optional(),
  /** Consent: link to the privacy notice (KVKK aydınlatma metni). */
  consentUrl: z.string().optional(),
  /** Hidden fields: where the value comes from. */
  prefill: formPrefillSchema.optional(),
  /** Module block the field was added with (`forwarding.route`). */
  blockId: z.string().optional(),
})

export const formStepSchema = z.object({
  id: z.string().min(1),
  title: i18nTextSchema,
})

export const LOGIC_ACTIONS = ["show", "hide", "require"] as const
export type LogicAction = (typeof LOGIC_ACTIONS)[number]

export const LOGIC_TARGET_KINDS = ["field", "step"] as const

export const logicTargetSchema = z.object({
  kind: z.enum(LOGIC_TARGET_KINDS),
  id: z.string().min(1),
})

/**
 * `if <field> <op> <value> [and|or …] then show|hide|require <field|step>`.
 * Condition `field` is a form field id.
 */
export const formLogicRuleSchema = z.object({
  id: z.string().min(1),
  match: z.enum(["all", "any"]),
  conditions: z.array(conditionSchema).min(1),
  action: z.enum(LOGIC_ACTIONS),
  targets: z.array(logicTargetSchema).min(1),
})

export const DUPLICATE_STRATEGIES = ["create", "linkContactByEmail"] as const
export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number]

/** Where a submission lands in the CRM (B4.5, applied in Faz 5). */
export const formMappingSchema = z.object({
  objectKey: z.string().min(1),
  /** Form field id → target object field key. */
  fields: z.record(z.string(), z.string()),
  duplicate: z.enum(DUPLICATE_STRATEGIES),
  /** Owner of created records; `null` → the form's creator. */
  ownerId: z.string().nullable(),
})

export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const hexColor = z.string().regex(HEX_COLOR_PATTERN)

export const FORM_FONTS = ["default", "system", "serif", "mono"] as const
export type FormFont = (typeof FORM_FONTS)[number]

export const FORM_RADII = ["none", "sm", "md", "lg", "full"] as const
export type FormRadius = (typeof FORM_RADII)[number]

export const formThemeSchema = z.object({
  /** Data URL (mock upload, like the workspace logo). */
  logoUrl: z.string().nullable(),
  primaryColor: hexColor,
  backgroundColor: hexColor,
  textColor: hexColor,
  font: z.enum(FORM_FONTS),
  radius: z.enum(FORM_RADII),
})

export const formSettingsSchema = z.object({
  /** Languages the form is offered in; the first is not special. */
  languages: z.array(languageSchema).min(1),
  defaultLanguage: languageSchema,
  submitLabel: i18nTextSchema,
  successMessage: i18nTextSchema,
  /** Sent here instead of the success message (https). */
  redirectUrl: z.string().nullable(),
  /** E-mail addresses notified of each submission. */
  notifyEmails: z.array(z.string()),
  honeypot: z.boolean(),
  /** The form closes after this many submissions. */
  maxSubmissions: z.number().int().positive().nullable(),
  showProgress: z.boolean(),
})

export const formContentSchema = z.object({
  schemaVersion: z.literal(FORM_SCHEMA_VERSION),
  steps: z.array(formStepSchema).min(1),
  fields: z.array(formFieldSchema),
  logic: z.array(formLogicRuleSchema),
  mapping: formMappingSchema,
  settings: formSettingsSchema,
  theme: formThemeSchema,
})

export type FormField = z.infer<typeof formFieldSchema>
export type FormStep = z.infer<typeof formStepSchema>
export type FormLogicRule = z.infer<typeof formLogicRuleSchema>
export type LogicTarget = z.infer<typeof logicTargetSchema>
export type FormMapping = z.infer<typeof formMappingSchema>
export type FormTheme = z.infer<typeof formThemeSchema>
export type FormSettings = z.infer<typeof formSettingsSchema>
export type FormContent = z.infer<typeof formContentSchema>
export type FormPrefill = z.infer<typeof formPrefillSchema>
export type FormValidation = z.infer<typeof formValidationSchema>

/** Submitted answers, keyed by field `key`. */
export type FormAnswers = Record<string, unknown>

/** One field of a module block; `mapTo` is its default CRM target. */
export type FormBlockField = Omit<
  FormField,
  "id" | "stepId" | "blockId" | "width"
> & {
  width?: FormFieldWidth
  mapTo?: string
}

/** Sector block offered by the builder palette (`ModuleManifest.formBlocks`). */
export interface FormBlockDef {
  id: string
  label: I18nText
  description: I18nText
  icon: LucideIcon
  fields: FormBlockField[]
}
