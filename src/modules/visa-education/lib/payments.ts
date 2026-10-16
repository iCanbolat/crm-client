import { roundMoney } from "@/lib/currency"

import { addMonths } from "./passport"
import type { Money } from "./commission"
import type { PaymentStatus } from "./constants"

/**
 * Service fee instalments (B8.8). Kept deliberately simple: no invoices,
 * one currency per plan, partial payments allowed.
 */

export interface Installment {
  id: string
  label: string
  /** `yyyy-MM-dd` */
  dueDate: string
  amount: number
  paidAmount: number
  /** `yyyy-MM-dd` of the last payment. */
  paidAt: string | null
  method: "cash" | "transfer" | "card" | null
  note?: string | null
}

export interface PaymentPlanLike {
  serviceFee: Money
  installments: Installment[]
}

export type PlanIssue =
  | { code: "PLAN_TOTAL_MISMATCH"; expected: number; actual: number }
  | { code: "DUE_DATES_ORDER" }
  | { code: "AMOUNT_INVALID" }
  | { code: "OVERPAID" }

export function validatePlan(plan: PaymentPlanLike): PlanIssue | null {
  if (plan.serviceFee.amount <= 0) return { code: "AMOUNT_INVALID" }
  let previous = ""
  for (const item of plan.installments) {
    if (!(item.amount > 0)) return { code: "AMOUNT_INVALID" }
    if (item.paidAmount > item.amount + 0.001) return { code: "OVERPAID" }
    if (item.dueDate < previous) return { code: "DUE_DATES_ORDER" }
    previous = item.dueDate
  }
  const total = roundMoney(
    plan.installments.reduce((sum, item) => sum + item.amount, 0)
  )
  if (Math.abs(total - plan.serviceFee.amount) > 0.001) {
    return {
      code: "PLAN_TOTAL_MISMATCH",
      expected: plan.serviceFee.amount,
      actual: total,
    }
  }
  return null
}

export const isInstallmentPaid = (item: Installment) =>
  item.paidAmount + 0.001 >= item.amount

export interface PlanSummary {
  currency: string
  total: number
  paid: number
  outstanding: number
  overdueAmount: number
  overdueCount: number
  nextDueDate: string | null
  status: PaymentStatus
}

export function planSummary(
  plan: PaymentPlanLike | null | undefined,
  today: string
): PlanSummary {
  if (!plan || plan.installments.length === 0) {
    return {
      currency: plan?.serviceFee.currency ?? "TRY",
      total: plan?.serviceFee.amount ?? 0,
      paid: 0,
      outstanding: plan?.serviceFee.amount ?? 0,
      overdueAmount: 0,
      overdueCount: 0,
      nextDueDate: null,
      status: "none",
    }
  }
  let paid = 0
  let overdueAmount = 0
  let overdueCount = 0
  let nextDueDate: string | null = null
  for (const item of plan.installments) {
    paid += item.paidAmount
    if (isInstallmentPaid(item)) continue
    if (item.dueDate < today) {
      overdueAmount += item.amount - item.paidAmount
      overdueCount += 1
    }
    if (!nextDueDate || item.dueDate < nextDueDate) nextDueDate = item.dueDate
  }
  const total = plan.serviceFee.amount
  const outstanding = roundMoney(Math.max(0, total - paid))
  return {
    currency: plan.serviceFee.currency,
    total,
    paid: roundMoney(paid),
    outstanding,
    overdueAmount: roundMoney(overdueAmount),
    overdueCount,
    nextDueDate,
    status:
      outstanding <= 0.001 ? "paid" : overdueCount > 0 ? "overdue" : "on_track",
  }
}

/**
 * Splits a fee into `count` monthly instalments; rounding cents go to the
 * last one so the total always matches.
 */
export function splitEvenly(
  fee: Money,
  count: number,
  firstDue: string,
  intervalMonths = 1
): Omit<Installment, "id">[] {
  const n = Math.max(1, Math.floor(count))
  const base = Math.floor((fee.amount / n) * 100) / 100
  return Array.from({ length: n }, (_, index) => ({
    label: String(index + 1),
    dueDate: addMonths(firstDue, index * intervalMonths),
    amount: index === n - 1 ? roundMoney(fee.amount - base * (n - 1)) : base,
    paidAmount: 0,
    paidAt: null,
    method: null,
  }))
}
