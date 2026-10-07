import { describe, expect, it } from "vitest"

import {
  applyFilters,
  applySearch,
  applySort,
  paginate,
  parseListParams,
} from "@/mocks/utils/list"

const url = (search: string) => new URL(`http://localhost/api/items${search}`)

const items = [
  {
    id: "1",
    name: "İstanbul Lojistik",
    status: "active",
    score: 10,
    city: "İstanbul",
  },
  {
    id: "2",
    name: "Ankara Kargo",
    status: "archived",
    score: 2,
    city: "Ankara",
  },
  {
    id: "3",
    name: "izmir Forwarding",
    status: "active",
    score: 30,
    city: null,
  },
  {
    id: "4",
    name: "Bursa Taşımacılık",
    status: "lead",
    score: 2,
    city: "Bursa",
  },
]

describe("parseListParams", () => {
  it("TC-0.4-02 parses paging, sorting, search and filters", () => {
    expect(
      parseListParams(
        url(
          "?page=2&pageSize=10&sort=name:desc&q=%20acme%20&status=active,lead&city=Bursa"
        )
      )
    ).toEqual({
      page: 2,
      pageSize: 10,
      sort: { field: "name", direction: "desc" },
      q: "acme",
      filters: { status: ["active", "lead"], city: ["Bursa"] },
    })
  })

  it("TC-0.4-02 falls back to safe defaults and caps the page size", () => {
    expect(
      parseListParams(url("?page=-1&pageSize=abc"), { pageSize: 5 })
    ).toEqual({
      page: 1,
      pageSize: 5,
      sort: undefined,
      q: undefined,
      filters: {},
    })
    expect(
      parseListParams(url("?pageSize=5000&sort=name&status=")).pageSize
    ).toBe(100)
    expect(parseListParams(url("?sort=name")).sort).toEqual({
      field: "name",
      direction: "asc",
    })
  })
})

describe("list helpers", () => {
  it("TC-0.4-02 searches case-insensitively with Turkish casing", () => {
    expect(applySearch(items, "istanbul", ["name"]).map((i) => i.id)).toEqual([
      "1",
    ])
    expect(applySearch(items, "İZMİR", ["name"]).map((i) => i.id)).toEqual([
      "3",
    ])
    expect(applySearch(items, undefined, ["name"])).toBe(items)
  })

  it("TC-0.4-02 filters only on allowed fields with 'in' semantics", () => {
    expect(
      applyFilters(items, { status: ["active", "lead"] }, ["status"]).map(
        (i) => i.id
      )
    ).toEqual(["1", "3", "4"])
    expect(applyFilters(items, { city: ["Bursa"] }, ["status"])).toBe(items)
  })

  it("TC-0.4-02 sorts numbers, strings and nulls stably", () => {
    expect(
      applySort(items, { field: "score", direction: "asc" }).map((i) => i.id)
    ).toEqual(["2", "4", "1", "3"])
    expect(
      applySort(items, { field: "score", direction: "desc" }).map((i) => i.id)
    ).toEqual(["3", "1", "2", "4"])
    expect(
      applySort(items, { field: "city", direction: "asc" }).map((i) => i.id)
    ).toEqual(["2", "4", "1", "3"])
    expect(applySort(items, undefined)).toBe(items)
  })

  it("TC-0.4-02 paginates and reports the total", () => {
    expect(paginate(items, 2, 3)).toEqual({
      data: [items[3]],
      meta: { page: 2, pageSize: 3, total: 4 },
    })
    expect(paginate(items, 3, 3).data).toEqual([])
  })
})
