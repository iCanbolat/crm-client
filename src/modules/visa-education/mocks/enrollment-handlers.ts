import { http, HttpResponse } from "msw"

import {
  createRecord,
  findRecordRow,
  getObjectDef,
  toCrmRecord,
} from "@/features/records/mocks/store"
import { authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  VISA_READY_ENROLLMENT_STAGES,
  type EnrollmentStage,
} from "../lib/constants"
import { intakeStartDate, toIntake } from "../lib/intake"
import { addDays } from "../lib/passport"
import { requestT, resolveRecord } from "./http"

const SUBTYPES: Record<string, string> = {
  GB: "Student route",
  US: "F-1",
  CA: "Study permit",
  AU: "Subclass 500",
  DE: "D-Visum (Studium)",
}

/** Student visa file prefilled from a confirmed school application (B8.5). */
export const enrollmentHandlers = [
  http.post(
    apiPath("/enrollments/:id/visa-application"),
    withScenario(({ request, params }) => {
      const resolved = resolveRecord(request, "enrollment", String(params.id), [
        "enrollment",
      ])
      if ("response" in resolved) return resolved.response
      const { row, workspaceId, auth } = resolved
      const denied = authorize(request, auth, "create", "record")
      if (denied) return denied
      const t = requestT(request)

      if (
        !VISA_READY_ENROLLMENT_STAGES.includes(
          row.values.stage as EnrollmentStage
        )
      ) {
        return apiError(
          409,
          "ENROLLMENT_NOT_READY",
          t("errors.enrollmentNotReady")
        )
      }
      const existing =
        typeof row.values.visaApplicationId === "string"
          ? findRecordRow(
              workspaceId,
              "visaApplication",
              row.values.visaApplicationId
            )
          : undefined
      if (existing) {
        return apiError(
          409,
          "VISA_ALREADY_STARTED",
          t("errors.visaAlreadyStarted"),
          {
            details: { visaApplicationId: existing.id },
          }
        )
      }

      const def = getObjectDef(workspaceId, "visaApplication")!
      const intake = toIntake(row.values.intake)
      const country = String(row.values.country ?? "")
      const created = createRecord(
        workspaceId,
        def,
        {
          applicantId: row.values.applicantId,
          destinationCountry: country || null,
          visaCategory: "student",
          visaSubtype: SUBTYPES[country] ?? null,
          enrollmentId: row.id,
          leadId: row.values.leadId ?? null,
          plannedTravelDate: intake
            ? addDays(intakeStartDate(intake), -14)
            : null,
        },
        {
          ownerId: auth.user.id,
          t: getRequestT(request),
          actorId: auth.user.id,
        }
      )
      if (!created.ok) {
        return apiError(422, created.code, t("errors.visaNotCreated"), {
          fieldErrors: created.fieldErrors,
        })
      }
      db.records.update(row.id, {
        values: {
          ...row.values,
          visaApplicationId: created.row.id,
          updatedAt: new Date().toISOString(),
        },
      })
      return HttpResponse.json(toCrmRecord(def, created.row), { status: 201 })
    })
  ),
]
