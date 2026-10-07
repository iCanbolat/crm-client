import { http, HttpResponse } from "msw"
import { z } from "zod"

import { getField, type ObjectDef, type RecordValues } from "@/engine/metadata"
import { newRecordId } from "@/features/records/mocks/factory"
import {
  applyRecordHook,
  findRecordRow,
  getObjectDef,
  recordsOf,
  toCrmRecord,
} from "@/features/records/mocks/store"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import { convertLeadInputSchema } from "../api/leads.schemas"
import { matchCompanies, matchContacts } from "../lib/matching"

/** Lead fields that do not travel to the deal. */
const NOT_COPIED = new Set([
  "name",
  "stage",
  "lostReason",
  "ownerId",
  "tags",
  "createdAt",
  "updatedAt",
  "companyId",
  "contactId",
])

/**
 * Values both objects share by key and type (e.g. the forwarding route and
 * cargo of a freight request) — no hard-coded mapping per module.
 */
export function sharedValues(
  from: ObjectDef,
  to: ObjectDef,
  values: RecordValues
): RecordValues {
  const shared: RecordValues = {}
  for (const field of from.fields) {
    if (NOT_COPIED.has(field.key) || field.readOnly) continue
    const target = getField(to, field.key)
    if (!target || target.readOnly || target.type !== field.type) continue
    const value = values[field.key]
    if (value !== null && value !== undefined) shared[field.key] = value
  }
  return shared
}

function resolveLead(request: Request, leadId: string) {
  const auth = authenticate(request)
  if (!auth.ok) return { response: auth.response } as const
  const t = getRequestT(request)
  const workspaceId = auth.context.workspace.id
  const def = getObjectDef(workspaceId, "lead")
  const row = findRecordRow(workspaceId, "lead", leadId)
  if (!def || !row) {
    return { response: apiError(404, "NOT_FOUND", t("mock.notFound")) } as const
  }
  return { auth: auth.context, def, row, t } as const
}

export const leadsHandlers = [
  http.get(
    apiPath("/leads/:id/convert/suggestions"),
    withScenario(({ request, params }) => {
      const resolved = resolveLead(request, String(params.id))
      if ("response" in resolved) return resolved.response
      const { auth, row } = resolved
      const workspaceId = auth.workspace.id
      return HttpResponse.json({
        companies: matchCompanies(
          row.values,
          recordsOf(workspaceId, "company")
        ),
        contacts: matchContacts(row.values, recordsOf(workspaceId, "contact")),
      })
    })
  ),

  http.post(
    apiPath("/leads/:id/convert"),
    withScenario(async ({ request, params }) => {
      const resolved = resolveLead(request, String(params.id))
      if ("response" in resolved) return resolved.response
      const { auth, def, row, t } = resolved
      const workspaceId = auth.workspace.id

      const denied =
        authorize(request, auth, "update", "record", {
          ownerId: row.values.ownerId as string | undefined,
        }) ?? authorize(request, auth, "create", "record")
      if (denied) return denied

      if (row.values.stage === "converted") {
        return apiError(409, "ALREADY_CONVERTED", t("mock.alreadyConverted"))
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        body = null
      }
      const parsed = convertLeadInputSchema.safeParse(body)
      if (!parsed.success) {
        return apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
            string,
            string[]
          >,
        })
      }
      const input = parsed.data
      const lead = row.values
      const now = new Date().toISOString()
      const base = { ownerId: auth.user.id, createdAt: now, updatedAt: now }
      const create = (objectKey: string, values: RecordValues) =>
        db.records.create({
          id: newRecordId(objectKey),
          workspaceId,
          objectKey,
          values: applyRecordHook(
            objectKey,
            { ...base, ...values },
            { workspaceId, isNew: true }
          ),
        })

      const missing = (key: string) =>
        apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors: { [key]: [t("mock.invalidRelation")] },
        })
      if (
        input.company.mode === "existing" &&
        !findRecordRow(workspaceId, "company", input.company.id)
      ) {
        return missing("company")
      }
      if (
        input.contact.mode === "existing" &&
        !findRecordRow(workspaceId, "contact", input.contact.id)
      ) {
        return missing("contact")
      }

      const companyId =
        input.company.mode === "existing"
          ? input.company.id
          : create("company", {
              name: input.company.name,
              email: lead.email ?? null,
              phone: lead.phone ?? null,
              country: lead.country ?? null,
            }).id

      const contactId =
        input.contact.mode === "existing"
          ? input.contact.id
          : input.contact.mode === "new"
            ? create("contact", {
                name: input.contact.name,
                companyId,
                email: lead.email ?? null,
                phone: lead.phone ?? null,
                country: lead.country ?? null,
              }).id
            : null

      const dealDef = getObjectDef(workspaceId, "deal")
      const dealId =
        input.deal.create && dealDef
          ? create("deal", {
              ...sharedValues(def, dealDef, lead),
              name: input.deal.name,
              companyId,
              contactId,
              amount: lead.estimatedValue ?? null,
              ...(dealDef.pipeline
                ? { [dealDef.pipeline.field]: dealDef.pipeline.stages[0]!.key }
                : {}),
            }).id
          : null

      const updated = db.records.update(row.id, {
        values: {
          ...lead,
          stage: "converted",
          convertedCompanyId: companyId,
          convertedContactId: contactId,
          convertedDealId: dealId,
          updatedAt: now,
        },
      })!
      return HttpResponse.json({
        lead: toCrmRecord(def, updated),
        companyId,
        contactId,
        dealId,
      })
    })
  ),
]
