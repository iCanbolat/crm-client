import { resolveI18nText } from "@/lib/i18n-text"

import { MONTH_LABELS } from "./constants"

/** Start term of a programme: `{ year: 2027, month: 9 }` = September 2027. */
export interface IntakeValue {
  year: number
  month: number
}

export function toIntake(value: unknown): IntakeValue | null {
  if (typeof value !== "object" || value === null) return null
  const { year, month } = value as Partial<IntakeValue>
  return Number.isInteger(year) &&
    Number.isInteger(month) &&
    month! >= 1 &&
    month! <= 12
    ? { year: year!, month: month! }
    : null
}

/** "Eylül 2027" / "September 2027" */
export function formatIntake(value: IntakeValue, language: string) {
  const month = MONTH_LABELS[value.month - 1]
  return `${month ? resolveI18nText(month, language === "en" ? "en" : "tr") : value.month} ${value.year}`
}

export function compareIntake(a: IntakeValue, b: IntakeValue) {
  return a.year - b.year || a.month - b.month
}

/** Sortable number: 202709. */
export function intakeKey(value: IntakeValue) {
  return value.year * 100 + value.month
}

/** First day of the intake month (`yyyy-MM-01`). */
export function intakeStartDate(value: IntakeValue) {
  return `${value.year}-${String(value.month).padStart(2, "0")}-01`
}
