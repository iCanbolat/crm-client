import { describe, expect, it } from "vitest"

import {
  formatFieldValue,
  getFieldType,
  getFieldTypes,
  hasFieldType,
  normalizeUrl,
  registerFieldTypes,
} from "@/engine/field-types"
import { CORE_FIELD_TYPES, type FieldDef } from "@/engine/metadata"
import { fieldToZod, metadataToZod } from "@/engine/records"

import { field, testObject } from "./fixtures"

const accepts = (def: FieldDef, value: unknown) =>
  fieldToZod(def).safeParse(value).success

const parsed = (def: FieldDef, value: unknown) => fieldToZod(def).parse(value)

const format = (def: FieldDef, value: unknown, language: "tr" | "en" = "tr") =>
  formatFieldValue(def, value, { language })

const selectField = testObject().fields.find((item) => item.key === "stage")!
const tagsField = testObject().fields.find((item) => item.key === "tags")!

interface TypeCase {
  id: string
  def: FieldDef
  valid: unknown[]
  invalid: unknown[]
  formatted: [value: unknown, tr: string, en?: string][]
}

const CASES: TypeCase[] = [
  {
    id: "TC-2.1-01 text",
    def: field("name", "text", {
      validation: { min: 2, max: 5, pattern: "^[A-Z]" },
    }),
    valid: ["Acme", "  Ab  "],
    invalid: ["a", "Abcdef", "acme", 42],
    formatted: [["Acme", "Acme"]],
  },
  {
    id: "TC-2.1-02 textarea",
    def: field("notes", "textarea", { validation: { max: 10 } }),
    valid: ["satır 1\nsatır 2".slice(0, 10)],
    invalid: ["x".repeat(11), {}],
    formatted: [["Not", "Not"]],
  },
  {
    id: "TC-2.1-03 number",
    def: field("count", "number", { validation: { min: 0, max: 10 } }),
    valid: [0, 7.5, 10],
    invalid: [-1, 11, "5"],
    formatted: [[1234.5, "1.234,5", "1,234.5"]],
  },
  {
    id: "TC-2.1-04 currency",
    def: field("price", "currency", { validation: { min: 0 } }),
    valid: [{ amount: 1500, currency: "EUR" }],
    invalid: [
      { amount: -5, currency: "EUR" },
      { amount: 5, currency: "euro" },
      5,
    ],
    formatted: [[{ amount: 1500, currency: "EUR" }, "€1.500,00", "€1,500.00"]],
  },
  {
    id: "TC-2.1-05 percent",
    def: field("ratio", "percent"),
    valid: [0, 40, 100],
    invalid: [-1, 101],
    formatted: [[40, "%40", "40%"]],
  },
  {
    id: "TC-2.1-06 date",
    def: field("day", "date"),
    valid: ["2026-10-05"],
    invalid: ["05.10.2026", "2026-13-01", "2026-10-05T10:00:00Z"],
    formatted: [["2026-10-05", "5 Eki 2026", "Oct 5, 2026"]],
  },
  {
    id: "TC-2.1-07 datetime",
    def: field("at", "datetime"),
    valid: ["2026-10-05T10:30:00.000Z", "2026-10-05T10:30:00+03:00"],
    invalid: ["2026-10-05", "yarın"],
    formatted: [],
  },
  {
    id: "TC-2.1-08 boolean",
    def: field("active", "boolean"),
    valid: [true, false],
    invalid: ["true", 1],
    formatted: [
      [true, "Evet", "Yes"],
      [false, "Hayır", "No"],
    ],
  },
  {
    id: "TC-2.1-09 select",
    def: selectField,
    valid: ["new", "won"],
    invalid: ["unknown", 1],
    formatted: [["won", "Kazanıldı", "Won"]],
  },
  {
    id: "TC-2.1-10 multiselect",
    def: tagsField,
    valid: [["vip"], ["vip", "hot"]],
    invalid: [["vip", "nope"], "vip"],
    formatted: [[["vip", "hot"], "VIP, Sıcak", "VIP, Hot"]],
  },
  {
    id: "TC-2.1-11 email",
    def: field("email", "email"),
    valid: ["info@acme.com.tr", " Info@Acme.com "],
    invalid: ["info@", "acme.com"],
    formatted: [["info@acme.com.tr", "info@acme.com.tr"]],
  },
  {
    id: "TC-2.1-12 phone",
    def: field("phone", "phone"),
    valid: ["+905321234567", "+4930123456"],
    invalid: ["05321234567", "+90 532", "+0123456789"],
    formatted: [["+905321234567", "+90 532 123 4567"]],
  },
  {
    id: "TC-2.1-13 url",
    def: field("site", "url"),
    valid: ["https://acme.com", "acme.com.tr/iletisim"],
    invalid: ["ftp://acme.com", "acme com"],
    formatted: [["https://acme.com/iletisim", "acme.com/iletisim"]],
  },
  {
    id: "TC-2.1-14 country",
    def: field("country", "country"),
    valid: ["TR", "DE"],
    invalid: ["XX", "tr", "Türkiye"],
    formatted: [["DE", "Almanya", "Germany"]],
  },
  {
    id: "TC-2.1-15 user",
    def: field("ownerId", "user"),
    valid: ["usr_owner"],
    invalid: [42],
    formatted: [["usr_owner", "usr_owner"]],
  },
  {
    id: "TC-2.1-16 relation",
    def: field("companyId", "relation", {
      relation: { objectKey: "company", displayField: "name" },
    }),
    valid: ["cmp_1"],
    invalid: [{ id: "cmp_1" }],
    formatted: [["cmp_1", "cmp_1"]],
  },
  {
    id: "TC-2.1-17 file",
    def: field("files", "file"),
    valid: [
      [
        {
          id: "f1",
          name: "teklif.pdf",
          size: 1200,
          mimeType: "application/pdf",
        },
      ],
    ],
    invalid: [[{ name: "teklif.pdf" }], "teklif.pdf"],
    formatted: [
      [
        [
          { id: "f1", name: "a.pdf", size: 1, mimeType: "application/pdf" },
          { id: "f2", name: "b.png", size: 1, mimeType: "image/png" },
        ],
        "a.pdf, b.png",
      ],
    ],
  },
]

describe("field type registry (B2.1)", () => {
  it("registers every core field type", () => {
    for (const type of CORE_FIELD_TYPES) expect(hasFieldType(type)).toBe(true)
    expect(getFieldTypes().map((item) => item.type)).toEqual(
      expect.arrayContaining([...CORE_FIELD_TYPES])
    )
  })

  describe.each(CASES)("$id", ({ def, valid, invalid, formatted }) => {
    it("accepts valid values", () => {
      for (const value of valid)
        expect(accepts(def, value), String(value)).toBe(true)
    })

    it("rejects invalid values", () => {
      for (const value of invalid) {
        expect(accepts(def, value), JSON.stringify(value)).toBe(false)
      }
    })

    it("treats empty input as an empty (null) value", () => {
      expect(parsed({ ...def, required: false }, null)).toBeNull()
      expect(getFieldType(def.type).isEmpty(null)).toBe(true)
    })

    it.runIf(formatted.length > 0)("formats values for display", () => {
      for (const [value, tr, en] of formatted) {
        expect(format(def, value, "tr")).toBe(tr)
        if (en) expect(format(def, value, "en")).toBe(en)
      }
    })

    it("offers filter operators", () => {
      expect(getFieldType(def.type).filterOperators.length).toBeGreaterThan(0)
    })
  })

  it("normalizes text: trims strings, lowercases emails, completes URLs", () => {
    expect(parsed(field("name", "text"), "  Acme  ")).toBe("Acme")
    expect(parsed(field("email", "email"), " Info@Acme.COM ")).toBe(
      "info@acme.com"
    )
    expect(normalizeUrl("acme.com")).toBe("https://acme.com")
    expect(normalizeUrl("http://acme.com")).toBe("http://acme.com")
    expect(parsed(field("site", "url"), "acme.com")).toBe("https://acme.com")
  })

  it("formats datetimes in the user's language", () => {
    const value = "2026-10-05T10:30:00.000Z"
    expect(format(field("at", "datetime"), value, "tr")).toMatch(/5 Eki 2026/)
    expect(format(field("at", "datetime"), value, "en")).toMatch(/Oct 5, 2026/)
  })

  it("formats user and relation values with their joined labels", () => {
    expect(
      formatFieldValue(field("ownerId", "user"), "usr_owner", {
        language: "tr",
        refValue: { id: "usr_owner", label: "Elif Yılmaz" },
      })
    ).toBe("Elif Yılmaz")
  })

  it("returns an empty string for empty values", () => {
    expect(format(field("count", "number"), null)).toBe("")
    expect(format(tagsField, [])).toBe("")
  })

  it("lets modules register additional types but never replace core ones", () => {
    const port = { ...getFieldType("text"), type: "test-port" }
    registerFieldTypes([port])
    expect(getFieldType("test-port")).toBe(port)
    expect(() => registerFieldTypes([{ ...port, type: "text" }])).toThrow(
      /reserved/
    )
  })

  it("TC-2.1-21 falls back safely for unknown field types", () => {
    const def = field("legacy", "hs-code-v0")
    const definition = getFieldType(def.type)

    expect(definition.type).toBe("unknown")
    expect(definition.creatable).toBe(false)
    expect(accepts(def, { any: "shape" })).toBe(true)
    expect(format(def, { code: 1 })).toBe('{"code":1}')
    expect(definition.filterOperators).toEqual(["isEmpty", "isNotEmpty"])
  })
})

describe("metadataToZod (B2.1)", () => {
  const schema = metadataToZod(testObject())

  it("TC-2.1-20 requires required fields and lets optional ones be empty", () => {
    const result = schema.safeParse({
      name: "",
      stage: null,
      ownerId: undefined,
    })

    expect(result.success).toBe(false)
    const paths = result.error!.issues.map((issue) => issue.path[0])
    expect(paths).toEqual(expect.arrayContaining(["name", "stage", "ownerId"]))
    expect(paths).not.toContain("notes")
    expect(
      result.error!.issues.find((issue) => issue.path[0] === "name")?.message
    ).toBe("Bu alan zorunludur.")

    const ok = schema.parse({
      name: "Acme",
      stage: "new",
      ownerId: "usr_owner",
      notes: "",
      tags: [],
      count: Number.NaN,
    })
    expect(ok).toMatchObject({
      name: "Acme",
      notes: null,
      tags: null,
      count: null,
    })
  })

  it("TC-2.1-20 never includes read-only fields and drops unknown keys", () => {
    const ok = schema.parse({
      name: "Acme",
      stage: "new",
      ownerId: "usr_owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      hacked: true,
    })
    expect(ok).not.toHaveProperty("createdAt")
    expect(ok).not.toHaveProperty("hacked")
  })

  it("TC-2.1-20 partial mode (PATCH) allows missing keys but not clearing required ones", () => {
    const partial = metadataToZod(testObject(), { partial: true })
    expect(partial.safeParse({ notes: "Yeni not" }).success).toBe(true)
    expect(partial.safeParse({ name: null }).success).toBe(false)
    expect(partial.safeParse({ name: "" }).success).toBe(false)
  })

  it("restricts the schema to selected fields", () => {
    const subset = metadataToZod(testObject(), {
      fields: ["reason", "createdAt"],
    })
    expect(subset.safeParse({ reason: "price", createdAt: "x" }).data).toEqual({
      reason: "price",
    })
  })
})
