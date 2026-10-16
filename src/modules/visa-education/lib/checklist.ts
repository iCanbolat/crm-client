import type { I18nText } from "@/lib/i18n-text"

import { addDays } from "./passport"
import type { ChecklistStatus } from "./constants"

/** Stored checklist item (API contract mirrors it, B8.7). */
export interface ChecklistItemLike {
  key: string
  label: I18nText | string
  required: boolean
  status: ChecklistStatus
  /** Date the document was issued / valid until checks (`yyyy-MM-dd`). */
  expiresAt?: string | null
  maxAgeDays?: number | null
  /** Date the file was received (`yyyy-MM-dd`); used for `maxAgeDays`. */
  documentDate?: string | null
}

/** Approved or not applicable: nothing left to do for the item. */
export const isItemComplete = (item: Pick<ChecklistItemLike, "status">) =>
  item.status === "approved" || item.status === "not_applicable"

/** Expired (`expiresAt` passed) or too old (`maxAgeDays`) documents. */
export function isItemOutdated(item: ChecklistItemLike, today: string) {
  if (item.status !== "received" && item.status !== "approved") return false
  if (item.expiresAt && item.expiresAt < today) return true
  if (item.maxAgeDays && item.documentDate) {
    return addDays(item.documentDate, item.maxAgeDays) < today
  }
  return false
}

export interface ChecklistSummary<T> {
  total: number
  required: number
  complete: number
  /** Required items that are not complete yet. */
  missing: T[]
  /** Received / approved documents that expired or got too old. */
  outdated: T[]
  /** Share of complete required items (0…1; 1 when nothing is required). */
  progress: number
}

export function summarizeChecklist<T extends ChecklistItemLike>(
  items: readonly T[],
  today: string
): ChecklistSummary<T> {
  const required = items.filter((item) => item.required)
  const complete = required.filter(isItemComplete)
  return {
    total: items.length,
    required: required.length,
    complete: complete.length,
    missing: required.filter((item) => !isItemComplete(item)),
    outdated: items.filter((item) => isItemOutdated(item, today)),
    progress: required.length ? complete.length / required.length : 1,
  }
}

/** A file may be submitted once every required item is done and current. */
export function isChecklistReady(
  items: readonly ChecklistItemLike[],
  today: string
) {
  const summary = summarizeChecklist(items, today)
  return (
    summary.missing.length === 0 &&
    !summary.outdated.some((item) => item.required)
  )
}
