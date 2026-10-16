import { http, HttpResponse } from "msw"

import { dispatchMessageEvent } from "@/features/messaging/mocks/dispatch"
import { authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  applyTemplateInputSchema,
  checklistItemInputSchema,
  checklistItemPatchSchema,
} from "../api/checklists.schemas"
import { buildChecklist } from "../lib/checklist-templates"
import { readJson, requestT, resolveRecord, validationError } from "./http"
import {
  applyChecklistTemplate,
  CHECKLIST_OBJECTS,
  checklistOf,
  checklistSummary,
  checklistTemplateKey,
  syncChecklistSummary,
  today,
} from "./store"
import type { ChecklistItemRow } from "./types"

const PATH = "/checklists/:objectKey/:id"

function resolve(request: Request, params: Record<string, unknown>) {
  return resolveRecord(
    request,
    String(params.objectKey),
    String(params.id),
    CHECKLIST_OBJECTS
  )
}

function checklistResponse(workspaceId: string, objectKey: string, id: string) {
  const items = checklistOf(workspaceId, objectKey, id)
  const row = db.records.findById(id)
  return {
    templateKey: row ? checklistTemplateKey(row) : null,
    items: items.map(toDto),
    summary: checklistSummary(items),
  }
}

function toDto(item: ChecklistItemRow) {
  const { workspaceId: _ws, objectKey: _o, recordId: _r, ...dto } = item
  return dto
}

/** Write access follows the record (agents: own files only). */
function denyWrite(
  request: Request,
  resolved: Exclude<ReturnType<typeof resolve>, { response: Response }>
) {
  return authorize(request, resolved.auth, "update", "record", {
    ownerId: resolved.row.values.ownerId as string | undefined,
  })
}

export const checklistHandlers = [
  http.get(
    apiPath(PATH),
    withScenario(({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const { workspaceId, row } = resolved
      return HttpResponse.json(
        checklistResponse(workspaceId, row.objectKey, row.id)
      )
    })
  ),

  http.post(
    apiPath(`${PATH}/apply-template`),
    withScenario(async ({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const denied = denyWrite(request, resolved)
      if (denied) return denied
      const parsed = applyTemplateInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(request, parsed.error)
      const { row, workspaceId, auth } = resolved
      if (buildChecklist(parsed.data.templateKey).length === 0) {
        return apiError(
          422,
          "UNKNOWN_TEMPLATE",
          requestT(request)("errors.unknownTemplate")
        )
      }
      applyChecklistTemplate(row, parsed.data.templateKey, auth.user.id)
      return HttpResponse.json(
        checklistResponse(workspaceId, row.objectKey, row.id)
      )
    })
  ),

  http.post(
    apiPath(`${PATH}/items`),
    withScenario(async ({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const denied = denyWrite(request, resolved)
      if (denied) return denied
      const parsed = checklistItemInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(request, parsed.error)
      const { row, workspaceId, auth } = resolved
      const items = checklistOf(workspaceId, row.objectKey, row.id)
      const key = `custom_${crypto.randomUUID().slice(0, 8)}`
      db.checklistItems.create({
        id: `chk_${row.id}_${key}`,
        workspaceId,
        objectKey: row.objectKey,
        recordId: row.id,
        key,
        label: parsed.data.label,
        category: parsed.data.category,
        required: parsed.data.required,
        status: "missing",
        attachmentId: null,
        expiresAt: null,
        documentDate: null,
        maxAgeDays: null,
        note: null,
        requestedAt: null,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.user.id,
        sort: items.reduce((max, item) => Math.max(max, item.sort), -1) + 1,
        custom: true,
      })
      syncChecklistSummary(workspaceId, row.objectKey, row.id)
      return HttpResponse.json(
        checklistResponse(workspaceId, row.objectKey, row.id),
        { status: 201 }
      )
    })
  ),

  http.patch(
    apiPath(`${PATH}/items/:itemId`),
    withScenario(async ({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const denied = denyWrite(request, resolved)
      if (denied) return denied
      const { row, workspaceId, auth } = resolved
      const t = requestT(request)
      const item = db.checklistItems.findById(String(params.itemId))
      if (!item || item.recordId !== row.id) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      const parsed = checklistItemPatchSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(request, parsed.error)
      const patch = parsed.data

      if (patch.attachmentId) {
        const attachment = db.attachments.findById(patch.attachmentId)
        if (!attachment || attachment.recordId !== row.id) {
          return apiError(422, "VALIDATION_ERROR", t("errors.unknownFile"), {
            fieldErrors: { attachmentId: [t("errors.unknownFile")] },
          })
        }
      }
      const attachmentId =
        patch.attachmentId === undefined
          ? item.attachmentId
          : patch.attachmentId
      const status =
        patch.status ??
        (patch.attachmentId && item.status !== "approved"
          ? "received"
          : item.status)
      if (status === "approved" && !attachmentId) {
        return apiError(
          422,
          "ATTACHMENT_REQUIRED",
          t("errors.attachmentRequired")
        )
      }
      if (status === "requested" && item.status === "approved") {
        return apiError(
          422,
          "INVALID_ITEM_STATUS",
          t("errors.invalidItemStatus")
        )
      }
      const fileChanged = attachmentId !== item.attachmentId
      db.checklistItems.update(item.id, {
        ...patch,
        status,
        attachmentId,
        documentDate: fileChanged
          ? attachmentId
            ? today()
            : null
          : item.documentDate,
        requestedAt:
          status === "requested" && item.status !== "requested"
            ? new Date().toISOString()
            : item.requestedAt,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.user.id,
      })
      syncChecklistSummary(workspaceId, row.objectKey, row.id)
      return HttpResponse.json(
        checklistResponse(workspaceId, row.objectKey, row.id)
      )
    })
  ),

  http.delete(
    apiPath(`${PATH}/items/:itemId`),
    withScenario(({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const denied = denyWrite(request, resolved)
      if (denied) return denied
      const { row, workspaceId } = resolved
      const item = db.checklistItems.findById(String(params.itemId))
      if (!item || item.recordId !== row.id) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      if (!item.custom) {
        return apiError(
          409,
          "TEMPLATE_ITEM",
          requestT(request)("errors.templateItem")
        )
      }
      db.checklistItems.delete(item.id)
      syncChecklistSummary(workspaceId, row.objectKey, row.id)
      return HttpResponse.json(
        checklistResponse(workspaceId, row.objectKey, row.id)
      )
    })
  ),

  /** "Request missing documents": marks them requested + WhatsApp event. */
  http.post(
    apiPath(`${PATH}/request`),
    withScenario(({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const denied = denyWrite(request, resolved)
      if (denied) return denied
      const { row, workspaceId, auth } = resolved
      const now = new Date().toISOString()
      const open = checklistOf(workspaceId, row.objectKey, row.id).filter(
        (item) =>
          item.required &&
          (item.status === "missing" || item.status === "rejected")
      )
      for (const item of open) {
        db.checklistItems.update(item.id, {
          status: "requested",
          requestedAt: now,
          updatedAt: now,
          updatedBy: auth.user.id,
        })
      }
      if (open.length > 0) {
        dispatchMessageEvent(workspaceId, {
          type: "checklist.requested",
          objectKey: row.objectKey,
          recordId: row.id,
          data: {
            object: row.objectKey,
            count: String(open.length),
            at: now,
          },
        })
      }
      syncChecklistSummary(workspaceId, row.objectKey, row.id)
      return HttpResponse.json({
        ...checklistResponse(workspaceId, row.objectKey, row.id),
        requested: open.length,
      })
    })
  ),
]
