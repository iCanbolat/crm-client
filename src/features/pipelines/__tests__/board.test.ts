import { KeyboardCode } from "@dnd-kit/core"
import { describe, expect, it } from "vitest"

import type { ObjectDef } from "@/engine/metadata"
import { dealObject } from "@/features/records/mocks/core-objects"

import type { Board } from "../api/pipelines.schemas"
import { findCard, moveCard, sumByCurrency } from "../lib/board"
import { columnCoordinateGetter } from "../lib/keyboard"

const deal: ObjectDef = dealObject()

const card = (
  id: string,
  stage: string,
  amount?: number,
  currency = "EUR"
) => ({
  id,
  values: {
    name: id,
    stage,
    ...(amount ? { amount: { amount, currency } } : {}),
  },
  refs: {},
})

function board(): Board {
  return {
    columns: [
      {
        stage: "qualification",
        count: 3,
        totals: [{ currency: "EUR", amount: 300 }],
        records: [
          card("a", "qualification", 100),
          card("b", "qualification", 200),
        ],
      },
      { stage: "proposal", count: 0, totals: [], records: [] },
      {
        stage: "lost",
        count: 1,
        totals: [{ currency: "USD", amount: 50 }],
        records: [card("c", "lost", 50, "USD")],
      },
    ],
  }
}

describe("board helpers (B2.5)", () => {
  it("sums amounts per currency, largest first", () => {
    expect(
      sumByCurrency(
        [
          card("1", "x", 100),
          card("2", "x", 50, "USD"),
          card("3", "x", 25),
          card("4", "x"),
        ],
        "amount"
      )
    ).toEqual([
      { currency: "EUR", amount: 125 },
      { currency: "USD", amount: 50 },
    ])
    expect(sumByCurrency([card("1", "x", 1)], undefined)).toEqual([])
  })

  it("moves a card optimistically with counts and totals", () => {
    const next = moveCard(board(), deal, "a", "proposal")
    const [from, to] = next.columns

    expect(from!.records.map((item) => item.id)).toEqual(["b"])
    expect(from!.count).toBe(2)
    expect(from!.totals).toEqual([{ currency: "EUR", amount: 200 }])
    expect(to!.records[0]).toMatchObject({
      id: "a",
      values: { stage: "proposal" },
    })
    expect(to!.count).toBe(1)
    expect(to!.totals).toEqual([{ currency: "EUR", amount: 100 }])
  })

  it("merges stage gate values into the moved card", () => {
    const next = moveCard(board(), deal, "b", "lost", { lostReason: "price" })
    const lost = next.columns[2]!
    expect(lost.records[0]!.values).toMatchObject({
      stage: "lost",
      lostReason: "price",
    })
    expect(lost.totals).toEqual([
      { currency: "USD", amount: 50 },
      { currency: "EUR", amount: 200 },
    ])
  })

  it("ignores unknown cards, unknown stages and same-stage moves", () => {
    const original = board()
    expect(moveCard(original, deal, "zzz", "proposal")).toBe(original)
    expect(moveCard(original, deal, "a", "nope")).toBe(original)
    expect(moveCard(original, deal, "a", "qualification")).toBe(original)
    expect(
      moveCard(original, { ...deal, pipeline: undefined }, "a", "proposal")
    ).toBe(original)
    expect(findCard(original, "c")).toMatchObject({ stage: "lost" })
    expect(findCard(original, "zzz")).toBeUndefined()
  })

  it("TC-2.5-04 arrow keys jump the dragged card to the next/previous column", () => {
    const rect = (left: number) => ({
      left,
      top: 100,
      width: 280,
      height: 600,
      right: left + 280,
      bottom: 700,
    })
    const droppableRects = new Map([
      ["qualification", rect(0)],
      ["proposal", rect(300)],
      ["lost", rect(600)],
    ])
    const context = {
      collisionRect: {
        left: 10,
        top: 150,
        width: 260,
        height: 80,
        right: 270,
        bottom: 230,
      },
      droppableRects,
      droppableContainers: {
        getEnabled: () => [...droppableRects.keys()].map((id) => ({ id })),
      },
    }
    const press = (code: string) =>
      columnCoordinateGetter(
        { code, preventDefault: () => {} } as unknown as KeyboardEvent,
        { context, active: "a", currentCoordinates: { x: 10, y: 150 } } as never
      )

    expect(press(KeyboardCode.Right)).toEqual({ x: 310, y: 164 })
    expect(press(KeyboardCode.Left)).toBeUndefined()
    expect(press(KeyboardCode.Down)).toBeUndefined()

    context.collisionRect = { ...context.collisionRect, left: 610, right: 870 }
    expect(press(KeyboardCode.Left)).toEqual({ x: 310, y: 164 })
    expect(press(KeyboardCode.Right)).toBeUndefined()
  })
})
