import { isSchengen } from "./constants"

/**
 * Passport validity rules (B8.2). Schengen: valid 3 months beyond the
 * return date and issued within the last 10 years; elsewhere (UK, US,
 * Canada, Australia…) the common 6 months beyond the stay.
 */

export interface PassportValue {
  number: string
  issuingCountry: string
  /** `yyyy-MM-dd` */
  issuedAt?: string | null
  /** `yyyy-MM-dd` */
  expiresAt: string
}

export type PassportValidity =
  "ok" | "expiresSoon" | "insufficient" | "expired" | "missing"

export function addMonths(date: string, months: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() + months)
  return value.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function monthsRequiredFor(destination: unknown) {
  return isSchengen(destination) ? 3 : 6
}

export interface PassportContext {
  today: string
  /** Destination country (ISO alpha-2); default 6-month rule when unknown. */
  destination?: string | null
  /** Planned return (or travel) date; defaults to today. */
  returnDate?: string | null
}

export function passportValidity(
  passport: PassportValue | null | undefined,
  { today, destination, returnDate }: PassportContext
): PassportValidity {
  if (!passport?.expiresAt) return "missing"
  if (passport.expiresAt < today) return "expired"
  const until = returnDate && returnDate > today ? returnDate : today
  if (passport.expiresAt < addMonths(until, monthsRequiredFor(destination))) {
    return "insufficient"
  }
  if (
    isSchengen(destination) &&
    passport.issuedAt &&
    passport.issuedAt < addMonths(until, -120)
  ) {
    return "insufficient"
  }
  return passport.expiresAt < addMonths(today, 6) ? "expiresSoon" : "ok"
}

/** "U••••••42" — numbers are masked everywhere but the input. */
export function maskPassportNumber(number: string) {
  if (number.length <= 3) return "•".repeat(number.length)
  return `${number[0]}${"•".repeat(number.length - 3)}${number.slice(-2)}`
}
