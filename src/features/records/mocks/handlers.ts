import { http, HttpResponse } from "msw"
import { z } from "zod"

import { getField, type RecordValues } from "@/engine/metadata"
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
  MAX_UPLOAD_BYTES,
  stageMoveInputSchema,
  viewInputSchema,
  viewPatchSchema,
  type Attachment,
  type DirectoryUser,
  type SavedView,
} from "../api/records.schemas"
import type { AttachmentRow, ViewRow } from "./factory"
import {
  applyRecordHook,
  checkStageGuards,
  createRecord,
  findScopedRecordRow,
  getObjectDefFor,
  listObjectDefsFor,
  scopedRecordsOf,
  getObjectDef,
  notifyAttachmentAdded,
  notifyRecordSaved,
  parseRecordQuery,
  stageGateErrors,
  toCrmRecord,
  type StageGuardFailure,
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

/** 422 of a failed stage guard: its own code, message and details. */
function guardError(failure: StageGuardFailure) {
  return apiError(422, failure.code, failure.message, {
    details: failure.details,
  })
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
        return HttpResponse.json({ data: listObjectDefsFor(auth.context) })
      },
      { critical: true }
    )
  ),

  http.get(
    apiPath("/meta/objects/:objectKey"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const def = getObjectDefFor(auth.context, String(params.objectKey))
      return def ? HttpResponse.json(def) : notFound(getRequestT(request))
    })
  ),
]

function resolveObject(request: Request, objectKey: string) {
  const auth = authenticate(request)
  if (!auth.ok) return { response: auth.response } as const
  // As the requester may see it: sensitive fields and values left out.
  const def = getObjectDefFor(auth.context, objectKey)
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
        const rows = queryRecordValues(def, scopedRecordsOf(auth, def.key), {
          q: query.q,
          filters: query.filters,
          sort: query.sort ?? def.layouts.list.defaultSort,
        })
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
        const created = createRecord(auth.workspace.id, def, body, {
          ownerId: auth.user.id,
          t,
          actorId: auth.user.id,
        })
        if (!created.ok) {
          return created.guard
            ? guardError(created.guard)
            : validationError(t, created.fieldErrors, created.code)
        }
        const { row } = created
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
      const row = findScopedRecordRow(auth, def.key, String(params.id))
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
      const row = findScopedRecordRow(auth, def.key, String(params.id))
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
        const guard = checkStageGuards({
          workspaceId: auth.workspace.id,
          objectKey: def.key,
          recordId: row.id,
          from: String(row.values[stageField] ?? ""),
          to: String(values[stageField]),
          values,
        })
        if (guard) return guardError(guard)
      }

      const updated = db.records.update(row.id, {
        values: applyRecordHook(
          def.key,
          { ...values, updatedAt: new Date().toISOString() },
          {
            workspaceId: auth.workspace.id,
            isNew: false,
            previous: row.values,
          }
        ),
      })!
      notifyRecordSaved({
        workspaceId: auth.workspace.id,
        objectKey: def.key,
        row: updated,
        previous: row.values,
        actorId: auth.user.id,
      })
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
      const row = findScopedRecordRow(auth, def.key, String(params.id))
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
      const guard = checkStageGuards({
        workspaceId: auth.workspace.id,
        objectKey: def.key,
        recordId: row.id,
        from: String(row.values[def.pipeline.field] ?? ""),
        to: stage,
        values,
      })
      if (guard) return guardError(guard)

      // Module hooks keep derived values in sync on board moves too.
      const updated = db.records.update(row.id, {
        values: applyRecordHook(
          def.key,
          { ...values, updatedAt: new Date().toISOString() },
          {
            workspaceId: auth.workspace.id,
            isNew: false,
            previous: row.values,
          }
        ),
      })!
      notifyRecordSaved({
        workspaceId: auth.workspace.id,
        objectKey: def.key,
        row: updated,
        previous: row.values,
        actorId: auth.user.id,
      })
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
      const row = findScopedRecordRow(auth, def.key, String(params.id))
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
        (id) => findScopedRecordRow(auth, def.key, id) ?? []
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
          const saved = db.records.update(row.id, {
            values: { ...values, updatedAt: now },
          })!
          notifyRecordSaved({
            workspaceId: auth.workspace.id,
            objectKey: def.key,
            row: saved,
            previous: row.values,
            actorId: auth.user.id,
          })
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
        if (!findScopedRecordRow(auth, def.key, String(params.id))) {
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
      const row = findScopedRecordRow(auth, def.key, String(params.id))
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
      const data = files.map((file) => {
        const attachment = db.attachments.create({
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
        notifyAttachmentAdded({
          workspaceId: auth.workspace.id,
          objectKey: def.key,
          recordId: row.id,
          attachmentId: attachment.id,
          category: category ?? null,
        })
        return toAttachment(attachment)
      })
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
