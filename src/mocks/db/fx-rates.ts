/** Units of each currency per 1 USD on the mock reference date. */
export const FX_RATES = {
  base: "USD" as const,
  date: "2026-10-01",
  rates: {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    TRY: 41.5,
    CNY: 7.12,
    CAD: 1.37,
    AUD: 1.52,
    CHF: 0.86,
  },
}
