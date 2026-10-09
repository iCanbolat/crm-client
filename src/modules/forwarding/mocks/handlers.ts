import {
  dispatchMessageEvent,
  workspaceLanguage,
} from "@/features/messaging/mocks/dispatch"
import { registerReportBuilder } from "@/features/reports/mocks/registry"
import {
  onAttachmentAdded,
  onRecordSaved,
  registerRecordHook,
} from "@/features/records/mocks/store"

import { DOCUMENT_CATEGORY_LABELS } from "../lib/constants"

import { dashboardHandlers } from "./dashboard-handlers"
import { quoteHandlers } from "./quote-handlers"
import { referenceHandlers } from "./reference-handlers"
import {
  buildLaneProfit,
  buildQuoteFunnel,
  buildRepPerformance,
} from "./reports"
import { shipmentHandlers } from "./shipment-handlers"
import { shipmentHook } from "./shipment-store"

registerRecordHook("shipment", shipmentHook)

// Ready-made reports (B7.1) -------------------------------------------------

for (const [key, build] of [
  ["quoteFunnel", buildQuoteFunnel],
  ["laneProfit", buildLaneProfit],
  ["repPerformance", buildRepPerformance],
] as const) {
  registerReportBuilder({ key, moduleId: "forwarding", build })
}

// WhatsApp notifications of shipments (Faz 6) ------------------------------

/** ETA pushed back before arrival → "arrival date changed" (B6.5). */
onRecordSaved(({ workspaceId, objectKey, row, previous }) => {
  if (objectKey !== "shipment" || !previous) return
  const eta = row.values.eta
  const before = previous.eta
  if (typeof eta !== "string" || typeof before !== "string") return
  if (eta <= before || row.values.ata) return
  dispatchMessageEvent(workspaceId, {
    type: "shipment.delayed",
    objectKey,
    recordId: row.id,
    data: { eta },
  })
})

/** B/L or AWB uploaded → "your document is ready". */
onAttachmentAdded(({ workspaceId, objectKey, recordId, category }) => {
  if (objectKey !== "shipment" || (category !== "bl" && category !== "awb")) {
    return
  }
  const language = workspaceLanguage(workspaceId)
  dispatchMessageEvent(workspaceId, {
    type: "shipment.document",
    objectKey,
    recordId,
    data: {
      category,
      document: DOCUMENT_CATEGORY_LABELS[category][language],
    },
  })
})

/** Mock backend of the forwarding module (aggregated by `src/mocks`). */
export const forwardingHandlers = [
  ...referenceHandlers,
  ...quoteHandlers,
  ...shipmentHandlers,
  ...dashboardHandlers,
]
