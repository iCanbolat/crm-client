import { z } from "zod"

import { conditionSchema } from "../logic/conditions"

/**
 * Metadata contract of the CRM engine (plan §4.4). The API is the source of
 * truth (`/api/meta/objects`): tenants add custom fields, reorder layouts and
 * edit pipelines, so nothing here is hard-coded per object.
 */

export const i18nTextSchema = z.object({ tr: z.string(), en: z.string() })

/** Built-in field types; sector modules register their own (`port`, …). */
export const CORE_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "currency",
  "percent",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
  "email",
  "phone",
  "url",
  "country",
  "user",
  "relation",
  "file",
] as const
export type CoreFieldType = (typeof CORE_FIELD_TYPES)[number]
export type FieldType = CoreFieldType | (string & {})

/** Badge colors a select option may use (mapped to tokens by the UI). */
export const OPTION_COLORS = [
  "gray",
  "blue",
  "green",
  "amber",
  "red",
  "violet",
  "teal",
] as const
export type OptionColor = (typeof OPTION_COLORS)[number]

export const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: i18nTextSchema,
  color: z.enum(OPTION_COLORS).optional(),
})

export const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/

export const fieldDefSchema = z.object({
  key: z.string().regex(FIELD_KEY_PATTERN),
  label: i18nTextSchema,
  type: z.string().min(1),
  required: z.boolean().optional(),
  options: z.array(selectOptionSchema).optional(),
  relation: z
    .object({ objectKey: z.string(), displayField: z.string() })
    .optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  helpText: i18nTextSchema.optional(),
  /** Shipped with the object: may be customized but never deleted. */
  system: z.boolean().optional(),
  /** Added by the tenant (Settings → Objects). */
  custom: z.boolean().optional(),
  /** Maintained by the server (timestamps, …): never part of a form. */
  readOnly: z.boolean().optional(),
  /** Sector module that contributed the field. */
  moduleId: z.string().optional(),
  /**
   * Shown (and validated) only while every condition holds for the record's
   * values, e.g. containers for FCL only. Hidden values are not submitted.
   */
  visibleWhen: z.array(conditionSchema).optional(),
})

export const STAGE_KINDS = ["open", "won", "lost"] as const

export const stageDefSchema = z.object({
  key: z.string().min(1),
  label: i18nTextSchema,
  kind: z.enum(STAGE_KINDS),
  color: z.enum(OPTION_COLORS).optional(),
  /** Stage gate: fields that must be filled before entering the stage. */
  requiredFields: z.array(z.string()).optional(),
})

export const pipelineDefSchema = z.object({
  /** Select field that stores the stage key. */
  field: z.string(),
  stages: z.array(stageDefSchema).min(1),
  /** Currency field summed per column on the board. */
  amountField: z.string().optional(),
})

export const sortSchema = z.object({
  field: z.string(),
  direction: z.enum(["asc", "desc"]),
})

export const listLayoutSchema = z.object({
  columns: z.array(z.string()),
  defaultSort: sortSchema.optional(),
})

export const detailSectionSchema = z.object({
  key: z.string(),
  label: i18nTextSchema,
  fields: z.array(z.string()),
})

export const relatedListSchema = z.object({
  objectKey: z.string(),
  /** Relation field on the related object that points back here. */
  field: z.string(),
})

export const detailLayoutSchema = z.object({
  /** Fields summarized in the record header. */
  highlights: z.array(z.string()),
  sections: z.array(detailSectionSchema),
  related: z.array(relatedListSchema),
})

export const objectDefSchema = z.object({
  key: z.string().min(1),
  label: i18nTextSchema,
  pluralLabel: i18nTextSchema,
  /** Icon name, resolved by `getObjectIcon`. */
  icon: z.string(),
  primaryField: z.string(),
  fields: z.array(fieldDefSchema),
  pipeline: pipelineDefSchema.optional(),
  layouts: z.object({ list: listLayoutSchema, detail: detailLayoutSchema }),
  /** Text fields matched by the list search (`q`); primary field if empty. */
  searchFields: z.array(z.string()).optional(),
  moduleId: z.string().optional(),
  /**
   * Dedicated create screen (e.g. the quote builder) used instead of the
   * generic record form. Route path with `$`-params, like nav items.
   */
  createPath: z.string().optional(),
  /** Document types offered when attaching files (e.g. B/L, AWB, CMR). */
  fileCategories: z.array(selectOptionSchema).optional(),
})

export const objectListResponseSchema = z.object({
  data: z.array(objectDefSchema),
})

export type I18nTextValue = z.infer<typeof i18nTextSchema>
export type SelectOption = z.infer<typeof selectOptionSchema>
export type FieldDef = z.infer<typeof fieldDefSchema>
export type StageKind = (typeof STAGE_KINDS)[number]
export type StageDef = z.infer<typeof stageDefSchema>
export type PipelineDef = z.infer<typeof pipelineDefSchema>
export type SortDef = z.infer<typeof sortSchema>
export type ListLayout = z.infer<typeof listLayoutSchema>
export type DetailSection = z.infer<typeof detailSectionSchema>
export type RelatedList = z.infer<typeof relatedListSchema>
export type DetailLayout = z.infer<typeof detailLayoutSchema>
export type ObjectDef = z.infer<typeof objectDefSchema>

/* ----------------------------------------------------------------------------
 * Records
 * ------------------------------------------------------------------------- */

/** Display data of a referenced record or user (joined by the API). */
export const recordRefSchema = z.object({
  id: z.string(),
  label: z.string(),
  objectKey: z.string().optional(),
})
export type RecordRef = z.infer<typeof recordRefSchema>

/** Uploaded file metadata (file fields and record attachments). */
export const fileRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().int().min(0),
  mimeType: z.string(),
})
export type FileRef = z.infer<typeof fileRefSchema>

/**
 * Generic record: every value — system fields such as `ownerId`,
 * `createdAt` included — lives in `values`, keyed by field key.
 * `refs` carries labels of relation/user values, keyed by field key.
 */
export const crmRecordSchema = z.object({
  id: z.string(),
  values: z.record(z.string(), z.unknown()),
  refs: z.record(z.string(), recordRefSchema.nullable()).default({}),
})
export type CrmRecord = z.infer<typeof crmRecordSchema>
export type RecordValues = CrmRecord["values"]

/** System fields every object carries. */
export const SYSTEM_FIELDS = {
  owner: "ownerId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  tags: "tags",
} as const
