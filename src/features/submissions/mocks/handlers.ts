import { http, HttpResponse } from "msw"

import { foldText } from "@/engine/logic"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import {
  apiError,
  apiPath,
  getRequestLanguage,
  getRequestT,
} from "@/mocks/utils/http"
import { paginate, parseListParams } from "@/mocks/utils/list"

import {
  SUBMISSION_LIST_DEFAULTS,
  submissionStatusSchema,
  updateSubmissionInputSchema,
} from "../api/submissions.schemas"
import { convertSubmission } from "./process"
import {
  createContentCache,
  findSubmissionRow,
  submissionsOf,
  toSubmission,
  toSubmissionSummary,
} from "./store"

const notFound = (request: Request) =>
  apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))

/** Submissions inbox (B5.6). */
export const submissionHandlers = [
  http.get(
    apiPath("/submissions"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "read", "submission")
        if (denied) return denied

        const url = new URL(request.url)
        const params = parseListParams(url, {
          pageSize: SUBMISSION_LIST_DEFAULTS.pageSize,
        })
        const status = submissionStatusSchema.safeParse(
          url.searchParams.get("status")
        )
        const formId = url.searchParams.get("formId")

        let rows = submissionsOf(auth.context.workspace.id)
        if (formId) rows = rows.filter((row) => row.formId === formId)
        // Spam stays out of sight unless asked for.
        rows = status.success
          ? rows.filter((row) => row.status === status.data)
          : rows.filter((row) => row.status !== "spam")

        const contentOf = createContentCache()
        let summaries = rows.map((row) =>
          toSubmissionSummary(row, contentOf(row))
        )
        const needle = foldText(params.q ?? "")
        if (needle) {
          summaries = summaries.filter((item) =>
            [
              item.contactLabel,
              item.formName,
              item.utm.source,
              item.record?.title,
            ].some((value) => value && foldText(value).includes(needle))
          )
        }
        summaries.sort((a, b) =>
          params.sort?.direction === "asc"
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt)
        )
        return HttpResponse.json(
          paginate(summaries, params.page, params.pageSize)
        )
      },
      {
        empty: ({ request }) => {
          const { page, pageSize } = parseListParams(new URL(request.url))
          return HttpResponse.json(paginate([], page, pageSize))
        },
      }
    )
  ),

  http.get(
    apiPath("/submissions/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "submission")
      if (denied) return denied
      const row = findSubmissionRow(
        auth.context.workspace.id,
        String(params.id)
      )
      if (!row) return notFound(request)
      return HttpResponse.json(toSubmission(row, getRequestLanguage(request)))
    })
  ),

  http.patch(
    apiPath("/submissions/:id"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "update", "submission")
      if (denied) return denied
      const t = getRequestT(request)
      const row = findSubmissionRow(
        auth.context.workspace.id,
        String(params.id)
      )
      if (!row) return notFound(request)
      const parsed = updateSubmissionInputSchema.safeParse(await request.json())
      if (!parsed.success) {
        return apiError(422, "VALIDATION_ERROR", t("validation"))
      }
      // A failed submission stays failed until it is converted.
      const status =
        row.status === "failed" && parsed.data.status !== "spam"
          ? "failed"
          : parsed.data.status
      const updated = db.submissions.update(row.id, { status })!
      return HttpResponse.json(
        toSubmission(updated, getRequestLanguage(request))
      )
    })
  ),

  http.post(
    apiPath("/submissions/:id/convert"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "submission")
      if (denied) return denied
      const t = getRequestT(request)
      const row = findSubmissionRow(
        auth.context.workspace.id,
        String(params.id)
      )
      if (!row) return notFound(request)
      if (row.record) {
        return apiError(409, "ALREADY_CONVERTED", t("mock.alreadyConverted"))
      }
      const converted = convertSubmission(
        { ...row, status: row.status === "spam" ? "new" : row.status },
        t
      )
      if (!converted.record) {
        // Still not mappable (e.g. the form lost a required mapping).
        return apiError(
          422,
          converted.error?.code ?? "VALIDATION_ERROR",
          converted.error?.message ?? t("validation")
        )
      }
      // Converting by hand counts as handling it.
      const updated = db.submissions.update(converted.id, {
        status: "processed",
      })!
      return HttpResponse.json(
        toSubmission(updated, getRequestLanguage(request))
      )
    })
  ),
]
