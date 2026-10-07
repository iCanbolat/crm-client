/** Exchange rates as units of each currency per 1 USD (`{ USD: 1, EUR: 0.92 }`). */
export type FxRates = Record<string, number>

export class UnknownCurrencyError extends Error {
  readonly currency: string
  constructor(currency: string) {
    super(`[forwarding] no exchange rate for ${currency}`)
    this.currency = currency
  }
}

/** Half-up rounding to cents that survives binary float noise. */
export function roundMoney(value: number) {
  return (
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100)
  )
}

/** Converts through USD (cross rate), rounded to cents. */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: FxRates
) {
  if (from === to) return roundMoney(amount)
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate) throw new UnknownCurrencyError(from)
  if (!toRate) throw new UnknownCurrencyError(to)
  return roundMoney((amount / fromRate) * toRate)
}
