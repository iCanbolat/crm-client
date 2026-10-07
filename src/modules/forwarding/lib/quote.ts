import type {
  ChargeCode,
  QuoteStatus,
  TransportMode,
  UnitBasis,
} from "./constants"
import { MIN_MARGIN_PERCENT } from "./constants"
import { convertCurrency, roundMoney, type FxRates } from "./currency"

/** One charge of a quote option (plan B3.4). Prices are per unit. */
export interface QuoteLine {
  id: string
  code: ChargeCode
  description?: string | null
  basis: UnitBasis
  quantity: number
  buyPrice: number
  sellPrice: number
  currency: string
}

/** A carrier alternative offered to the customer. */
export interface QuoteOption {
  id: string
  carrier: string
  transitDays?: number | null
  lines: QuoteLine[]
}

/** Measures that drive suggested line quantities. */
export interface QuoteCargo {
  mode?: TransportMode | null
  containerCount?: number | null
  grossKg?: number | null
  cbm?: number | null
  chargeableKg?: number | null
}

const round = (value: number, digits = 3) => {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Quantity a new line of `basis` starts with, derived from the cargo. */
export function calcLineQuantity(basis: UnitBasis, cargo: QuoteCargo) {
  const gross = cargo.grossKg ?? 0
  const cbm = cargo.cbm ?? 0
  switch (basis) {
    case "container":
      return Math.max(cargo.containerCount ?? 1, 1)
    case "kg":
      return round(cargo.chargeableKg ?? gross, 2)
    case "cbm":
      return round(cbm)
    case "wm":
      return round(Math.max(gross / 1000, cbm, 1))
    case "shipment":
      return 1
  }
}

export function calcLine(
  line: Pick<QuoteLine, "quantity" | "buyPrice" | "sellPrice">
) {
  const buy = roundMoney(line.quantity * line.buyPrice)
  const sell = roundMoney(line.quantity * line.sellPrice)
  return { buy, sell, profit: roundMoney(sell - buy) }
}

export interface Margin {
  amount: number
  /** Profit over the selling price (gross margin), 2 decimals. */
  percent: number
}

export function calcMargin(buy: number, sell: number): Margin {
  const amount = roundMoney(sell - buy)
  const percent = sell > 0 ? Math.round((amount / sell) * 10_000) / 100 : 0
  return { amount, percent }
}

export function isMarginLow(margin: Margin, threshold = MIN_MARGIN_PERCENT) {
  return margin.percent < threshold
}

export interface CurrencyTotal {
  currency: string
  buy: number
  sell: number
}

export interface QuoteTotals {
  /** Sums in each line currency, sorted by currency code. */
  byCurrency: CurrencyTotal[]
  /** Everything converted to the quote currency. */
  currency: string
  buy: number
  sell: number
  margin: Margin
}

export function calcQuoteTotals(
  lines: readonly QuoteLine[],
  currency: string,
  rates: FxRates
): QuoteTotals {
  const sums = new Map<string, CurrencyTotal>()
  for (const line of lines) {
    const { buy, sell } = calcLine(line)
    const current = sums.get(line.currency) ?? {
      currency: line.currency,
      buy: 0,
      sell: 0,
    }
    sums.set(line.currency, {
      currency: line.currency,
      buy: roundMoney(current.buy + buy),
      sell: roundMoney(current.sell + sell),
    })
  }
  const byCurrency = [...sums.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency)
  )
  // Convert the per-currency sums (not each line) to keep rounding stable.
  const buy = roundMoney(
    byCurrency.reduce(
      (sum, item) =>
        sum + convertCurrency(item.buy, item.currency, currency, rates),
      0
    )
  )
  const sell = roundMoney(
    byCurrency.reduce(
      (sum, item) =>
        sum + convertCurrency(item.sell, item.currency, currency, rates),
      0
    )
  )
  return { byCurrency, currency, buy, sell, margin: calcMargin(buy, sell) }
}

/* ------------------------------------------------------------ status flow */

export const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
}

export function canTransition(from: QuoteStatus, to: QuoteStatus) {
  return QUOTE_TRANSITIONS[from].includes(to)
}

/** A sent (not yet answered) quote may be revised; so may a lost one. */
export function canRevise(status: QuoteStatus) {
  return status === "sent" || status === "rejected" || status === "expired"
}

/** `validUntil` and `today` are ISO dates (`yyyy-MM-dd`). */
export function isExpired(
  status: QuoteStatus,
  validUntil: string | null | undefined,
  today: string
) {
  return status === "sent" && !!validUntil && validUntil < today
}

/** `Q-2026-0042` */
export function formatQuoteNumber(year: number, sequence: number) {
  return `Q-${year}-${String(sequence).padStart(4, "0")}`
}
