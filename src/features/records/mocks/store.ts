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
import { emitMockEvent } from "@/mocks/events"
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
  /** Values before an update. */
  previous?: RecordValues
}

export type RecordHook = (
  values: RecordValues,
  context: RecordHookContext
) => RecordValues

const recordHooks = new Map<string, Set<RecordHook>>()

/** Several features/modules may maintain values of the same object. */
export function registerRecordHook(objectKey: string, hook: RecordHook) {
  const hooks = recordHooks.get(objectKey) ?? new Set<RecordHook>()
  hooks.add(hook)
  recordHooks.set(objectKey, hooks)
}

export function applyRecordHook(
  objectKey: string,
  values: RecordValues,
  context: RecordHookContext
) {
  let result = values
  for (const hook of recordHooks.get(objectKey) ?? []) {
    result = hook(result, context)
  }
  return result
}

/* ----------------------------------------------------------------------------
 * Change listeners: side effects of saved records and uploaded files
 * (e.g. WhatsApp notifications, Faz 6). Run after the change is stored.
 * ------------------------------------------------------------------------- */

export interface RecordSavedEvent {
  workspaceId: string
  objectKey: string
  row: RecordRow
  /** Values before an update; `null` for a new record. */
  previous: RecordValues | null
  /** User whose request saved the record; `null` = system / public form. */
  actorId?: string | null
}

export interface AttachmentAddedEvent {
  workspaceId: string
  objectKey: string
  recordId: string
  attachmentId: string
  category: string | null
}

const savedListeners = new Set<(event: RecordSavedEvent) => void>()
const attachmentListeners = new Set<(event: AttachmentAddedEvent) => void>()

export function onRecordSaved(listener: (event: RecordSavedEvent) => void) {
  savedListeners.add(listener)
}

export function notifyRecordSaved(event: RecordSavedEvent) {
  for (const listener of savedListeners) listener(event)
  emitRecordEvents(event)
}

/** Domain events of a saved record (notifications, automation; Faz 7). */
function emitRecordEvents({
  workspaceId,
  objectKey,
  row,
  previous,
  actorId = null,
}: RecordSavedEvent) {
  const base = { workspaceId, objectKey, recordId: row.id, actorId }
  if (!previous) {
    emitMockEvent({ ...base, type: "record.created" })
    return
  }
  const ownerId = row.values.ownerId
  if (typeof ownerId === "string" && ownerId && ownerId !== previous.ownerId) {
    emitMockEvent({
      ...base,
      type: "record.assigned",
      data: { ownerId, previousOwnerId: String(previous.ownerId ?? "") },
    })
  }
  const stageField = getObjectDef(workspaceId, objectKey)?.pipeline?.field
  if (stageField && row.values[stageField] !== previous[stageField]) {
    emitMockEvent({
      ...base,
      type: "record.stageChanged",
      data: {
        stage: String(row.values[stageField] ?? ""),
        previousStage: String(previous[stageField] ?? ""),
      },
    })
  }
}

export function onAttachmentAdded(
  listener: (event: AttachmentAddedEvent) => void
) {
  attachmentListeners.add(listener)
}

export function notifyAttachmentAdded(event: AttachmentAddedEvent) {
  for (const listener of attachmentListeners) listener(event)
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
  {
    ownerId,
    t,
    actorId = null,
  }: { ownerId: string; t: RequestT; actorId?: string | null }
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
  notifyRecordSaved({
    workspaceId,
    objectKey: def.key,
    row,
    previous: null,
    actorId,
  })
  return { ok: true, row }
}
