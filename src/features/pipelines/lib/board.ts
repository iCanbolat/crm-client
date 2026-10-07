import type { MoneyValue } from "@/engine/field-types"
import type { CrmRecord, ObjectDef, RecordValues } from "@/engine/metadata"

import type { Board, MoneyTotal } from "../api/pipelines.schemas"

function toMoney(value: unknown): MoneyValue | null {
  if (typeof value !== "object" || value === null) return null
  const { amount, currency } = value as Partial<MoneyValue>
  return typeof amount === "number" && typeof currency === "string"
    ? { amount, currency }
    : null
}

/** Sums the amount field per currency (largest total first). */
export function sumByCurrency(
  records: readonly { values: RecordValues }[],
  amountField: string | undefined
): MoneyTotal[] {
  if (!amountField) return []
  const totals = new Map<string, number>()
  for (const record of records) {
    const money = toMoney(record.values[amountField])
    if (!money) continue
    totals.set(money.currency, (totals.get(money.currency) ?? 0) + money.amount)
  }
  return Array.from(totals, ([currency, amount]) => ({
    currency,
    amount,
  })).sort((a, b) => b.amount - a.amount)
}

function adjustTotals(
  totals: MoneyTotal[],
  money: MoneyValue | null,
  sign: 1 | -1
): MoneyTotal[] {
  if (!money) return totals
  const existing = totals.find((item) => item.currency === money.currency)
  const next = existing
    ? totals.map((item) =>
        item.currency === money.currency
          ? { ...item, amount: item.amount + sign * money.amount }
          : item
      )
    : sign > 0
      ? [...totals, { currency: money.currency, amount: money.amount }]
      : totals
  return next.filter((item) => Math.abs(item.amount) > 1e-9)
}

/**
 * Optimistic board update: moves a card to another stage column and keeps
 * counts and currency totals consistent. Unknown cards/stages are a no-op.
 */
export function moveCard(
  board: Board,
  objectDef: ObjectDef,
  recordId: string,
  toStage: string,
  values: RecordValues = {}
): Board {
  const pipeline = objectDef.pipeline
  if (!pipeline) return board
  const from = board.columns.find((column) =>
    column.records.some((record) => record.id === recordId)
  )
  const target = board.columns.find((column) => column.stage === toStage)
  if (!from || !target || from.stage === toStage) return board

  const card = from.records.find((record) => record.id === recordId)!
  const moved: CrmRecord = {
    ...card,
    values: { ...card.values, ...values, [pipeline.field]: toStage },
  }
  const amount = pipeline.amountField
    ? toMoney(card.values[pipeline.amountField])
    : null

  return {
    columns: board.columns.map((column) => {
      if (column.stage === from.stage) {
        return {
          ...column,
          count: column.count - 1,
          totals: adjustTotals(column.totals, amount, -1),
          records: column.records.filter((record) => record.id !== recordId),
        }
      }
      if (column.stage === toStage) {
        return {
          ...column,
          count: column.count + 1,
          totals: adjustTotals(column.totals, amount, 1),
          records: [moved, ...column.records],
        }
      }
      return column
    }),
  }
}

export function findCard(board: Board, recordId: string) {
  for (const column of board.columns) {
    const record = column.records.find((item) => item.id === recordId)
    if (record) return { record, stage: column.stage }
  }
  return undefined
}
