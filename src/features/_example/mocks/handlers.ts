import { http, HttpResponse } from "msw"
import { z } from "zod"

import type { FieldErrors } from "@/lib/api"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"
import {
  applyFilters,
  applySearch,
  applySort,
  paginate,
  parseListParams,
} from "@/mocks/utils/list"

import {
  createExampleInputSchema,
  type ExampleItem,
} from "../api/example.schemas"
import type { ExampleRecord } from "./factory"

const DEFAULT_PAGE_SIZE = 5

/** Joins the owner's name and drops storage-only fields. */
function toItem({
  workspaceId: _workspaceId,
  ...record
}: ExampleRecord): ExampleItem {
  return {
    ...record,
    ownerName: db.users.findById(record.ownerId)?.name ?? null,
  }
}

export const exampleHandlers = [
  http.get(
    apiPath("/examples"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response

        const params = parseListParams(new URL(request.url), {
          pageSize: DEFAULT_PAGE_SIZE,
        })

        let items = db.examples.findMany(
          (item) => item.workspaceId === auth.context.workspace.id
        )
        items = applySearch(items, params.q, ["name"])
        items = applyFilters(items, params.filters, ["status"])
        items = applySort(
          items,
          params.sort ?? { field: "createdAt", direction: "desc" }
        )

        const page = paginate(items, params.page, params.pageSize)
        return HttpResponse.json({ ...page, data: page.data.map(toItem) })
      },
      {
        empty: ({ request }) => {
          const { page, pageSize } = parseListParams(new URL(request.url), {
            pageSize: DEFAULT_PAGE_SIZE,
          })
          return HttpResponse.json(paginate([], page, pageSize))
        },
      }
    )
  ),

  http.post(
    apiPath("/examples"),
    withScenario(
      async ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "create", "record")
        if (denied) return denied

        const t = getRequestT(request)
        const parsed = createExampleInputSchema.safeParse(await request.json())

        if (!parsed.success) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: z.flattenError(parsed.error)
              .fieldErrors as FieldErrors,
          })
        }

        const { workspace, user } = auth.context
        const name = parsed.data.name
        const duplicate = db.examples.findFirst(
          (item) =>
            item.workspaceId === workspace.id &&
            item.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr")
        )
        if (duplicate) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { name: [t("mock.duplicateName")] },
          })
        }

        const item = db.examples.create({
          id: crypto.randomUUID(),
          name,
          status: "active",
          createdAt: new Date().toISOString(),
          ownerId: user.id,
          workspaceId: workspace.id,
        })

        return HttpResponse.json(toItem(item), { status: 201 })
      },
      { validationErrors: (t) => ({ name: [t("mock.validation")] }) }
    )
  ),

  http.delete(
    apiPath("/examples/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response

      const item = db.examples.findById(String(params.id))
      if (!item || item.workspaceId !== auth.context.workspace.id) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }

      // Agents may only delete their own records (B1.4).
      const denied = authorize(request, auth.context, "delete", "record", {
        ownerId: item.ownerId,
      })
      if (denied) return denied

      db.examples.delete(item.id)
      return new HttpResponse(null, { status: 204 })
    })
  ),
]
