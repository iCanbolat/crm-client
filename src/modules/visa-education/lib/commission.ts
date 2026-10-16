import { roundMoney } from "@/lib/currency"

import type { CommissionBasis } from "./constants"

export interface Money {
  amount: number
  currency: string
}

export function toMoney(value: unknown): Money | null {
  if (typeof value !== "object" || value === null) return null
  const { amount, currency } = value as Partial<Money>
  return typeof amount === "number" &&
    Number.isFinite(amount) &&
    typeof currency === "string"
    ? { amount, currency }
    : null
}

export interface CommissionInput {
  /** Yearly tuition. */
  tuition: Money | null
  /** Yearly scholarship / discount (same currency as the tuition). */
  scholarship?: Money | null
  /** Percent (15 = 15 %). */
  rate?: number | null
  basis?: CommissionBasis | null
  flat?: Money | null
  /** Programme length; full-tuition basis multiplies by its years. */
  durationMonths?: number | null
}

/**
 * Commission the school owes the agency for an enrolment (B8.5):
 * net tuition (tuition − scholarship) × rate, for the first year or the
 * whole programme, or a flat fee.
 */
export function computeCommission(input: CommissionInput): Money | null {
  if (input.basis === "flat") return input.flat ? { ...input.flat } : null
  const tuition = input.tuition
  if (!tuition || typeof input.rate !== "number" || input.rate <= 0) {
    return null
  }
  const scholarship =
    input.scholarship && input.scholarship.currency === tuition.currency
      ? input.scholarship.amount
      : 0
  const yearly = Math.max(0, tuition.amount - scholarship)
  const years =
    input.basis === "full_tuition"
      ? Math.max(1, Math.ceil((input.durationMonths ?? 12) / 12))
      : 1
  return {
    amount: roundMoney(yearly * years * (input.rate / 100)),
    currency: tuition.currency,
  }
}
