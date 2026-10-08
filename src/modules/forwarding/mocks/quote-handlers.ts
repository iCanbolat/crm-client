import { http, HttpResponse } from "msw"
import { z } from "zod"

import { dispatchMessageEvent } from "@/features/messaging/mocks/dispatch"
import { getObjectDef } from "@/features/records/mocks/store"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  quoteInputSchema,
  quoteStatusInputSchema,
  type QuoteInput,
} from "../api/quotes.schemas"
import { canRevise, canTransition } from "../lib/quote"
import type { QuoteStatus } from "../lib/constants"
import {
  buildQuoteDraft,
  expireIfDue,
  findQuote,
  invalidRelations,
  latestVersion,
  nextQuoteNumber,
  syncQuoteRecord,
  toQuote,
} from "./quote-store"
import { createShipmentFromQuote } from "./shipment-store"

type RequestT = ReturnType<typeof getRequestT>

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function validation(t: RequestT, error: z.ZodError) {
  return apiError(422, "VALIDATION_ERROR", t("validation"), {
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  })
}

function relationErrors(t: RequestT, keys: string[]) {
  return apiError(422, "VALIDATION_ERROR", t("validation"), {
    fieldErrors: Object.fromEntries(
      keys.map((key) => [key, [t("mock.invalidRelation")]])
    ),
  })
}

/** Quote endpoints exist only while the module is active. */
function resolve(request: Request) {
  const auth = authenticate(request)
  if (!auth.ok) return { response: auth.response } as const
  const t = getRequestT(request)
  const workspaceId = auth.context.workspace.id
  const def = getObjectDef(workspaceId, "quote")
  if (!def) {
    return { response: apiError(404, "NOT_FOUND", t("mock.notFound")) } as const
  }
  return { auth: auth.context, def, t, workspaceId } as const
}

function resolveQuote(request: Request, quoteId: string) {
  const resolved = resolve(request)
  if ("response" in resolved) return { response: resolved.response } as const
  const row = findQuote(resolved.workspaceId, quoteId)
  if (!row) {
    return {
      response: apiError(404, "NOT_FOUND", resolved.t("mock.notFound")),
    } as const
  }
  return { ...resolved, row: expireIfDue(row) } as const
}

const ACTION_STATUS = {
  send: "sent",
  accept: "accepted",
  reject: "rejected",
} as const satisfies Record<string, QuoteStatus>

export const quoteHandlers = [
  http.get(
    apiPath("/quotes/draft"),
    withScenario(({ request }) => {
      const resolved = resolve(request)
      if ("response" in resolved) return resolved.response
      const url = new URL(request.url)
      return HttpResponse.json(
        buildQuoteDraft(resolved.workspaceId, {
          leadId: url.searchParams.get("leadId"),
          dealId: url.searchParams.get("dealId"),
          companyId: url.searchParams.get("companyId"),
        })
      )
    })
  ),

  http.post(
    apiPath("/quotes"),
    withScenario(async ({ request }) => {
      const resolved = resolve(request)
      if ("response" in resolved) return resolved.response
      const { auth, t, workspaceId } = resolved
      const denied = authorize(request, auth, "create", "record")
      if (denied) return denied

      const parsed = quoteInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validation(t, parsed.error)
      const document: QuoteInput = parsed.data
      const invalid = invalidRelations(workspaceId, document)
      if (invalid.length) return relationErrors(t, invalid)

      const now = new Date().toISOString()
      const id = `quo_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`
      const row = db.records.create({
        id,
        workspaceId,
        objectKey: "quote",
        values: {
          quoteNumber: nextQuoteNumber(workspaceId),
          ownerId: auth.user.id,
          createdAt: now,
          updatedAt: now,
        },
      })
      const version = db.quoteVersions.create({
        id: `${id}:v1`,
        workspaceId,
        quoteId: id,
        version: 1,
        status: "draft",
        document,
        createdAt: now,
        createdBy: auth.user.id,
      })
      const synced = syncQuoteRecord(row, version)
      return HttpResponse.json(toQuote(synced), { status: 201 })
    })
  ),

  http.get(
    apiPath("/quotes/:id"),
    withScenario(({ request, params }) => {
      const resolved = resolveQuote(request, String(params.id))
      if ("response" in resolved) return resolved.response
      const raw = new URL(request.url).searchParams.get("version")
      const version = raw ? Number.parseInt(raw, 10) : undefined
      const quote = toQuote(resolved.row, version)
      return quote
        ? HttpResponse.json(quote)
        : apiError(404, "NOT_FOUND", resolved.t("mock.notFound"))
    })
  ),

  http.patch(
    apiPath("/quotes/:id"),
    withScenario(async ({ request, params }) => {
      const resolved = resolveQuote(request, String(params.id))
      if ("response" in resolved) return resolved.response
      const { auth, t, row, workspaceId } = resolved
      const denied = authorize(request, auth, "update", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied

      const latest = latestVersion(row.id)!
      if (latest.status !== "draft") {
        return apiError(409, "QUOTE_NOT_EDITABLE", t("mock.quoteNotEditable"))
      }
      const parsed = quoteInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validation(t, parsed.error)
      const invalid = invalidRelations(workspaceId, parsed.data)
      if (invalid.length) return relationErrors(t, invalid)

      const version = db.quoteVersions.update(latest.id, {
        document: parsed.data,
      })!
      return HttpResponse.json(toQuote(syncQuoteRecord(row, version)))
    })
  ),

  http.post(
    apiPath("/quotes/:id/revise"),
    withScenario(({ request, params }) => {
      const resolved = resolveQuote(request, String(params.id))
      if ("response" in resolved) return resolved.response
      const { auth, t, row, workspaceId } = resolved
      const denied = authorize(request, auth, "update", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied

      const latest = latestVersion(row.id)!
      if (!canRevise(latest.status)) {
        return apiError(409, "QUOTE_NOT_REVISABLE", t("mock.quoteNotRevisable"))
      }
      const nextVersion = latest.version + 1
      // The previous version stays as it was (TC-3.4-04).
      const version = db.quoteVersions.create({
        id: `${row.id}:v${nextVersion}`,
        workspaceId,
        quoteId: row.id,
        version: nextVersion,
        status: "draft",
        document: structuredClone(latest.document),
        createdAt: new Date().toISOString(),
        createdBy: auth.user.id,
      })
      return HttpResponse.json(
        toQuote(syncQuoteRecord(row, version, { sentAt: null })),
        { status: 201 }
      )
    })
  ),

  http.post(
    apiPath("/quotes/:id/status"),
    withScenario(async ({ request, params }) => {
      const resolved = resolveQuote(request, String(params.id))
      if ("response" in resolved) return resolved.response
      const { auth, t, row, workspaceId } = resolved
      const denied = authorize(request, auth, "update", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied

      const parsed = quoteStatusInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validation(t, parsed.error)
      const { action, email } = parsed.data
      const latest = latestVersion(row.id)!
      const target = ACTION_STATUS[action]
      if (!canTransition(latest.status, target)) {
        return apiError(
          409,
          "INVALID_TRANSITION",
          t("mock.invalidTransition"),
          {
            details: { from: latest.status, to: target },
          }
        )
      }

      const now = new Date().toISOString()
      const version = db.quoteVersions.update(latest.id, { status: target })!
      let shipmentId: string | null = null
      const extra: Record<string, unknown> = {}

      if (action === "send") {
        extra.sentAt = now
        db.activities.create({
          id: `act_${crypto.randomUUID().slice(0, 12)}`,
          workspaceId,
          type: "email",
          subject: `${String(row.values.quoteNumber)} v${version.version}`,
          body: [email?.to ? `→ ${email.to}` : null, email?.message ?? null]
            .filter(Boolean)
            .join("\n"),
          occurredAt: now,
          durationMinutes: null,
          direction: "outbound",
          objectKey: "quote",
          recordId: row.id,
          createdBy: auth.user.id,
          createdAt: now,
        })
      }
      if (action === "accept") {
        const shipment = createShipmentFromQuote(
          workspaceId,
          row,
          version.document,
          auth.user.id
        )
        shipmentId = shipment.id
        extra.shipmentId = shipment.id
        // The deal is won with the booking (forwarding pipeline).
        const dealId = version.document.dealId
        const deal = dealId ? db.records.findById(dealId) : undefined
        const dealDef = getObjectDef(workspaceId, "deal")
        if (
          deal &&
          dealDef?.pipeline?.stages.some((stage) => stage.key === "won")
        ) {
          db.records.update(deal.id, {
            values: { ...deal.values, stage: "won", updatedAt: now },
          })
        }
      }

      const synced = syncQuoteRecord(row, version, extra)
      // WhatsApp notifications (Faz 6), once the header is in sync.
      if (action === "send") {
        dispatchMessageEvent(workspaceId, {
          type: "quote.sent",
          objectKey: "quote",
          recordId: row.id,
          data: { version: String(version.version) },
        })
      }
      if (shipmentId) {
        dispatchMessageEvent(workspaceId, {
          type: "shipment.milestone",
          objectKey: "shipment",
          recordId: shipmentId,
          data: { milestone: "BOOKED" },
        })
      }
      return HttpResponse.json({
        quote: toQuote(synced),
        shipmentId,
      })
    })
  ),
]
