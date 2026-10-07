import { z } from "zod"

import { MILESTONES, TRANSPORT_MODES } from "../lib/constants"
import { locationSchema } from "./reference.schemas"

/** Aggregates of `GET /api/dashboard/forwarding` (B3.7), in `currency`. */
export const forwardingDashboardSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  currency: z.string(),
  openRequests: z.object({
    total: z.number().int(),
    byStage: z.array(z.object({ stage: z.string(), count: z.number().int() })),
  }),
  winRate: z.object({
    accepted: z.number().int(),
    decided: z.number().int(),
    rate: z.number().nullable(),
  }),
  monthly: z.array(
    z.object({
      month: z.string(),
      revenue: z.number(),
      cost: z.number(),
      margin: z.number(),
    })
  ),
  shipmentsByStatus: z.array(
    z.object({ status: z.enum(MILESTONES), count: z.number().int() })
  ),
  topLanes: z.array(
    z.object({
      mode: z.enum(TRANSPORT_MODES),
      origin: locationSchema,
      destination: locationSchema,
      quotes: z.number().int(),
      accepted: z.number().int(),
    })
  ),
  delayed: z.array(
    z.object({
      id: z.string(),
      shipmentNumber: z.string(),
      customer: z.string().nullable(),
      eta: z.string(),
      days: z.number().int(),
    })
  ),
  reps: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      quotes: z.number().int(),
      accepted: z.number().int(),
      revenue: z.number(),
    })
  ),
})
export type ForwardingDashboard = z.infer<typeof forwardingDashboardSchema>
