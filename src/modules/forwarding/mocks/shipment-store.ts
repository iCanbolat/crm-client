import type { RecordValues } from "@/engine/metadata"
import { newRecordId, type RecordRow } from "@/features/records/mocks/factory"
import type { RecordHookContext } from "@/features/records/mocks/store"
import { recordsOf } from "@/features/records/mocks/store"
import { db } from "@/mocks/db"

import type { QuoteInput } from "../api/quotes.schemas"
import type { Milestone } from "../lib/constants"
import { getDelay } from "../lib/milestones"
import { nextNumber, summarizeQuote } from "./quote-logic"
import { today } from "./quote-store"
import { FX_RATES } from "./reference/carriers"

const day = (value: unknown) =>
  typeof value === "string" && value ? value.slice(0, 10) : null

/** Server-maintained shipment values: number, initial status, delay flag. */
export function shipmentHook(
  values: RecordValues,
  { workspaceId, isNew }: RecordHookContext
): RecordValues {
  const next = { ...values }
  if (isNew) {
    next.shipmentNumber ??= nextNumber(
      "SHP",
      recordsOf(workspaceId, "shipment").map(
        (row) => row.values.shipmentNumber
      ),
      new Date().getFullYear()
    )
    next.status ??= "BOOKED"
  }
  next.delayed =
    next.status !== "DELIVERED" &&
    getDelay(
      {
        etd: day(next.etd),
        eta: day(next.eta),
        atd: day(next.atd),
        ata: day(next.ata),
      },
      today()
    ).delayed
  return next
}

export function addMilestone(
  workspaceId: string,
  shipmentId: string,
  milestone: Milestone,
  at: string,
  createdBy: string,
  note: string | null = null
) {
  return db.milestones.create({
    id: `${shipmentId}-m${crypto.randomUUID().slice(0, 8)}`,
    workspaceId,
    shipmentId,
    milestone,
    at,
    note,
    createdBy,
  })
}

/** Booking created when a quote is accepted (TC-3.4-06). */
export function createShipmentFromQuote(
  workspaceId: string,
  quote: RecordRow,
  document: QuoteInput,
  userId: string
): RecordRow {
  const now = new Date()
  const { option } = summarizeQuote(document, FX_RATES.rates)
  const etd = new Date(now.getTime() + 7 * 86_400_000)
  const eta = new Date(etd.getTime() + (option.transitDays ?? 14) * 86_400_000)
  const values = shipmentHook(
    {
      mode: document.transportMode,
      origin: document.origin,
      destination: document.destination,
      etd: etd.toISOString().slice(0, 10),
      eta: eta.toISOString().slice(0, 10),
      atd: null,
      ata: null,
      customerId: document.companyId,
      contactId: document.contactId ?? null,
      shipperId: document.companyId,
      consigneeId: null,
      notifyPartyId: null,
      agentId: null,
      carrier: option.carrier,
      bookingRef: null,
      containers:
        document.transportMode === "SEA_FCL"
          ? (document.cargo.containers ?? null)
          : null,
      commodity: document.cargo.commodity ?? null,
      packageCount: document.cargo.packageCount ?? null,
      grossWeight: document.cargo.grossKg ?? null,
      volume: document.cargo.cbm ?? null,
      quoteId: quote.id,
      dealId: document.dealId ?? null,
      ownerId: String(quote.values.ownerId),
      tags: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    { workspaceId, isNew: true }
  )
  const row = db.records.create({
    id: newRecordId("shipment"),
    workspaceId,
    objectKey: "shipment",
    values,
  })
  addMilestone(workspaceId, row.id, "BOOKED", now.toISOString(), userId)
  return row
}
