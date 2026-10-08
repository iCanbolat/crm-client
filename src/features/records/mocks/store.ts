import { z } from "zod"

import {
  conditionSchema,
  getMissingGateFields,
  type Condition,
} from "@/engine/logic"
import {
  getField,
  getRecordTitle,
  type CrmRecord,
  type ObjectDef,
  type RecordRef,
  type RecordValues,
} from "@/engine/metadata"
import { stripInactiveModules } from "@/engine/modules"
import { clearHiddenFields, metadataToZod } from "@/engine/records"
import { MAX_PAGE_SIZE, type FieldErrors } from "@/lib/api"
import i18n from "@/lib/i18n"
import { db } from "@/mocks/db"
import type { getRequestT } from "@/mocks/utils/http"

import { DEFAULT_PAGE_SIZE, parseSort } from "../api/records.schemas"
import { newRecordId, objectRowId, type RecordRow } from "./factory"

type RequestT = ReturnType<typeof getRequestT>

/** Metadata contributed by modules the workspace no longer uses is hidden. */
function visibleDefs(workspaceId: string, defs: ObjectDef[]) {
  const modules = db.workspaces.findById(workspaceId)?.modules ?? []
  return stripInactiveModules(defs, (moduleId) => modules.includes(moduleId))
}

export function getObjectDef(workspaceId: string, objectKey: string) {
  const def = db.objects.findById(objectRowId(workspaceId, objectKey))?.def
  return def ? visibleDefs(workspaceId, [def])[0] : undefined
}

export function saveObjectDef(workspaceId: string, def: ObjectDef) {
  return db.objects.update(objectRowId(workspaceId, def.key), { def })?.def
}

export function listObjectDefs(workspaceId: string) {
  return visibleDefs(
    workspaceId,
    db.objects
      .findMany((row) => row.workspaceId === workspaceId)
      .map((row) => row.def)
  )
}

/* ----------------------------------------------------------------------------
 * Record hooks: server-maintained values of module objects (numbering,
 * derived flags). Registered by module mocks, run on every create/update.
 * ------------------------------------------------------------------------- */

export interface RecordHookContext {
  workspaceId: string
  isNew: boolean
}

export type RecordHook = (
  values: RecordValues,
  context: RecordHookContext
) => RecordValues

const recordHooks = new Map<string, RecordHook>()

export function registerRecordHook(objectKey: string, hook: RecordHook) {
  recordHooks.set(objectKey, hook)
}

export function applyRecordHook(
  objectKey: string,
  values: RecordValues,
  context: RecordHookContext
) {
  return recordHooks.get(objectKey)?.(values, context) ?? values
}

export function findRecordRow(
  workspaceId: string,
  objectKey: string,
  id: string
) {
  const row = db.records.findById(id)
  return row && row.workspaceId === workspaceId && row.objectKey === objectKey
    ? row
    : undefined
}

export function recordsOf(workspaceId: string, objectKey: string) {
  return db.records.findMany(
    (row) => row.workspaceId === workspaceId && row.objectKey === objectKey
  )
}

/** Label of a related record (its primary/display field). */
export function getRecordRef(
  workspaceId: string,
  objectKey: string,
  id: string
): RecordRef | null {
  const row = findRecordRow(workspaceId, objectKey, id)
  const def = getObjectDef(workspaceId, objectKey)
  if (!row || !def) return null
  return {
    id,
    objectKey,
    label: getRecordTitle(def, { id, values: row.values, refs: {} }),
  }
}

/** Joins labels of relation and user values. */
export function toCrmRecord(def: ObjectDef, row: RecordRow): CrmRecord {
  const refs: CrmRecord["refs"] = {}
  for (const field of def.fields) {
    const value = row.values[field.key]
    if (typeof value !== "string" || !value) continue
    if (field.type === "user") {
      const user = db.users.findById(value)
      refs[field.key] = user ? { id: value, label: user.name } : null
    } else if (field.type === "relation" && field.relation) {
      refs[field.key] = getRecordRef(
        row.workspaceId,
        field.relation.objectKey,
        value
      )
    }
  }
  return { id: row.id, values: row.values, refs }
}

export interface ParsedRecordQuery {
  page: number
  pageSize: number
  q?: string
  filters: Condition[]
  sort?: ReturnType<typeof parseSort>
}

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function parseFilters(raw: string | null): Condition[] {
  if (!raw) return []
  try {
    const parsed = z.array(conditionSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export function parseRecordQuery(url: URL): ParsedRecordQuery {
  const { searchParams } = url
  return {
    page: toPositiveInt(searchParams.get("page"), 1),
    pageSize: Math.min(
      toPositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    ),
    q: searchParams.get("q")?.trim() || undefined,
    filters: parseFilters(searchParams.get("filters")),
    sort: parseSort(searchParams.get("sort") ?? undefined),
  }
}

type ValidationResult =
  { ok: true; values: RecordValues } | { ok: false; fieldErrors: FieldErrors }

/**
 * Same metadata driven schema as the client form (`metadataToZod`), plus the
 * server-only checks: relation targets and owners must exist in the tenant.
 */
export function validateRecordInput(
  def: ObjectDef,
  workspaceId: string,
  input: unknown,
  t: RequestT,
  {
    partial = false,
    current,
  }: { partial?: boolean; current?: RecordValues } = {}
): ValidationResult {
  const parsed = metadataToZod(def, { partial, current }).safeParse(input ?? {})
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: z.flattenError(parsed.error).fieldErrors as FieldErrors,
    }
  }

  // Hidden conditional fields are never stored (e.g. containers after the
  // mode changed from FCL to air).
  const merged = clearHiddenFields(def, {
    ...current,
    ...(parsed.data as RecordValues),
  })
  const values = Object.fromEntries(
    Object.entries(merged).filter(
      ([key, value]) =>
        key in (parsed.data as RecordValues) ||
        (current && value !== current[key])
    )
  ) as RecordValues
  const fieldErrors: FieldErrors = {}
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "string" || !value) continue
    const field = getField(def, key)
    if (field?.type === "relation" && field.relation) {
      if (!findRecordRow(workspaceId, field.relation.objectKey, value)) {
        fieldErrors[key] = [t("mock.invalidRelation")]
      }
    }
    if (field?.type === "user") {
      const member = db.memberships.findFirst(
        (item) => item.workspaceId === workspaceId && item.userId === value
      )
      if (!member) fieldErrors[key] = [t("mock.invalidUser")]
    }
  }

  return Object.keys(fieldErrors).length
    ? { ok: false, fieldErrors }
    : { ok: true, values }
}

/** Stage gate errors keyed by the missing field (422 `STAGE_GATE`). */
export function stageGateErrors(
  def: ObjectDef,
  stage: string,
  values: RecordValues
): FieldErrors | null {
  const missing = getMissingGateFields(def, stage, values)
  if (missing.length === 0) return null
  const message = i18n.t("engine:validation.required")
  return Object.fromEntries(missing.map((field) => [field.key, [message]]))
}

export type CreateRecordResult =
  | { ok: true; row: RecordRow }
  | {
      ok: false
      code: "VALIDATION_ERROR" | "STAGE_GATE"
      fieldErrors: FieldErrors
    }

/**
 * Creates a record exactly like `POST /records/:objectKey` (also used by
 * form submissions, B5.5): server defaults (owner, first pipeline stage),
 * validation, stage gate and the module record hooks.
 */
export function createRecord(
  workspaceId: string,
  def: ObjectDef,
  body: RecordValues,
  { ownerId, t }: { ownerId: string; t: RequestT }
): CreateRecordResult {
  const input: RecordValues = {
    ownerId,
    ...(def.pipeline
      ? { [def.pipeline.field]: def.pipeline.stages[0]!.key }
      : {}),
    ...Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined)
    ),
  }
  const result = validateRecordInput(def, workspaceId, input, t)
  if (!result.ok) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: result.fieldErrors,
    }
  }

  if (def.pipeline) {
    const stage = String(result.values[def.pipeline.field])
    const gate = stageGateErrors(def, stage, result.values)
    if (gate) return { ok: false, code: "STAGE_GATE", fieldErrors: gate }
  }

  const now = new Date().toISOString()
  const row = db.records.create({
    id: newRecordId(def.key),
    workspaceId,
    objectKey: def.key,
    values: applyRecordHook(
      def.key,
      { ...result.values, createdAt: now, updatedAt: now },
      { workspaceId, isNew: true }
    ),
  })
  return { ok: true, row }
}
