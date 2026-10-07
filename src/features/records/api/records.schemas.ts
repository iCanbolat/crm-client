import { z } from "zod"

import { conditionSchema, type Condition } from "@/engine/logic"
import {
  crmRecordSchema,
  fileRefSchema,
  fieldDefSchema,
  i18nTextSchema,
  objectDefSchema,
  pipelineDefSchema,
  selectOptionSchema,
  sortSchema,
  type SortDef,
} from "@/engine/metadata"
import { MAX_PAGE_SIZE, paginatedSchema } from "@/lib/api"
import { ROLES } from "@/lib/rbac"

/* ----------------------------------------------------------------------------
 * Records
 * ------------------------------------------------------------------------- */

export const recordListResponseSchema = paginatedSchema(crmRecordSchema)

/** API query of `GET /records/:objectKey`. */
export interface RecordListParams {
  page: number
  pageSize: number
  /** `field:asc|desc` */
  sort?: string
  q?: string
  filters?: Condition[]
}

export const DEFAULT_PAGE_SIZE = 20

export const LIST_LAYOUTS = ["table", "kanban"] as const
export type ListLayoutMode = (typeof LIST_LAYOUTS)[number]

export const DENSITIES = ["comfortable", "compact"] as const

/**
 * `view=all`: the user explicitly chose "all records", so the default view
 * must not be applied again.
 */
export const ALL_RECORDS_VIEW = "all"

/** Defaults are stripped from the URL to keep links clean. */
export const RECORD_LIST_DEFAULTS = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  layout: "table",
  density: "comfortable",
} as const

const stringList = z.array(z.string()).optional().catch(undefined)

/**
 * Route search of the generic list (`/o/$objectKey`). The URL is the source
 * of truth for the table state; saved views only seed it.
 */
export const recordListSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .catch(DEFAULT_PAGE_SIZE),
  sort: z
    .string()
    .regex(/^[A-Za-z0-9_]+:(asc|desc)$/)
    .optional()
    .catch(undefined),
  q: z.string().optional().catch(undefined),
  filters: z.array(conditionSchema).optional().catch(undefined),
  /** Active saved view. */
  view: z.string().optional().catch(undefined),
  /** Visible columns in order (default: the object's list layout). */
  cols: stringList,
  /** Columns pinned to the left. */
  pin: stringList,
  density: z.enum(DENSITIES).default("comfortable").catch("comfortable"),
  layout: z.enum(LIST_LAYOUTS).default("table").catch("table"),
})
export type RecordListSearch = z.infer<typeof recordListSearchSchema>

export function parseSort(sort: string | undefined): SortDef | undefined {
  const [field, direction] = sort?.split(":") ?? []
  return field && (direction === "asc" || direction === "desc")
    ? { field, direction }
    : undefined
}

export function formatSort(sort: SortDef | undefined) {
  return sort ? `${sort.field}:${sort.direction}` : undefined
}

export const recordInputSchema = z.record(z.string(), z.unknown())
export type RecordInputValues = z.infer<typeof recordInputSchema>

export const stageMoveInputSchema = z.object({
  stage: z.string().min(1),
  /** Values the stage gate asked for (e.g. lost reason). */
  values: recordInputSchema.optional(),
})
export type StageMoveInput = z.infer<typeof stageMoveInputSchema>

export const BULK_ACTIONS = ["assign", "addTag", "delete"] as const

export const bulkActionInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    ids: z.array(z.string()).min(1),
    ownerId: z.string().min(1),
  }),
  z.object({
    action: z.literal("addTag"),
    ids: z.array(z.string()).min(1),
    tag: z.string().min(1),
  }),
  z.object({
    action: z.literal("delete"),
    ids: z.array(z.string()).min(1),
  }),
])
export type BulkActionInput = z.infer<typeof bulkActionInputSchema>

export const bulkActionResultSchema = z.object({
  /** Records changed. */
  updated: z.number().int().min(0),
  /** Ids skipped because the role may not change them (agent ownership). */
  skipped: z.array(z.string()),
})
export type BulkActionResult = z.infer<typeof bulkActionResultSchema>

/* ----------------------------------------------------------------------------
 * Attachments ("Files" tab) and uploads (file fields)
 * ------------------------------------------------------------------------- */

export const attachmentSchema = fileRefSchema.extend({
  uploadedAt: z.iso.datetime(),
  uploadedBy: z.string(),
  uploadedByName: z.string().nullable(),
  /** One of the object's `fileCategories`. */
  category: z.string().nullish(),
})
export type Attachment = z.infer<typeof attachmentSchema>

export const attachmentListSchema = z.object({
  data: z.array(attachmentSchema),
})

/** 5 MB per file (mock limit). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/* ----------------------------------------------------------------------------
 * Workspace user directory (owner/user fields, assignee pickers)
 * ------------------------------------------------------------------------- */

export const directoryUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
  role: z.enum(ROLES),
})
export type DirectoryUser = z.infer<typeof directoryUserSchema>

export const userDirectorySchema = z.object({
  data: z.array(directoryUserSchema),
})

/* ----------------------------------------------------------------------------
 * Saved list views
 * ------------------------------------------------------------------------- */

export const viewStateSchema = z.object({
  columns: z.array(z.string()).optional(),
  pinned: z.array(z.string()).optional(),
  sort: sortSchema.optional(),
  filters: z.array(conditionSchema).default([]),
  q: z.string().optional(),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  density: z.enum(DENSITIES).optional(),
  layout: z.enum(LIST_LAYOUTS).optional(),
})
export type ViewState = z.infer<typeof viewStateSchema>

export const VIEW_NAME_MAX = 60

export const savedViewSchema = z.object({
  id: z.string(),
  objectKey: z.string(),
  name: z.string(),
  ownerId: z.string(),
  ownerName: z.string().nullable(),
  /** Visible to the whole team. */
  shared: z.boolean(),
  state: viewStateSchema,
  createdAt: z.iso.datetime(),
})
export type SavedView = z.infer<typeof savedViewSchema>

export const viewListResponseSchema = z.object({
  data: z.array(savedViewSchema),
  /** The signed-in user's default view of this object. */
  defaultViewId: z.string().nullable(),
})
export type ViewListResponse = z.infer<typeof viewListResponseSchema>

export const viewInputSchema = z.object({
  objectKey: z.string().min(1),
  name: z.string().trim().min(1).max(VIEW_NAME_MAX),
  shared: z.boolean().default(false),
  state: viewStateSchema,
})
export type ViewInput = z.input<typeof viewInputSchema>

export const viewPatchSchema = viewInputSchema
  .omit({ objectKey: true })
  .partial()
export type ViewPatch = z.input<typeof viewPatchSchema>

export const defaultViewInputSchema = z.object({
  objectKey: z.string().min(1),
  viewId: z.string().nullable(),
})

/* ----------------------------------------------------------------------------
 * Metadata administration (Settings → Objects, B2.7)
 * ------------------------------------------------------------------------- */

export const fieldInputSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: i18nTextSchema.refine((text) => text.tr.trim() !== "", {
    path: ["tr"],
  }),
  type: z.string().min(1),
  required: z.boolean().default(false),
  options: z.array(selectOptionSchema).optional(),
  relation: fieldDefSchema.shape.relation,
  helpText: i18nTextSchema.optional(),
  /** Also show the new field as a list column. */
  addToList: z.boolean().default(true),
})
export type FieldInput = z.input<typeof fieldInputSchema>

export const fieldPatchSchema = z.object({
  label: i18nTextSchema.optional(),
  required: z.boolean().optional(),
  options: z.array(selectOptionSchema).optional(),
  helpText: i18nTextSchema.optional(),
})
export type FieldPatch = z.infer<typeof fieldPatchSchema>

export const objectPatchSchema = z.object({
  layouts: objectDefSchema.shape.layouts.optional(),
  pipeline: pipelineDefSchema.optional(),
})
export type ObjectPatch = z.infer<typeof objectPatchSchema>

export { crmRecordSchema, objectDefSchema }
