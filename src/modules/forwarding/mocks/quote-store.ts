import type { RecordValues } from "@/engine/metadata"
import {
  findRecordRow,
  getObjectDef,
  getRecordRef,
  recordsOf,
} from "@/features/records/mocks/store"
import type { RecordRow } from "@/features/records/mocks/factory"
import { db } from "@/mocks/db"

import type { Quote, QuoteDraft, QuoteInput } from "../api/quotes.schemas"
import { locationSchema } from "../api/reference.schemas"
import { calcCbm, calcChargeableWeight } from "../lib/cargo"
import { isTransportMode } from "../lib/constants"
import { isExpired } from "../lib/quote"
import { nextNumber, quoteRecordValues, summarizeQuote } from "./quote-logic"
import { FX_RATES } from "./reference/carriers"
import type { QuoteVersionRow } from "./types"

/** Local calendar day of the server ("today" of quote validity). */
export const today = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function findQuote(workspaceId: string, quoteId: string) {
  return findRecordRow(workspaceId, "quote", quoteId)
}

export function quoteVersions(quoteId: string) {
  return db.quoteVersions
    .findMany((row) => row.quoteId === quoteId)
    .sort((a, b) => a.version - b.version)
}

export function latestVersion(quoteId: string) {
  return quoteVersions(quoteId).at(-1)
}

/**
 * Validity is checked when a quote is read: a sent quote past its
 * `validUntil` becomes "expired" for good (TC-3.4-05).
 */
export function expireIfDue(row: RecordRow): RecordRow {
  const latest = latestVersion(row.id)
  if (!latest) return row
  if (!isExpired(latest.status, latest.document.validUntil, today())) return row
  db.quoteVersions.update(latest.id, { status: "expired" })
  return db.records.update(row.id, {
    values: {
      ...row.values,
      status: "expired",
      updatedAt: new Date().toISOString(),
    },
  })!
}

/** Rewrites the header record from the latest version (totals, status…). */
export function syncQuoteRecord(
  row: RecordRow,
  version: QuoteVersionRow,
  extra: Partial<RecordValues> = {}
) {
  const values = quoteRecordValues(
    version.document,
    {
      quoteNumber: String(row.values.quoteNumber),
      status: version.status,
      version: version.version,
      ownerId: String(row.values.ownerId),
      createdAt: String(row.values.createdAt),
      updatedAt: new Date().toISOString(),
      sentAt: (row.values.sentAt as string | null) ?? null,
      shipmentId: (row.values.shipmentId as string | null) ?? null,
      tags: (row.values.tags as string[] | null) ?? null,
    },
    FX_RATES.rates
  )
  return db.records.update(row.id, { values: { ...values, ...extra } })!
}

function refs(workspaceId: string, document: QuoteInput, shipmentId: unknown) {
  const ref = (objectKey: string, id: unknown) =>
    typeof id === "string" && id
      ? getRecordRef(workspaceId, objectKey, id)
      : null
  return {
    companyId: ref("company", document.companyId),
    contactId: ref("contact", document.contactId),
    dealId: ref("deal", document.dealId),
    leadId: ref("lead", document.leadId),
    shipmentId: ref("shipment", shipmentId),
  }
}

/** API shape of a quote at `version` (latest by default). */
export function toQuote(row: RecordRow, version?: number): Quote | null {
  const versions = quoteVersions(row.id)
  const latest = versions.at(-1)
  const current = version
    ? versions.find((item) => item.version === version)
    : latest
  if (!current || !latest) return null
  return {
    id: row.id,
    quoteNumber: String(row.values.quoteNumber),
    status: current.status,
    version: current.version,
    ...current.document,
    sentAt: (row.values.sentAt as string | null) ?? null,
    shipmentId: (row.values.shipmentId as string | null) ?? null,
    ownerId: String(row.values.ownerId),
    createdAt: String(row.values.createdAt),
    updatedAt: String(row.values.updatedAt),
    refs: refs(row.workspaceId, current.document, row.values.shipmentId),
    versions: versions.map((item) => ({
      version: item.version,
      status: item.status,
      createdAt: item.createdAt,
      currency: item.document.currency,
      totalSell: summarizeQuote(item.document, FX_RATES.rates).totals.sell,
    })),
    editable: current.version === latest.version && current.status === "draft",
  }
}

export function nextQuoteNumber(workspaceId: string) {
  return nextNumber(
    "Q",
    recordsOf(workspaceId, "quote").map((row) => row.values.quoteNumber),
    new Date().getFullYear()
  )
}

/** Relations of the document must exist in the tenant. */
export function invalidRelations(workspaceId: string, document: QuoteInput) {
  const errors: Record<string, string> = {}
  const check = (key: keyof QuoteInput, objectKey: string) => {
    const id = document[key]
    if (
      typeof id === "string" &&
      id &&
      !findRecordRow(workspaceId, objectKey, id)
    ) {
      errors[key] = objectKey
    }
  }
  check("companyId", "company")
  check("contactId", "contact")
  check("dealId", "deal")
  check("leadId", "lead")
  return Object.keys(errors)
}

const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

/**
 * Prefill of a new quote from a freight request and/or a deal (B3.4):
 * customer from the deal, route and cargo from the lead (or the deal).
 */
export function buildQuoteDraft(
  workspaceId: string,
  {
    leadId,
    dealId,
    companyId: companyParam,
  }: {
    leadId?: string | null
    dealId?: string | null
    companyId?: string | null
  }
): QuoteDraft {
  const lead = leadId ? findRecordRow(workspaceId, "lead", leadId) : undefined
  const deal = dealId ? findRecordRow(workspaceId, "deal", dealId) : undefined
  const company = companyParam
    ? findRecordRow(workspaceId, "company", companyParam)
    : undefined
  const companyId =
    company?.id ??
    (deal?.values.companyId as string | null) ??
    (lead?.values.convertedCompanyId as string | null) ??
    undefined
  const contactId =
    (deal?.values.contactId as string | null) ??
    (lead?.values.convertedContactId as string | null) ??
    undefined
  const source = lead?.values ?? deal?.values ?? {}
  const mode = isTransportMode(source.transportMode)
    ? source.transportMode
    : undefined
  const origin = locationSchema.safeParse(source.origin)
  const destination = locationSchema.safeParse(source.destination)
  const dimensions = Array.isArray(source.dimensions) ? source.dimensions : []
  const gross = num(source.grossWeight)
  const cbm = dimensions.length ? calcCbm(dimensions) : num(source.volume)
  const containers = Array.isArray(source.containers) ? source.containers : null

  const draft: QuoteDraft = {
    companyId,
    contactId,
    dealId:
      deal?.id ?? (lead?.values.convertedDealId as string | null) ?? undefined,
    leadId: lead?.id,
    transportMode: mode,
    origin: origin.success ? origin.data : undefined,
    destination: destination.success ? destination.data : undefined,
    incoterm: (source.incoterm as string | null) ?? undefined,
    cargo: {
      commodity: (source.commodity as string | null) ?? null,
      containers,
      packageCount: num(source.packageCount),
      grossKg: gross,
      cbm,
      chargeableKg:
        mode && (gross !== null || cbm !== null)
          ? calcChargeableWeight(mode, gross ?? 0, cbm ?? 0).value
          : null,
    },
    refs: {},
  }
  const draftRefs: QuoteDraft["refs"] = {}
  for (const [key, objectKey] of [
    ["companyId", "company"],
    ["contactId", "contact"],
    ["dealId", "deal"],
    ["leadId", "lead"],
  ] as const) {
    const id = draft[key]
    if (typeof id === "string" && getObjectDef(workspaceId, objectKey)) {
      draftRefs[key] = getRecordRef(workspaceId, objectKey, id)
    }
  }
  draft.refs = draftRefs
  return draft
}
