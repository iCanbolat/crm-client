import { http, HttpResponse } from "msw"

import { getObjectDef } from "@/features/records/mocks/store"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import {
  apiError,
  apiPath,
  getRequestLanguage,
  getRequestT,
} from "@/mocks/utils/http"

import { buildLeadSources } from "./lead-sources"
import { getReportBuilder, registerReportBuilder } from "./registry"

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
/** Money columns are converted to one reporting currency (as the dashboard). */
export const REPORT_CURRENCY = "USD"

registerReportBuilder({ key: "leadSources", build: buildLeadSources })

export const reportHandlers = [
  http.get<{ key: string }>(
    apiPath("/reports/:key"),
    withScenario(
      ({ request, params }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "read", "report")
        if (denied) return denied
        const t = getRequestT(request)
        const { workspace, subject } = auth.context

        const builder = getReportBuilder(params.key)
        if (
          !builder ||
          (builder.moduleId && !workspace.modules.includes(builder.moduleId))
        ) {
          return apiError(404, "NOT_FOUND", t("mock.notFound"))
        }

        const url = new URL(request.url)
        const from = url.searchParams.get("from") ?? ""
        const to = url.searchParams.get("to") ?? ""
        if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { from: [t("validation")] },
          })
        }
        // Agents only ever see their own numbers (visibility rule).
        const ownerId =
          subject.role === "agent"
            ? subject.userId
            : url.searchParams.get("ownerId") || null

        const range = { from, to }
        const body = builder.build({
          records: db.records.findMany(
            (row) => row.workspaceId === workspace.id
          ),
          range,
          ownerId,
          language: getRequestLanguage(request),
          currency: REPORT_CURRENCY,
          userName: (id) => db.users.findById(id)?.name ?? id,
          objectDef: (objectKey) => getObjectDef(workspace.id, objectKey),
        })
        return HttpResponse.json({
          key: params.key,
          range,
          currency: REPORT_CURRENCY,
          ...body,
        })
      },
      {
        empty: ({ request, params }) => {
          const url = new URL(request.url)
          return HttpResponse.json({
            key: params.key,
            range: {
              from: url.searchParams.get("from") ?? "",
              to: url.searchParams.get("to") ?? "",
            },
            currency: REPORT_CURRENCY,
            rows: [],
            totals: null,
          })
        },
      }
    )
  ),
]
