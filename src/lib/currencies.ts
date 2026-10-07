export const CURRENCIES = ["TRY", "USD", "EUR", "GBP", "CNY"] as const
export type Currency = (typeof CURRENCIES)[number]

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.includes(value as Currency)
}

export function formatMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Unknown ISO code: fall back to "1.234,50 XYZ".
    return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`
  }
}
