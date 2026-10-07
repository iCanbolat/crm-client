import { describe, expect, it } from "vitest"

import {
  compareComparables,
  evaluateOperator,
  getMissingGateFields,
  type Condition,
} from "@/engine/logic"
import {
  getEditableFields,
  getField,
  getFormSections,
  getObjectIcon,
  getOptionLabel,
  getRecordStage,
  getRecordTitle,
  getStageField,
  pickFields,
  toFieldKey,
} from "@/engine/metadata"
import {
  matchesConditions,
  matchesSearch,
  queryRecordValues,
} from "@/engine/records"

import { testObject } from "./fixtures"

const def = testObject()

const rows = [
  {
    id: "1",
    values: {
      name: "Acme Lojistik",
      email: "info@acme.test",
      count: 3,
      price: { amount: 500, currency: "EUR" },
      day: "2026-10-01",
      at: "2026-10-01T22:30:00.000Z",
      active: true,
      stage: "new",
      tags: ["vip"],
      country: "TR",
    },
  },
  {
    id: "2",
    values: {
      name: "Beta Ticaret",
      email: "satis@beta.test",
      count: 8,
      price: { amount: 1500, currency: "USD" },
      day: "2026-10-05",
      active: false,
      stage: "won",
      tags: ["hot", "vip"],
      country: "DE",
    },
  },
  {
    id: "3",
    values: {
      name: "Çınar Gıda",
      count: null,
      price: null,
      day: null,
      stage: "lost",
      tags: null,
      country: null,
    },
  },
]

const ids = (conditions: Condition[]) =>
  rows
    .filter((row) => matchesConditions(def, row.values, conditions))
    .map((row) => row.id)

describe("condition evaluator (engine/logic)", () => {
  it.each<[Parameters<typeof evaluateOperator>, boolean]>([
    [["eq", "Acme", "acme"], true],
    [["eq", null, "x"], false],
    [["neq", "Acme", "Beta"], true],
    [["neq", null, "x"], true],
    [["contains", "Acme Lojistik", "lojİstik"], true],
    [["notContains", "Acme", "beta"], true],
    [["startsWith", "Çınar", "çı"], true],
    [["gt", 5, 3], true],
    [["gte", 5, "5"], true],
    [["lt", 5, 3], false],
    [["lte", 3, 3], true],
    [["gt", null, 3], false],
    [["between", 5, [1, 10]], true],
    [["between", 5, [6, null]], false],
    [["between", 5, ["", 5]], true],
    [["between", null, [1, 2]], false],
    [["in", "won", ["won", "lost"]], true],
    [["in", ["vip", "hot"], ["hot"]], true],
    [["notIn", ["vip"], ["hot"]], true],
    [["notIn", null, ["hot"]], true],
    [["before", "2026-10-01T10:00:00Z", "2026-10-02"], true],
    [["after", "2026-10-05", "2026-10-02"], true],
    [["on", "2026-10-05T23:00:00.000Z", "2026-10-05"], true],
    [["on", null, "2026-10-05"], false],
    [["isEmpty", [], undefined], true],
    [["isNotEmpty", "x", undefined], true],
    [["isTrue", true, undefined], true],
    [["isFalse", null, undefined], true],
    [["eq", true, "true"], true],
    [["eq", ["a"], "A"], true],
  ])("%j → %s", (args, expected) => {
    expect(evaluateOperator(...args)).toBe(expected)
  })

  it("sorts empty values last, numbers numerically and text by Turkish locale", () => {
    expect([3, null, 1, 10].sort(compareComparables)).toEqual([1, 3, 10, null])
    expect(["Zeytin", "Çınar", "Ahmet"].sort(compareComparables)).toEqual([
      "Ahmet",
      "Çınar",
      "Zeytin",
    ])
    expect(compareComparables(true, false)).toBeGreaterThan(0)
    expect(compareComparables(["b"], ["a"])).toBeGreaterThan(0)
  })
})

describe("record query (engine/records)", () => {
  it("searches the configured search fields (Turkish letters folded)", () => {
    for (const q of ["çınar", "ÇINAR", "cinar", "gida"]) {
      expect(matchesSearch(def, rows[2]!.values, q), q).toBe(true)
    }
    expect(matchesSearch(def, rows[0]!.values, "info@acme")).toBe(true)
    expect(matchesSearch(def, rows[0]!.values, "")).toBe(true)
    expect(matchesSearch(def, rows[0]!.values, "yok")).toBe(false)
  })

  it("filters by field type (currency amount, multiselect, dates, booleans)", () => {
    expect(ids([{ field: "price", op: "gt", value: 1000 }])).toEqual(["2"])
    expect(ids([{ field: "tags", op: "in", value: ["vip"] }])).toEqual([
      "1",
      "2",
    ])
    expect(ids([{ field: "day", op: "before", value: "2026-10-03" }])).toEqual([
      "1",
    ])
    expect(ids([{ field: "active", op: "isTrue" }])).toEqual(["1"])
    expect(ids([{ field: "country", op: "isEmpty" }])).toEqual(["3"])
    expect(
      ids([
        { field: "stage", op: "notIn", value: ["lost"] },
        { field: "count", op: "gte", value: 5 },
      ])
    ).toEqual(["2"])
  })

  it("ignores conditions on fields the object no longer has", () => {
    expect(ids([{ field: "deleted", op: "eq", value: "x" }])).toEqual([
      "1",
      "2",
      "3",
    ])
  })

  it("sorts by field type and keeps empty values last in both directions", () => {
    const byPriceAsc = queryRecordValues(def, rows, {
      sort: { field: "price", direction: "asc" },
    }).map((row) => row.id)
    const byPriceDesc = queryRecordValues(def, rows, {
      sort: { field: "price", direction: "desc" },
    }).map((row) => row.id)

    expect(byPriceAsc).toEqual(["1", "2", "3"])
    expect(byPriceDesc).toEqual(["2", "1", "3"])
    expect(
      queryRecordValues(def, rows, {
        sort: { field: "missing", direction: "asc" },
      })
    ).toHaveLength(3)
  })

  it("combines search, filters and sort", () => {
    const result = queryRecordValues(def, rows, {
      q: "a",
      filters: [{ field: "stage", op: "in", value: ["new", "won"] }],
      sort: { field: "name", direction: "desc" },
    })
    expect(result.map((row) => row.id)).toEqual(["2", "1"])
  })
})

describe("stage gate (engine/logic)", () => {
  it("lists required fields of the target stage that are still empty", () => {
    expect(
      getMissingGateFields(def, "lost", { reason: null }).map((f) => f.key)
    ).toEqual(["reason"])
    expect(getMissingGateFields(def, "lost", { reason: "price" })).toEqual([])
    expect(getMissingGateFields(def, "won", {})).toEqual([])
    expect(getMissingGateFields(def, "unknown", {})).toEqual([])
  })
})

describe("metadata helpers (engine/metadata)", () => {
  const record = { id: "r1", values: { name: "Acme", stage: "won" }, refs: {} }

  it("resolves fields, titles, stages and option labels", () => {
    expect(getField(def, "stage")?.type).toBe("select")
    expect(
      pickFields(def, ["price", "nope", "name"]).map((f) => f.key)
    ).toEqual(["price", "name"])
    expect(getRecordTitle(def, record)).toBe("Acme")
    expect(getRecordTitle(def, { ...record, values: { name: " " } })).toBe("r1")
    expect(getRecordStage(def, record)?.kind).toBe("won")
    expect(getStageField(def)?.key).toBe("stage")
    expect(getOptionLabel(getField(def, "stage")!, "won", "en")).toBe("Won")
    expect(getOptionLabel(getField(def, "stage")!, "zzz", "en")).toBe("zzz")
    expect(getObjectIcon("building")).not.toBe(getObjectIcon("missing-icon"))
  })

  it("groups editable fields like the detail layout and appends the rest", () => {
    const sections = getFormSections(def)
    expect(sections.map((section) => section.key)).toEqual([
      "main",
      "meta",
      "__other",
    ])
    expect(sections[1]!.fields.map((f) => f.key)).toEqual(["ownerId"])
    const all = sections.flatMap((section) => section.fields.map((f) => f.key))
    expect(all).not.toContain("createdAt")
    expect(all.sort()).toEqual(
      getEditableFields(def)
        .map((f) => f.key)
        .sort()
    )
  })

  it.each([
    ["Yeni Alan", "yeniAlan"],
    ["Gümrük Müşaviri No", "gumrukMusaviriNo"],
    ["IBAN", "iban"],
    ["2. Telefon", "f2Telefon"],
    ["   ", ""],
  ])("toFieldKey(%j) → %j", (input, expected) => {
    expect(toFieldKey(input)).toBe(expected)
  })
})
