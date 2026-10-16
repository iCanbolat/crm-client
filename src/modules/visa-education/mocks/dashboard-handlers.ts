import { http, HttpResponse } from "msw"

import { getObjectDef } from "@/features/records/mocks/store"
import { authenticate } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { FX_RATES } from "@/mocks/db/fx-rates"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import { buildVisaEducationDashboard } from "./dashboard"

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const REPORT_CURRENCY = "USD"

function rangeOf(request: Request) {
  const url = new URL(request.url)
  return {
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
  }
}

export const dashboardHandlers = [
  http.get(
    apiPath("/dashboard/visa-education"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const t = getRequestT(request)
        const workspaceId = auth.context.workspace.id
        if (!getObjectDef(workspaceId, "visaApplication")) {
          return apiError(404, "NOT_FOUND", t("mock.notFound"))
        }
        const range = rangeOf(request)
        if (
          !ISO_DAY.test(range.from) ||
          !ISO_DAY.test(range.to) ||
          range.from > range.to
        ) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { from: [t("validation")] },
          })
        }
        return HttpResponse.json(
          buildVisaEducationDashboard({
            records: db.records.findMany(
              (row) => row.workspaceId === workspaceId
            ),
            plans: db.paymentPlans.findMany(
              (row) => row.workspaceId === workspaceId
            ),
            range,
            now: new Date().toISOString(),
            currency: REPORT_CURRENCY,
            rates: FX_RATES.rates,
          })
        )
      },
      {
        empty: ({ request }) =>
          HttpResponse.json(
            buildVisaEducationDashboard({
              records: [],
              plans: [],
              range: rangeOf(request),
              now: new Date().toISOString(),
              currency: REPORT_CURRENCY,
              rates: FX_RATES.rates,
            })
          ),
      }
    )
  ),
]
