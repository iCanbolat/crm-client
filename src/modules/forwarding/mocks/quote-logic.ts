import type { RecordValues } from "@/engine/metadata"

import type { QuoteInput } from "../api/quotes.schemas"
import type { QuoteStatus } from "../lib/constants"
import type { FxRates } from "../lib/currency"
import { calcQuoteTotals } from "../lib/quote"

/** Selected option and its totals in the quote currency. */
export function summarizeQuote(document: QuoteInput, rates: FxRates) {
  const option =
    document.options.find((item) => item.id === document.selectedOptionId) ??
    document.options[0]!
  const totals = calcQuoteTotals(option.lines, document.currency, rates)
  return { option, totals }
}

export interface QuoteMeta {
  quoteNumber: string
  status: QuoteStatus
  version: number
  ownerId: string
  createdAt: string
  updatedAt: string
  sentAt?: string | null
  shipmentId?: string | null
  tags?: string[] | null
}

/** Header record (`quote` object) mirroring the current version. */
export function quoteRecordValues(
  document: QuoteInput,
  meta: QuoteMeta,
  rates: FxRates
): RecordValues {
  const { option, totals } = summarizeQuote(document, rates)
  return {
    quoteNumber: meta.quoteNumber,
    status: meta.status,
    version: meta.version,
    companyId: document.companyId,
    contactId: document.contactId ?? null,
    dealId: document.dealId ?? null,
    leadId: document.leadId ?? null,
    transportMode: document.transportMode,
    origin: document.origin,
    destination: document.destination,
    incoterm: document.incoterm ?? null,
    currency: document.currency,
    validUntil: document.validUntil,
    carrier: option.carrier,
    transitDays: option.transitDays ?? null,
    totalSell: { amount: totals.sell, currency: document.currency },
    totalBuy: { amount: totals.buy, currency: document.currency },
    marginPercent: totals.margin.percent,
    sentAt: meta.sentAt ?? null,
    shipmentId: meta.shipmentId ?? null,
    notes: document.notes ?? null,
    ownerId: meta.ownerId,
    tags: meta.tags ?? null,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  }
}

/** Next `Q-2026-0042` / `SHP-2026-0042` number of a workspace. */
export function nextNumber(
  prefix: string,
  existing: readonly unknown[],
  year: number
) {
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`)
  const max = existing.reduce<number>((highest, value) => {
    const match = typeof value === "string" ? pattern.exec(value) : null
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`
}
