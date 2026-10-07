/**
 * Countries known to the CRM (ISO 3166-1 alpha-2) with their calling codes.
 * Names are not stored: `Intl.DisplayNames` localizes them on the fly.
 */
export const COUNTRIES = [
  { code: "TR", dial: "90" },
  { code: "DE", dial: "49" },
  { code: "NL", dial: "31" },
  { code: "BE", dial: "32" },
  { code: "GB", dial: "44" },
  { code: "FR", dial: "33" },
  { code: "IT", dial: "39" },
  { code: "ES", dial: "34" },
  { code: "PT", dial: "351" },
  { code: "AT", dial: "43" },
  { code: "CH", dial: "41" },
  { code: "PL", dial: "48" },
  { code: "CZ", dial: "420" },
  { code: "HU", dial: "36" },
  { code: "RO", dial: "40" },
  { code: "BG", dial: "359" },
  { code: "GR", dial: "30" },
  { code: "UA", dial: "380" },
  { code: "RU", dial: "7" },
  { code: "AZ", dial: "994" },
  { code: "GE", dial: "995" },
  { code: "UZ", dial: "998" },
  { code: "KZ", dial: "7" },
  { code: "IR", dial: "98" },
  { code: "IQ", dial: "964" },
  { code: "AE", dial: "971" },
  { code: "SA", dial: "966" },
  { code: "QA", dial: "974" },
  { code: "EG", dial: "20" },
  { code: "MA", dial: "212" },
  { code: "IL", dial: "972" },
  { code: "CN", dial: "86" },
  { code: "HK", dial: "852" },
  { code: "IN", dial: "91" },
  { code: "JP", dial: "81" },
  { code: "KR", dial: "82" },
  { code: "SG", dial: "65" },
  { code: "VN", dial: "84" },
  { code: "US", dial: "1" },
  { code: "CA", dial: "1" },
  { code: "MX", dial: "52" },
  { code: "BR", dial: "55" },
] as const

export type CountryCode = (typeof COUNTRIES)[number]["code"]

export const COUNTRY_CODES = COUNTRIES.map((country) => country.code)

export function isCountryCode(value: unknown): value is CountryCode {
  return COUNTRY_CODES.includes(value as CountryCode)
}

export function getCountryName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
  } catch {
    return code
  }
}

/** "TR" → 🇹🇷 (regional indicator symbols). */
export function getCountryFlag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return ""
  return String.fromCodePoint(
    ...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
  )
}

export function getDialCode(code: string) {
  return COUNTRIES.find((country) => country.code === code)?.dial
}
