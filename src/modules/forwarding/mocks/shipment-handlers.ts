import { http, HttpResponse } from "msw"
import { z } from "zod"

import { dispatchMessageEvent } from "@/features/messaging/mocks/dispatch"
import { findRecordRow, getObjectDef } from "@/features/records/mocks/store"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import { milestoneInputSchema } from "../api/shipments.schemas"
import {
  nextMilestones,
  validateMilestone,
  type MilestoneError,
  type MilestoneEvent,
} from "../lib/milestones"
import { addMilestone, shipmentHook } from "./shipment-store"

type MilestoneMessage =
  | "mock.milestoneOrder"
  | "mock.milestoneFuture"
  | "mock.milestoneBeforePrevious"

const ERROR_KEYS: Record<
  MilestoneError,
  { field: string; message: MilestoneMessage }
> = {
  ORDER: { field: "milestone", message: "mock.milestoneOrder" },
  DUPLICATE: { field: "milestone", message: "mock.milestoneOrder" },
  FUTURE: { field: "at", message: "mock.milestoneFuture" },
  BEFORE_PREVIOUS: { field: "at", message: "mock.milestoneBeforePrevious" },
}

function resolveShipment(request: Request, shipmentId: string) {
  const auth = authenticate(request)
  if (!auth.ok) return { response: auth.response } as const
  const t = getRequestT(request)
  const workspaceId = auth.context.workspace.id
  const row = getObjectDef(workspaceId, "shipment")
    ? findRecordRow(workspaceId, "shipment", shipmentId)
    : undefined
  if (!row) {
    return { response: apiError(404, "NOT_FOUND", t("mock.notFound")) } as const
  }
  return { auth: auth.context, row, t, workspaceId } as const
}

function history(shipmentId: string): MilestoneEvent[] {
  return db.milestones
    .findMany((item) => item.shipmentId === shipmentId)
    .sort((a, b) => a.at.localeCompare(b.at))
}

function listResponse(shipmentId: string) {
  const events = db.milestones
    .findMany((item) => item.shipmentId === shipmentId)
    .sort((a, b) => a.at.localeCompare(b.at))
  return {
    data: events.map((event) => ({
      id: event.id,
      milestone: event.milestone,
      at: event.at,
      note: event.note,
      createdByName: db.users.findById(event.createdBy)?.name ?? null,
    })),
    next: nextMilestones(events),
  }
}

export const shipmentHandlers = [
  http.get(
    apiPath("/shipments/:id/milestones"),
    withScenario(({ request, params }) => {
      const resolved = resolveShipment(request, String(params.id))
      if ("response" in resolved) return resolved.response
      return HttpResponse.json(listResponse(resolved.row.id))
    })
  ),

  http.post(
    apiPath("/shipments/:id/milestones"),
    withScenario(async ({ request, params }) => {
      const resolved = resolveShipment(request, String(params.id))
      if ("response" in resolved) return resolved.response
      const { auth, row, t, workspaceId } = resolved
      const denied = authorize(request, auth, "update", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied

      let body: unknown = null
      try {
        body = await request.json()
      } catch {
        // validated below
      }
      const parsed = milestoneInputSchema.safeParse(body)
      if (!parsed.success) {
        return apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
            string,
            string[]
          >,
        })
      }
      const { milestone, at, note } = parsed.data
      const error = validateMilestone(
        history(row.id),
        milestone,
        new Date(at),
        new Date()
      )
      if (error) {
        const { field, message } = ERROR_KEYS[error]
        return apiError(422, `MILESTONE_${error}`, t(message), {
          fieldErrors: { [field]: [t(message)] },
        })
      }

      const iso = new Date(at).toISOString()
      addMilestone(
        workspaceId,
        row.id,
        milestone,
        iso,
        auth.user.id,
        note ?? null
      )
      const values = {
        ...row.values,
        status: milestone,
        ...(milestone === "DEPARTED" ? { atd: iso.slice(0, 10) } : {}),
        ...(milestone === "ARRIVED" ? { ata: iso.slice(0, 10) } : {}),
        updatedAt: new Date().toISOString(),
      }
      db.records.update(row.id, {
        values: shipmentHook(values, { workspaceId, isNew: false }),
      })
      dispatchMessageEvent(workspaceId, {
        type: "shipment.milestone",
        objectKey: "shipment",
        recordId: row.id,
        data: { milestone },
      })
      return HttpResponse.json(listResponse(row.id), { status: 201 })
    })
  ),
]
