import { http, HttpResponse } from "msw"
import { z } from "zod"

import { hasFieldType } from "@/engine/field-types"
import {
  getField,
  getStageField,
  type FieldDef,
  type ObjectDef,
  type RecordValues,
} from "@/engine/metadata"
import { queryRecordValues } from "@/engine/records"
import type { FieldErrors } from "@/lib/api"
import { can } from "@/lib/rbac"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"
import { paginate } from "@/mocks/utils/list"

import {
  bulkActionInputSchema,
  defaultViewInputSchema,
  fieldInputSchema,
  fieldPatchSchema,
  MAX_UPLOAD_BYTES,
  objectPatchSchema,
  stageMoveInputSchema,
  viewInputSchema,
  viewPatchSchema,
  type Attachment,
  type DirectoryUser,
  type SavedView,
} from "../api/records.schemas"
import { newRecordId, type AttachmentRow, type ViewRow } from "./factory"
import {
  applyRecordHook,
  findRecordRow,
  getObjectDef,
  listObjectDefs,
  parseRecordQuery,
  recordsOf,
  saveObjectDef,
  stageGateErrors,
  toCrmRecord,
  validateRecordInput,
} from "./store"

type RequestT = ReturnType<typeof getRequestT>

function validationError(
  t: RequestT,
  fieldErrors: FieldErrors,
  code = "VALIDATION_ERROR"
) {
  return apiError(422, code, t("validation"), { fieldErrors })
}

function zodError(t: RequestT, error: z.ZodError) {
  return validationError(t, z.flattenError(error).fieldErrors as FieldErrors)
}

const notFound = (t: RequestT) => apiError(404, "NOT_FOUND", t("mock.notFound"))

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

/* ----------------------------------------------------------------------------
 * Metadata administration helpers
 * ------------------------------------------------------------------------- */

const CUSTOM_SECTION_KEY = "custom"

/** Layout must only reference fields of the object. */
function invalidLayoutFields(def: ObjectDef) {
  const keys = new Set(def.fields.map((field) => field.key))
  const { list, detail } = def.layouts
  return [
    ...list.columns,
    ...detail.highlights,
    ...detail.sections.flatMap((section) => section.fields),
  ].filter((key) => !keys.has(key))
}

/** Pipeline stages mirror the options of the stage select field. */
function syncStageOptions(def: ObjectDef): ObjectDef {
  if (!def.pipeline) return def
  const stages = def.pipeline.stages
  return {
    ...def,
    fields: def.fields.map((field) =>
      field.key === def.pipeline!.field
        ? {
            ...field,
            options: stages.map((stage) => ({
              value: stage.key,
              label: stage.label,
              ...(stage.color ? { color: stage.color } : {}),
            })),
          }
        : field
    ),
  }
}

function withoutField(def: ObjectDef, key: string): ObjectDef {
  const drop = (keys: string[]) => keys.filter((item) => item !== key)
  return {
    ...def,
    fields: def.fields.filter((field) => field.key !== key),
    pipeline: def.pipeline
      ? {
          ...def.pipeline,
          stages: def.pipeline.stages.map((stage) => ({
            ...stage,
            ...(stage.requiredFields
              ? { requiredFields: drop(stage.requiredFields) }
              : {}),
          })),
        }
      : undefined,
    layouts: {
      list: {
        ...def.layouts.list,
        columns: drop(def.layouts.list.columns),
        defaultSort:
          def.layouts.list.defaultSort?.field === key
            ? undefined
            : def.layouts.list.defaultSort,
      },
      detail: {
        ...def.layouts.detail,
        highlights: drop(def.layouts.detail.highlights),
        sections: def.layouts.detail.sections.map((section) => ({
          ...section,
          fields: drop(section.fields),
        })),
      },
    },
  }
}

function withNewField(
  def: ObjectDef,
  field: FieldDef,
  addToList: boolean
): ObjectDef {
  // New fields go before the system block (owner, tags, timestamps).
  const ownerIndex = def.fields.findIndex((item) => item.key === "ownerId")
  const fields = [...def.fields]
  fields.splice(ownerIndex < 0 ? fields.length : ownerIndex, 0, field)

  const sections = [...def.layouts.detail.sections]
  const custom = sections.find((section) => section.key === CUSTOM_SECTION_KEY)
  if (custom) {
    custom.fields = [...custom.fields, field.key]
  } else {
    sections.push({
      key: CUSTOM_SECTION_KEY,
      label: { tr: "Özel alanlar", en: "Custom fields" },
      fields: [field.key],
    })
  }

  return {
    ...def,
    fields,
    layouts: {
      list: {
        ...def.layouts.list,
        columns: addToList
          ? [...def.layouts.list.columns, field.key]
          : def.layouts.list.columns,
      },
      detail: { ...def.layouts.detail, sections },
    },
  }
}

/* ----------------------------------------------------------------------------
 * Handlers
 * ------------------------------------------------------------------------- */

const metadataHandlers = [
  http.get(
    apiPath("/meta/objects"),
    // App configuration: like the workspace, only latency applies.
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        return HttpResponse.json({
          data: listObjectDefs(auth.context.workspace.id),
        })
      },
      { critical: true }
    )
  ),

  http.get(
    apiPath("/meta/objects/:objectKey"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const def = getObjectDef(
        auth.context.workspace.id,
        String(params.objectKey)
      )
      return def ? HttpResponse.json(def) : notFound(getRequestT(request))
    })
  ),

  http.patch(
    apiPath("/meta/objects/:objectKey"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "workspace")
      if (denied) return denied

      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const def = getObjectDef(workspaceId, String(params.objectKey))
      if (!def) return notFound(t)

      const parsed = objectPatchSchema.safeParse(await readJson(request))
      if (!parsed.success) return zodError(t, parsed.error)
      const { layouts, pipeline } = parsed.data

      let next: ObjectDef = { ...def, ...(layouts ? { layouts } : {}) }

      if (pipeline) {
        if (!def.pipeline || pipeline.field !== def.pipeline.field) {
          return validationError(t, { pipeline: [t("validation")] })
        }
        const keys = pipeline.stages.map((stage) => stage.key)
        if (new Set(keys).size !== keys.length) {
          return validationError(t, { pipeline: [t("mock.duplicateStage")] })
        }
        const removed = def.pipeline.stages
          .map((stage) => stage.key)
          .filter((key) => !keys.includes(key))
        const inUse = removed.filter((key) =>
          recordsOf(workspaceId, def.key).some(
            (row) => row.values[def.pipeline!.field] === key
          )
        )
        if (inUse.length) {
          return apiError(409, "STAGE_IN_USE", t("mock.stageInUse"), {
            details: { stages: inUse },
          })
        }
        next = syncStageOptions({ ...next, pipeline })
      }

      if (invalidLayoutFields(next).length) {
        return validationError(t, { layouts: [t("mock.invalidLayout")] })
      }

      return HttpResponse.json(saveObjectDef(workspaceId, next))
    })
  ),

  http.post(
    apiPath("/meta/objects/:objectKey/fields"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "workspace")
      if (denied) return denied

      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const def = getObjectDef(workspaceId, String(params.objectKey))
      if (!def) return notFound(t)

      const parsed = fieldInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return zodError(t, parsed.error)
      const { addToList, ...input } = parsed.data

      if (getField(def, input.key)) {
        return validationError(t, { key: [t("mock.fieldKeyTaken")] })
      }
      if (!hasFieldType(input.type)) {
        return validationError(t, { type: [t("mock.unknownFieldType")] })
      }
      if (
        (input.type === "select" || input.type === "multiselect") &&
        !input.options?.length
      ) {
        return validationError(t, { options: [t("mock.optionsRequired")] })
      }
      if (
        input.type === "relation" &&
        (!input.relation ||
          !getObjectDef(workspaceId, input.relation.objectKey))
      ) {
        return validationError(t, {
          relation: [t("mock.relationTargetMissing")],
        })
      }

      const field: FieldDef = {
        key: input.key,
        label: { tr: input.label.tr, en: input.label.en || input.label.tr },
        type: input.type,
        custom: true,
        ...(input.required ? { required: true } : {}),
        ...(input.options ? { options: input.options } : {}),
        ...(input.relation ? { relation: input.relation } : {}),
        ...(input.helpText ? { helpText: input.helpText } : {}),
      }
      const next = withNewField(def, field, addToList)
      return HttpResponse.json(saveObjectDef(workspaceId, next), {
        status: 201,
      })
    })
  ),

  http.patch(
    apiPath("/meta/objects/:objectKey/fields/:fieldKey"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "workspace")
      if (denied) return denied

      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const def = getObjectDef(workspaceId, String(params.objectKey))
      const field = def && getField(def, String(params.fieldKey))
      if (!def || !field) return notFound(t)

      const parsed = fieldPatchSchema.safeParse(await readJson(request))
      if (!parsed.success) return zodError(t, parsed.error)
      const patch = parsed.data

      if (patch.options && getStageField(def)?.key === field.key) {
        // Stages are edited through the pipeline (keeps both in sync).
        return validationError(t, { options: [t("mock.stageOptions")] })
      }
      if (patch.options && !patch.options.length) {
        return validationError(t, { options: [t("mock.optionsRequired")] })
      }
      if (field.readOnly && patch.required) {
        return validationError(t, { required: [t("validation")] })
      }

      const next: ObjectDef = {
        ...def,
        fields: def.fields.map((item) =>
          item.key === field.key ? { ...item, ...patch } : item
        ),
      }
      return HttpResponse.json(saveObjectDef(workspaceId, next))
    })
  ),

  http.delete(
    apiPath("/meta/objects/:objectKey/fields/:fieldKey"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "workspace")
      if (denied) return denied

      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const def = getObjectDef(workspaceId, String(params.objectKey))
      const field = def && getField(def, String(params.fieldKey))
      if (!def || !field) return notFound(t)

      if (field.system || field.moduleId || def.primaryField === field.key) {
        return apiError(409, "SYSTEM_FIELD", t("mock.systemField"))
      }

      for (const row of recordsOf(workspaceId, def.key)) {
        if (!(field.key in row.values)) continue
        const { [field.key]: _removed, ...values } = row.values
        db.records.update(row.id, { values })
      }
      return HttpResponse.json(
        saveObjectDef(workspaceId, withoutField(def, field.key))
      )
    })
  ),
]

function resolveObject(request: Request, objectKey: string) {
  const auth = authenticate(request)
  if (!auth.ok) return { response: auth.response } as const
  const def = getObjectDef(auth.context.workspace.id, objectKey)
  if (!def) return { response: notFound(getRequestT(request)) } as const
  return { auth: auth.context, def } as const
}

const recordHandlers = [
  http.get(
    apiPath("/records/:objectKey"),
    withScenario(
      ({ request, params }) => {
        const resolved = resolveObject(request, String(params.objectKey))
        if ("response" in resolved) return resolved.response
        const { auth, def } = resolved

        const query = parseRecordQuery(new URL(request.url))
        const rows = queryRecordValues(
          def,
          recordsOf(auth.workspace.id, def.key),
          {
            q: query.q,
            filters: query.filters,
            sort: query.sort ?? def.layouts.list.defaultSort,
          }
        )
        const page = paginate(rows, query.page, query.pageSize)
        return HttpResponse.json({
          ...page,
          data: page.data.map((row) => toCrmRecord(def, row)),
        })
      },
      {
        empty: ({ request }) => {
          const { page, pageSize } = parseRecordQuery(new URL(request.url))
          return HttpResponse.json(paginate([], page, pageSize))
        },
      }
    )
  ),

  http.post(
    apiPath("/records/:objectKey"),
    withScenario(
      async ({ request, params }) => {
        const resolved = resolveObject(request, String(params.objectKey))
        if ("response" in resolved) return resolved.response
        const { auth, def } = resolved
        const denied = authorize(request, auth, "create", "record")
        if (denied) return denied

        const t = getRequestT(request)
        const body = ((await readJson(request)) ?? {}) as RecordValues
        // Server defaults: owner = creator, first pipeline stage.
        const input: RecordValues = {
          ownerId: auth.user.id,
          ...(def.pipeline
            ? { [def.pipeline.field]: def.pipeline.stages[0]!.key }
            : {}),
          ...Object.fromEntries(
            Object.entries(body).filter(([, value]) => value !== undefined)
          ),
        }
        const result = validateRecordInput(def, auth.workspace.id, input, t)
        if (!result.ok) return validationError(t, result.fieldErrors)

        if (def.pipeline) {
          const stage = String(result.values[def.pipeline.field])
          const gate = stageGateErrors(def, stage, result.values)
          if (gate) return validationError(t, gate, "STAGE_GATE")
        }

        const now = new Date().toISOString()
        const row = db.records.create({
          id: newRecordId(def.key),
          workspaceId: auth.workspace.id,
          objectKey: def.key,
          values: applyRecordHook(
            def.key,
            { ...result.values, createdAt: now, updatedAt: now },
            { workspaceId: auth.workspace.id, isNew: true }
          ),
        })
        return HttpResponse.json(toCrmRecord(def, row), { status: 201 })
      },
      { validationErrors: (t) => ({ name: [t("mock.validation")] }) }
    )
  ),

  http.get(
    apiPath("/records/:objectKey/:id"),
    withScenario(({ request, params }) => {
      const resolved = resolveObject(request, String(params.objectKey))
      if ("response" in resolved) return resolved.response
      const { auth, def } = resolved
      const row = findRecordRow(auth.workspace.id, def.key, String(params.id))
      return row
        ? HttpResponse.json(toCrmRecord(def, row))
        : notFound(getRequestT(request))
    })
  ),

  http.patch(
    apiPath("/records/:objectKey/:id"),
    withScenario(async ({ request, params }) => {
      const resolved = resolveObject(request, String(params.objectKey))
      if ("response" in resolved) return resolved.response
      const { auth, def } = resolved
      const t = getRequestT(request)
      const row = findRecordRow(auth.workspace.id, def.key, String(params.id))
      if (!row) return notFound(t)

      const denied = authorize(request, auth, "update", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied

      const result = validateRecordInput(
        def,
        auth.workspace.id,
        await readJson(request),
        t,
        { partial: true, current: row.values }
      )
      if (!result.ok) return validationError(t, result.fieldErrors)

      const values = { ...row.values, ...result.values }
      const stageField = def.pipeline?.field
      if (stageField && stageField in result.values) {
        const gate = stageGateErrors(def, String(values[stageField]), values)
        if (gate) return validationError(t, gate, "STAGE_GATE")
      }

      const updated = db.records.update(row.id, {
        values: applyRecordHook(
          def.key,
          { ...values, updatedAt: new Date().toISOString() },
          { workspaceId: auth.workspace.id, isNew: false }
        ),
      })!
      return HttpResponse.json(toCrmRecord(def, updated))
    })
  ),

  http.patch(
    apiPath("/records/:objectKey/:id/stage"),
    withScenario(async ({ request, params }) => {
      const resolved = resolveObject(request, String(params.objectKey))
      if ("response" in resolved) return resolved.response
      const { auth, def } = resolved
      const t = getRequestT(request)
      const row = findRecordRow(auth.workspace.id, def.key, String(params.id))
      if (!row || !def.pipeline) return notFound(t)

      const denied = authorize(request, auth, "update", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied

      const parsed = stageMoveInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return zodError(t, parsed.error)
      const { stage, values: extra = {} } = parsed.data
      if (!def.pipeline.stages.some((item) => item.key === stage)) {
        return validationError(t, { stage: [t("mock.unknownStage")] })
      }

      const result = validateRecordInput(def, auth.workspace.id, extra, t, {
        partial: true,
        current: row.values,
      })
      if (!result.ok) return validationError(t, result.fieldErrors)

      const values = {
        ...row.values,
        ...result.values,
        [def.pipeline.field]: stage,
      }
      const gate = stageGateErrors(def, stage, values)
      if (gate) return validationError(t, gate, "STAGE_GATE")

      const updated = db.records.update(row.id, {
        values: { ...values, updatedAt: new Date().toISOString() },
      })!
      return HttpResponse.json(toCrmRecord(def, updated))
    })
  ),

  http.delete(
    apiPath("/records/:objectKey/:id"),
    withScenario(({ request, params }) => {
      const resolved = resolveObject(request, String(params.objectKey))
      if ("response" in resolved) return resolved.response
      const { auth, def } = resolved
      const t = getRequestT(request)
      const row = findRecordRow(auth.workspace.id, def.key, String(params.id))
      if (!row) return notFound(t)

      const denied = authorize(request, auth, "delete", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied

      db.records.delete(row.id)
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.post(
    apiPath("/records/:objectKey/bulk"),
    withScenario(async ({ request, params }) => {
      const resolved = resolveObject(request, String(params.objectKey))
      if ("response" in resolved) return resolved.response
      const { auth, def } = resolved
      const t = getRequestT(request)

      const parsed = bulkActionInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return zodError(t, parsed.error)
      const input = parsed.data
      const action = input.action === "delete" ? "delete" : "update"

      if (input.action === "assign") {
        const member = db.memberships.findFirst(
          (item) =>
            item.workspaceId === auth.workspace.id &&
            item.userId === input.ownerId
        )
        if (!member)
          return validationError(t, { ownerId: [t("mock.invalidUser")] })
      }
      if (
        input.action === "addTag" &&
        !getField(def, "tags")?.options?.some(
          (item) => item.value === input.tag
        )
      ) {
        return validationError(t, { tag: [t("mock.invalidOption")] })
      }

      const rows = input.ids.flatMap(
        (id) => findRecordRow(auth.workspace.id, def.key, id) ?? []
      )
      // Nothing allowed at all → 403; partially allowed → skipped ids.
      if (
        !can(auth.subject, action, "record") &&
        !rows.some((row) =>
          can(auth.subject, action, "record", {
            ownerId: row.values.ownerId as string,
          })
        )
      ) {
        return authorize(request, auth, action, "record", { ownerId: null })!
      }

      let updated = 0
      const skipped: string[] = []
      const now = new Date().toISOString()
      for (const row of rows) {
        const allowed = can(auth.subject, action, "record", {
          ownerId: row.values.ownerId as string,
        })
        if (!allowed) {
          skipped.push(row.id)
          continue
        }
        if (input.action === "delete") {
          db.records.delete(row.id)
        } else {
          const values =
            input.action === "assign"
              ? { ...row.values, ownerId: input.ownerId }
              : {
                  ...row.values,
                  tags: Array.from(
                    new Set([
                      ...((row.values.tags as string[] | null) ?? []),
                      input.tag,
                    ])
                  ),
                }
          db.records.update(row.id, { values: { ...values, updatedAt: now } })
        }
        updated++
      }
      return HttpResponse.json({ updated, skipped })
    })
  ),
]

/* ----------------------------------------------------------------------------
 * Files
 * ------------------------------------------------------------------------- */

/** Duck typed: in tests the request's `File` comes from another realm. */
function isFileLike(item: unknown): item is File {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as File).name === "string" &&
    typeof (item as File).size === "number"
  )
}

async function readFiles(request: Request) {
  try {
    const form = await request.formData()
    const category = form.get("category")
    return Object.assign(form.getAll("file").filter(isFileLike), {
      category: typeof category === "string" && category ? category : null,
    })
  } catch {
    return Object.assign([] as File[], { category: null })
  }
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    mimeType: row.mimeType,
    uploadedAt: row.uploadedAt,
    uploadedBy: row.uploadedBy,
    uploadedByName: db.users.findById(row.uploadedBy)?.name ?? null,
    category: row.category ?? null,
  }
}

const fileHandlers = [
  http.get(
    apiPath("/records/:objectKey/:id/files"),
    withScenario(
      ({ request, params }) => {
        const resolved = resolveObject(request, String(params.objectKey))
        if ("response" in resolved) return resolved.response
        const { auth, def } = resolved
        if (!findRecordRow(auth.workspace.id, def.key, String(params.id))) {
          return notFound(getRequestT(request))
        }
        const data = db.attachments
          .findMany(
            (row) =>
              row.workspaceId === auth.workspace.id &&
              row.objectKey === def.key &&
              row.recordId === String(params.id)
          )
          .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
          .map(toAttachment)
        return HttpResponse.json({ data })
      },
      { empty: () => HttpResponse.json({ data: [] }) }
    )
  ),

  http.post(
    apiPath("/records/:objectKey/:id/files"),
    withScenario(async ({ request, params }) => {
      const resolved = resolveObject(request, String(params.objectKey))
      if ("response" in resolved) return resolved.response
      const { auth, def } = resolved
      const t = getRequestT(request)
      const row = findRecordRow(auth.workspace.id, def.key, String(params.id))
      if (!row) return notFound(t)
      const denied = authorize(request, auth, "create", "record")
      if (denied) return denied

      const files = await readFiles(request)
      if (files.length === 0)
        return validationError(t, { file: [t("validation")] })
      if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) {
        return validationError(t, { file: [t("mock.fileTooLarge")] })
      }
      const category = def.fileCategories?.some(
        (option) => option.value === files.category
      )
        ? files.category
        : null
      if (files.category && !category) {
        return validationError(t, { category: [t("mock.invalidOption")] })
      }

      const now = new Date().toISOString()
      const data = files.map((file) =>
        toAttachment(
          db.attachments.create({
            id: `fil_${crypto.randomUUID().slice(0, 12)}`,
            workspaceId: auth.workspace.id,
            objectKey: def.key,
            recordId: row.id,
            name: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            uploadedBy: auth.user.id,
            uploadedAt: now,
            category,
          })
        )
      )
      return HttpResponse.json({ data }, { status: 201 })
    })
  ),

  http.delete(
    apiPath("/records/:objectKey/:id/files/:fileId"),
    withScenario(({ request, params }) => {
      const resolved = resolveObject(request, String(params.objectKey))
      if ("response" in resolved) return resolved.response
      const { auth } = resolved
      const t = getRequestT(request)
      const file = db.attachments.findById(String(params.fileId))
      if (!file || file.workspaceId !== auth.workspace.id) return notFound(t)
      const denied = authorize(request, auth, "delete", "record", {
        ownerId: file.uploadedBy,
      })
      if (denied) return denied
      db.attachments.delete(file.id)
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.post(
    apiPath("/files"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const [file] = await readFiles(request)
      if (!file) return validationError(t, { file: [t("validation")] })
      if (file.size > MAX_UPLOAD_BYTES) {
        return validationError(t, { file: [t("mock.fileTooLarge")] })
      }
      const upload = db.uploads.create({
        id: `upl_${crypto.randomUUID().slice(0, 12)}`,
        workspaceId: auth.context.workspace.id,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
      })
      return HttpResponse.json(
        {
          id: upload.id,
          name: upload.name,
          size: upload.size,
          mimeType: upload.mimeType,
        },
        { status: 201 }
      )
    })
  ),
]

/* ----------------------------------------------------------------------------
 * Directory & saved views
 * ------------------------------------------------------------------------- */

function toView(row: ViewRow): SavedView {
  const { workspaceId: _workspaceId, ...view } = row
  return { ...view, ownerName: db.users.findById(row.ownerId)?.name ?? null }
}

const viewPrefId = (workspaceId: string, userId: string, objectKey: string) =>
  `${workspaceId}:${userId}:${objectKey}`

const directoryAndViewHandlers = [
  http.get(
    apiPath("/users"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const data: DirectoryUser[] = db.memberships
          .findMany((item) => item.workspaceId === auth.context.workspace.id)
          .flatMap((membership) => {
            const user = db.users.findById(membership.userId)
            return user
              ? [
                  {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                    role: membership.role,
                  },
                ]
              : []
          })
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
        return HttpResponse.json({ data })
      },
      { critical: true }
    )
  ),

  http.get(
    apiPath("/views"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const objectKey =
          new URL(request.url).searchParams.get("objectKey") ?? ""
        const { workspace, user } = auth.context
        const data = db.views
          .findMany(
            (row) =>
              row.workspaceId === workspace.id &&
              row.objectKey === objectKey &&
              (row.shared || row.ownerId === user.id)
          )
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
          .map(toView)
        const pref = db.viewPrefs.findById(
          viewPrefId(workspace.id, user.id, objectKey)
        )
        const defaultViewId =
          pref?.defaultViewId &&
          data.some((view) => view.id === pref.defaultViewId)
            ? pref.defaultViewId
            : null
        return HttpResponse.json({ data, defaultViewId })
      },
      { empty: () => HttpResponse.json({ data: [], defaultViewId: null }) }
    )
  ),

  http.post(
    apiPath("/views"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "create", "view")
      if (denied) return denied
      const t = getRequestT(request)

      const parsed = viewInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return zodError(t, parsed.error)
      if (parsed.data.shared) {
        const deniedShare = authorize(request, auth.context, "manage", "view")
        if (deniedShare) return deniedShare
      }
      if (!getObjectDef(auth.context.workspace.id, parsed.data.objectKey)) {
        return notFound(t)
      }

      const row = db.views.create({
        id: `view_${crypto.randomUUID().slice(0, 12)}`,
        workspaceId: auth.context.workspace.id,
        ownerId: auth.context.user.id,
        createdAt: new Date().toISOString(),
        ...parsed.data,
      })
      return HttpResponse.json(toView(row), { status: 201 })
    })
  ),

  http.put(
    apiPath("/views/default"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const parsed = defaultViewInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return zodError(t, parsed.error)

      const { workspace, user } = auth.context
      const id = viewPrefId(workspace.id, user.id, parsed.data.objectKey)
      if (db.viewPrefs.findById(id)) {
        db.viewPrefs.update(id, { defaultViewId: parsed.data.viewId })
      } else {
        db.viewPrefs.create({ id, defaultViewId: parsed.data.viewId })
      }
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.patch(
    apiPath("/views/:id"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const row = db.views.findById(String(params.id))
      if (!row || row.workspaceId !== auth.context.workspace.id)
        return notFound(t)
      const denied = authorize(request, auth.context, "update", "view", {
        ownerId: row.ownerId,
      })
      if (denied) return denied

      const parsed = viewPatchSchema.safeParse(await readJson(request))
      if (!parsed.success) return zodError(t, parsed.error)
      if (parsed.data.shared && !row.shared) {
        const deniedShare = authorize(request, auth.context, "manage", "view")
        if (deniedShare) return deniedShare
      }
      const updated = db.views.update(row.id, parsed.data)!
      return HttpResponse.json(toView(updated))
    })
  ),

  http.delete(
    apiPath("/views/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const row = db.views.findById(String(params.id))
      if (!row || row.workspaceId !== auth.context.workspace.id)
        return notFound(t)
      const denied = authorize(request, auth.context, "delete", "view", {
        ownerId: row.ownerId,
      })
      if (denied) return denied
      db.views.delete(row.id)
      return new HttpResponse(null, { status: 204 })
    })
  ),
]

export const recordsHandlers = [
  ...metadataHandlers,
  ...directoryAndViewHandlers,
  // `/records/:objectKey/bulk` and `/files` must win over `/:id` routes.
  ...fileHandlers,
  ...recordHandlers,
]
