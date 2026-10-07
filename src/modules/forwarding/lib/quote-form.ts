import type { Quote, QuoteDraft, QuoteInput } from "../api/quotes.schemas"
import type { ChargeCode, TransportMode, UnitBasis } from "./constants"
import {
  calcLineQuantity,
  type QuoteCargo,
  type QuoteLine,
  type QuoteOption,
} from "./quote"

export const newId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`

/** Typical charges a forwarder starts a quote of `mode` with. */
const DEFAULT_CHARGES: Record<TransportMode, [ChargeCode, UnitBasis][]> = {
  SEA_FCL: [
    ["OFR", "container"],
    ["BAF", "container"],
    ["THC_O", "container"],
    ["DOC", "shipment"],
  ],
  SEA_LCL: [
    ["OFR", "wm"],
    ["THC_O", "wm"],
    ["DOC", "shipment"],
  ],
  AIR: [
    ["AFR", "kg"],
    ["PRE_CARRIAGE", "shipment"],
    ["DOC", "shipment"],
  ],
  ROAD_FTL: [
    ["RFR", "shipment"],
    ["CUSTOMS", "shipment"],
  ],
  ROAD_LTL: [
    ["RFR", "kg"],
    ["CUSTOMS", "shipment"],
  ],
  RAIL: [
    ["RFR", "container"],
    ["DOC", "shipment"],
  ],
  MULTIMODAL: [
    ["OFR", "container"],
    ["ON_CARRIAGE", "shipment"],
  ],
  COURIER: [["AFR", "kg"]],
}

export function cargoMeasures(
  input: Pick<QuoteInput, "transportMode" | "cargo">
): QuoteCargo {
  return {
    mode: input.transportMode,
    containerCount:
      input.cargo.containers?.reduce((sum, line) => sum + line.count, 0) ??
      null,
    grossKg: input.cargo.grossKg ?? null,
    cbm: input.cargo.cbm ?? null,
    chargeableKg: input.cargo.chargeableKg ?? null,
  }
}

export function newLine(
  code: ChargeCode,
  basis: UnitBasis,
  currency: string,
  cargo: QuoteCargo
): QuoteLine {
  return {
    id: newId("ln"),
    code,
    description: null,
    basis,
    quantity: calcLineQuantity(basis, cargo),
    buyPrice: 0,
    sellPrice: 0,
    currency,
  }
}

export function newOption(
  mode: TransportMode | undefined,
  currency: string,
  cargo: QuoteCargo
): QuoteOption {
  const charges = DEFAULT_CHARGES[mode ?? "SEA_FCL"]
  return {
    id: newId("opt"),
    carrier: "",
    transitDays: null,
    lines: charges.map(([code, basis]) =>
      newLine(code, basis, currency, cargo)
    ),
  }
}

const isoDay = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/** Builder values of a new quote: the prefill plus sensible defaults. */
export function draftToInput(draft: QuoteDraft, now = new Date()): QuoteInput {
  const currency = draft.currency ?? "USD"
  const base = {
    transportMode: draft.transportMode ?? "SEA_FCL",
    cargo: draft.cargo ?? {},
  }
  const option = newOption(base.transportMode, currency, cargoMeasures(base))
  return {
    companyId: draft.companyId ?? "",
    contactId: draft.contactId ?? null,
    dealId: draft.dealId ?? null,
    leadId: draft.leadId ?? null,
    transportMode: base.transportMode,
    origin: draft.origin as QuoteInput["origin"],
    destination: draft.destination as QuoteInput["destination"],
    incoterm: draft.incoterm ?? null,
    currency,
    validUntil:
      draft.validUntil ?? isoDay(new Date(now.getTime() + 30 * 86_400_000)),
    cargo: base.cargo,
    options: [option],
    selectedOptionId: option.id,
    notes: draft.notes ?? null,
  }
}

/** The editable document of a loaded quote. */
export function quoteToInput(quote: Quote): QuoteInput {
  return {
    companyId: quote.companyId,
    contactId: quote.contactId ?? null,
    dealId: quote.dealId ?? null,
    leadId: quote.leadId ?? null,
    transportMode: quote.transportMode,
    origin: quote.origin,
    destination: quote.destination,
    incoterm: quote.incoterm ?? null,
    currency: quote.currency,
    validUntil: quote.validUntil,
    cargo: quote.cargo,
    options: quote.options,
    selectedOptionId: quote.selectedOptionId,
    notes: quote.notes ?? null,
  }
}

/** Option letters: A, B, C… */
export const optionLetter = (index: number) => String.fromCharCode(65 + index)
