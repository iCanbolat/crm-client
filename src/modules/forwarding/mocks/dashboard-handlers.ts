import { http, HttpResponse } from "msw"

import { getObjectDef } from "@/features/records/mocks/store"
import { authenticate } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import { buildForwardingDashboard } from "./dashboard"
import { today } from "./quote-store"
import { FX_RATES } from "./reference/carriers"

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const REPORT_CURRENCY = "USD"

export const dashboardHandlers = [
  http.get(
    apiPath("/dashboard/forwarding"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const t = getRequestT(request)
        const workspaceId = auth.context.workspace.id
        if (!getObjectDef(workspaceId, "quote")) {
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
        return HttpResponse.json(
          buildForwardingDashboard({
            records: db.records.findMany(
              (row) => row.workspaceId === workspaceId
            ),
            range: { from, to },
            today: today(),
            currency: REPORT_CURRENCY,
            rates: FX_RATES.rates,
            userName: (id) => db.users.findById(id)?.name ?? id,
          })
        )
      },
      {
        empty: ({ request }) => {
          const url = new URL(request.url)
          return HttpResponse.json(
            buildForwardingDashboard({
              records: [],
              range: {
                from: url.searchParams.get("from") ?? "",
                to: url.searchParams.get("to") ?? "",
              },
              today: today(),
              currency: REPORT_CURRENCY,
              rates: FX_RATES.rates,
              userName: (id) => id,
            })
          )
        },
      }
    )
  ),
]
