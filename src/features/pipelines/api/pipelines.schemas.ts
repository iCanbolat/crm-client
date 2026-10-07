import { z } from "zod"

import type { Condition } from "@/engine/logic"
import { crmRecordSchema } from "@/engine/metadata"

/** Cards loaded per column; the count still covers every record. */
export const BOARD_COLUMN_LIMIT = 50

export const moneyTotalSchema = z.object({
  currency: z.string(),
  amount: z.number(),
})
export type MoneyTotal = z.infer<typeof moneyTotalSchema>

export const boardColumnSchema = z.object({
  stage: z.string(),
  count: z.number().int().min(0),
  /** Sum of the pipeline amount field, per currency. */
  totals: z.array(moneyTotalSchema),
  records: z.array(crmRecordSchema),
})
export type BoardColumn = z.infer<typeof boardColumnSchema>

export const boardResponseSchema = z.object({
  columns: z.array(boardColumnSchema),
})
export type Board = z.infer<typeof boardResponseSchema>

export interface BoardParams {
  q?: string
  filters?: Condition[]
}
