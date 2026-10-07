/** Reference lists of the workspace profile (onboarding step 1). */

export const COUNTRY_CODES = [
  "TR",
  "DE",
  "NL",
  "BE",
  "GB",
  "FR",
  "IT",
  "ES",
  "PL",
  "RO",
  "BG",
  "GR",
  "AZ",
  "GE",
  "UZ",
  "KZ",
  "AE",
  "SA",
  "EG",
  "CN",
  "IN",
  "JP",
  "KR",
  "US",
] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

export { CURRENCIES, type Currency } from "@/lib/currencies"

export const TIMEZONES = [
  "Europe/Istanbul",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/London",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Baku",
  "Asia/Dubai",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const
export type Timezone = (typeof TIMEZONES)[number]

/** Sensible defaults for a Turkish forwarding company. */
export const COMPANY_DEFAULTS = {
  country: "TR",
  currency: "TRY",
  timezone: "Europe/Istanbul",
} as const

export function getCountryName(code: string, locale: string) {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
}

export function getCurrencyName(code: string, locale: string) {
  const name =
    new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code
  return `${code} — ${name}`
}

export function formatTimezone(timezone: string) {
  return timezone.replaceAll("_", " ")
}
