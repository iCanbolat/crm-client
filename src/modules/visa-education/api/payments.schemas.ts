import { z } from "zod"

import { PAYMENT_METHODS, PAYMENT_STATUSES } from "../lib/constants"

/** Service-fee payment plan of an application (B8.8). */

const money = z.object({
  amount: z.number(),
  currency: z.string().regex(/^[A-Z]{3}$/),
})

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const installmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  dueDate: day,
  amount: z.number(),
  paidAmount: z.number(),
  paidAt: day.nullable(),
  method: z.enum(PAYMENT_METHODS).nullable(),
  note: z.string().nullable().optional(),
})
export type InstallmentDto = z.infer<typeof installmentSchema>

export const planSummarySchema = z.object({
  currency: z.string(),
  total: z.number(),
  paid: z.number(),
  outstanding: z.number(),
  overdueAmount: z.number(),
  overdueCount: z.number(),
  nextDueDate: z.string().nullable(),
  status: z.enum(PAYMENT_STATUSES),
})

export const paymentPlanResponseSchema = z.object({
  plan: z
    .object({
      serviceFee: money,
      installments: z.array(installmentSchema),
      updatedAt: z.string(),
    })
    .nullable(),
  summary: planSummarySchema,
})
export type PaymentPlanResponse = z.infer<typeof paymentPlanResponseSchema>

export const paymentPlanInputSchema = z.object({
  serviceFee: z.object({
    amount: z.number().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  installments: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().trim().min(1).max(40),
        dueDate: day,
        amount: z.number().positive(),
        note: z.string().max(200).nullable().optional(),
      })
    )
    .min(1)
    .max(24),
})
export type PaymentPlanInput = z.infer<typeof paymentPlanInputSchema>

export const paymentInputSchema = z.object({
  amount: z.number().positive(),
  paidAt: day,
  method: z.enum(PAYMENT_METHODS),
})
export type PaymentInput = z.infer<typeof paymentInputSchema>
