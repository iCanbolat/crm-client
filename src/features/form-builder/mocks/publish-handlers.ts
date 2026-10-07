import { http, HttpResponse } from "msw"

import { migrateFormContent, validateFormForPublish } from "@/engine/forms"
import { getObjectDef } from "@/features/records/mocks/store"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import type { FormVersionSummary } from "../api/forms.schemas"
import { findFormRow, readDraft, toForm, versionsOf } from "./store"
import type { FormRow, FormVersionRow } from "./types"

function toVersionSummary(
  row: FormRow,
  version: FormVersionRow
): FormVersionSummary {
  return {
    version: version.version,
    publishedAt: version.publishedAt,
    publishedBy: version.publishedBy,
    publishedByName: db.users.findById(version.publishedBy)?.name ?? null,
    isLive:
      row.status === "published" && row.publishedVersion === version.version,
  }
}

type Resolver = Parameters<typeof withScenario>[0]

/** Authenticates, authorizes and loads the form; returns it or a response. */
function withForm(
  action: "read" | "manage",
  resolve: (
    row: FormRow,
    context: {
      request: Request
      params: Record<string, unknown>
      userId: string
    }
  ) => Response | Promise<Response>
): Resolver {
  return ({ request, params }) => {
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const denied = authorize(request, auth.context, action, "form")
    if (denied) return denied
    const row = findFormRow(auth.context.workspace.id, String(params.id))
    if (!row) {
      return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
    }
    return resolve(row, { request, params, userId: auth.context.user.id })
  }
}

/** Publishing, versions and restore (B4.7). */
export const publishHandlers = [
  http.post(
    apiPath("/forms/:id/publish"),
    withScenario(
      withForm("manage", (row, { request, userId }) => {
        const content = readDraft(row)
        const objectDef = getObjectDef(
          row.workspaceId,
          content.mapping.objectKey
        )
        const issues = validateFormForPublish(content, objectDef)
        if (issues.some((issue) => issue.severity === "error")) {
          return apiError(
            422,
            "FORM_NOT_PUBLISHABLE",
            getRequestT(request)("mock.formNotPublishable"),
            { details: { issues } }
          )
        }
        const version = (versionsOf(row.id).at(-1)?.version ?? 0) + 1
        const now = new Date().toISOString()
        db.formVersions.create({
          id: `${row.id}_v${version}`,
          workspaceId: row.workspaceId,
          formId: row.id,
          version,
          content: structuredClone(content),
          publishedAt: now,
          publishedBy: userId,
        })
        const updated = db.forms.update(row.id, {
          status: "published",
          publishedVersion: version,
          // The stored draft is normalized to the current schema.
          draft: content,
          updatedAt: now,
        })
        return HttpResponse.json(toForm(updated ?? row))
      })
    )
  ),

  http.post(
    apiPath("/forms/:id/unpublish"),
    withScenario(
      withForm("manage", (row) => {
        const updated = db.forms.update(row.id, {
          status: "draft",
          publishedVersion: null,
          updatedAt: new Date().toISOString(),
        })
        return HttpResponse.json(toForm(updated ?? row))
      })
    )
  ),

  http.get(
    apiPath("/forms/:id/versions"),
    withScenario(
      withForm("read", (row) =>
        HttpResponse.json({
          data: versionsOf(row.id)
            .reverse()
            .map((version) => toVersionSummary(row, version)),
        })
      )
    )
  ),

  http.get(
    apiPath("/forms/:id/versions/:version"),
    withScenario(
      withForm("read", (row, { request, params }) => {
        const version = versionsOf(row.id).find(
          (item) => item.version === Number(params.version)
        )
        if (!version) {
          return apiError(
            404,
            "NOT_FOUND",
            getRequestT(request)("mock.versionNotFound")
          )
        }
        return HttpResponse.json({
          ...toVersionSummary(row, version),
          content: migrateFormContent(version.content),
        })
      })
    )
  ),

  http.post(
    apiPath("/forms/:id/versions/:version/restore"),
    withScenario(
      withForm("manage", (row, { request, params }) => {
        const version = versionsOf(row.id).find(
          (item) => item.version === Number(params.version)
        )
        if (!version) {
          return apiError(
            404,
            "NOT_FOUND",
            getRequestT(request)("mock.versionNotFound")
          )
        }
        const updated = db.forms.update(row.id, {
          draft: migrateFormContent(version.content),
          updatedAt: new Date().toISOString(),
        })
        return HttpResponse.json(toForm(updated ?? row))
      })
    )
  ),
]
