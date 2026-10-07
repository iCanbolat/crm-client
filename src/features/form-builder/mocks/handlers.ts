import { http, HttpResponse } from "msw"
import { z } from "zod"

import type { FieldErrors } from "@/lib/api"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"
import {
  applySearch,
  applySort,
  paginate,
  parseListParams,
} from "@/mocks/utils/list"

import {
  createFormInputSchema,
  FORM_LIST_DEFAULTS,
  formStatusSchema,
  updateFormInputSchema,
} from "../api/forms.schemas"
import { createStarterContent } from "../lib/defaults"
import { slugify, uniqueSlug } from "../lib/slug"
import { publishHandlers } from "./publish-handlers"
import {
  findFormRow,
  formsOf,
  isSlugTaken,
  toForm,
  toFormSummary,
  versionsOf,
} from "./store"

const flatten = (error: z.ZodError) =>
  z.flattenError(error).fieldErrors as FieldErrors

/** Form builder API (B4.2); publishing and versions in `publish-handlers`. */
export const formHandlers = [
  http.get(
    apiPath("/forms"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "read", "form")
        if (denied) return denied

        const url = new URL(request.url)
        const params = parseListParams(url, {
          pageSize: FORM_LIST_DEFAULTS.pageSize,
        })
        const status = formStatusSchema.safeParse(
          url.searchParams.get("status")
        )

        let rows = formsOf(auth.context.workspace.id)
        rows = applySearch(rows, params.q, ["name", "slug"])
        if (status.success)
          rows = rows.filter((row) => row.status === status.data)
        rows = applySort(
          rows,
          params.sort ?? { field: "updatedAt", direction: "desc" }
        )

        const page = paginate(rows, params.page, params.pageSize)
        return HttpResponse.json({
          ...page,
          data: page.data.map(toFormSummary),
        })
      },
      {
        empty: ({ request }) => {
          const { page, pageSize } = parseListParams(new URL(request.url))
          return HttpResponse.json(paginate([], page, pageSize))
        },
      }
    )
  ),

  http.post(
    apiPath("/forms"),
    withScenario(
      async ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "create", "form")
        if (denied) return denied

        const t = getRequestT(request)
        const parsed = createFormInputSchema.safeParse(await request.json())
        if (!parsed.success) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: flatten(parsed.error),
          })
        }

        const { workspace, user } = auth.context
        const { name, slug: requested } = parsed.data
        if (requested && isSlugTaken(workspace.id, requested)) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { slug: [t("mock.slugTaken")] },
          })
        }
        const slug =
          requested ??
          uniqueSlug(
            slugify(name),
            new Set(formsOf(workspace.id).map((row) => row.slug))
          )

        const now = new Date().toISOString()
        const row = db.forms.create({
          id: `form_${crypto.randomUUID().slice(0, 8)}`,
          workspaceId: workspace.id,
          name,
          slug,
          status: "draft",
          publishedVersion: null,
          draft: createStarterContent(),
          ownerId: user.id,
          createdAt: now,
          updatedAt: now,
          views: 0,
          submissions: 0,
        })
        return HttpResponse.json(toForm(row), { status: 201 })
      },
      { validationErrors: (t) => ({ name: [t("mock.validation")] }) }
    )
  ),

  http.get(
    apiPath("/forms/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "form")
      if (denied) return denied

      const row = findFormRow(auth.context.workspace.id, String(params.id))
      if (!row) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      return HttpResponse.json(toForm(row))
    })
  ),

  http.get(
    apiPath("/forms/:id/stats"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "form")
      if (denied) return denied

      const row = findFormRow(auth.context.workspace.id, String(params.id))
      if (!row) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      return HttpResponse.json(toFormSummary(row).stats)
    })
  ),

  http.patch(
    apiPath("/forms/:id"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "update", "form")
      if (denied) return denied

      const t = getRequestT(request)
      const { workspace } = auth.context
      const row = findFormRow(workspace.id, String(params.id))
      if (!row) return apiError(404, "NOT_FOUND", t("mock.notFound"))

      const parsed = updateFormInputSchema.safeParse(await request.json())
      if (!parsed.success) {
        return apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors: flatten(parsed.error),
        })
      }
      const { name, slug, content } = parsed.data
      if (slug && isSlugTaken(workspace.id, slug, row.id)) {
        return apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors: { slug: [t("mock.slugTaken")] },
        })
      }

      const updated = db.forms.update(row.id, {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(content !== undefined ? { draft: content } : {}),
        updatedAt: new Date().toISOString(),
      })
      return HttpResponse.json(toForm(updated ?? row))
    })
  ),

  http.delete(
    apiPath("/forms/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "delete", "form")
      if (denied) return denied

      const t = getRequestT(request)
      const row = findFormRow(auth.context.workspace.id, String(params.id))
      if (!row) return apiError(404, "NOT_FOUND", t("mock.notFound"))
      if (row.status === "published") {
        return apiError(409, "FORM_PUBLISHED", t("mock.formPublished"))
      }

      for (const version of versionsOf(row.id))
        db.formVersions.delete(version.id)
      db.forms.delete(row.id)
      return new HttpResponse(null, { status: 204 })
    })
  ),

  ...publishHandlers,
]
