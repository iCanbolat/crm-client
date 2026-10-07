import { describe, expect, it } from "vitest"

import {
  clearHiddenAnswers,
  createEmptyContent,
  evaluateFormLogic,
  formContentSchema,
  formDefToZod,
  FormSchemaError,
  getAnswerFields,
  getFormFieldCategory,
  getStepFieldKeys,
  getVisibleSteps,
  migrateFormContent,
  toEngineFieldDef,
  type FormAnswers,
  type FormContent,
} from "@/engine/forms"

import { formContent, formField, options, rule, tt } from "./form-fixtures"

function errorsOf(content: FormContent, answers: FormAnswers) {
  const result = formDefToZod(content, answers).safeParse(answers)
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message])
  )
}

const file = {
  id: "file_1",
  name: "a.pdf",
  size: 10,
  mimeType: "application/pdf",
}

/** One required field per palette type with a valid and an invalid answer. */
const CASES: {
  type: string
  extra?: Parameters<typeof formField>[2]
  valid: unknown
  invalid?: unknown
  message?: string
}[] = [
  {
    type: "text",
    extra: { validation: { max: 5 } },
    valid: "Acme",
    invalid: "Çok uzun",
    message: "En fazla 5 olabilir.",
  },
  {
    type: "textarea",
    extra: { validation: { min: 3 } },
    valid: "Merhaba",
    invalid: "Hi",
    message: "En az 3 olmalı.",
  },
  {
    type: "email",
    valid: "ali@acme.test",
    invalid: "ali@",
    message: "Geçerli bir e-posta adresi girin.",
  },
  {
    type: "phone",
    valid: "+905321234567",
    invalid: "12",
    message: "Geçerli bir telefon numarası girin (ör. +90 532 123 45 67).",
  },
  {
    type: "number",
    extra: { validation: { min: 1, max: 10 } },
    valid: 3,
    invalid: 11,
    message: "En fazla 10 olabilir.",
  },
  {
    type: "select",
    extra: { options: options("a", "b") },
    valid: "a",
    invalid: "z",
    message: "Listeden geçerli bir seçenek seçin.",
  },
  {
    type: "radio",
    extra: { options: options("a", "b") },
    valid: "b",
    invalid: "z",
    message: "Listeden geçerli bir seçenek seçin.",
  },
  {
    type: "checkboxes",
    extra: { options: options("a", "b") },
    valid: ["a", "b"],
    invalid: ["a", "z"],
    message: "Listeden geçerli bir seçenek seçin.",
  },
  { type: "date", valid: "2026-10-07", invalid: "07.10.2026" },
  { type: "file", valid: [file], invalid: [{ name: "x" }] },
  {
    type: "consent",
    valid: true,
    invalid: false,
    message: "Devam etmek için onaylamanız gerekir.",
  },
]

describe("form schema model (B4.1)", () => {
  it.each(CASES)(
    "TC-4.1-01 $type: required, valid and invalid answers",
    ({ type, extra, valid, invalid, message }) => {
      const content = formContent([
        formField("answer", type, { required: true, ...extra }),
      ])
      expect(errorsOf(content, { answer: null }).answer).toBeTruthy()
      expect(errorsOf(content, { answer: valid })).toEqual({})
      if (invalid !== undefined) {
        const error = errorsOf(content, { answer: invalid }).answer
        expect(error).toBeTruthy()
        if (message) expect(error).toBe(message)
      }
    }
  )

  it("TC-4.1-01 optional, hidden and layout fields", () => {
    const content = formContent([
      formField("note", "text"),
      formField("agree", "consent"),
      formField("source", "hidden", {
        prefill: { kind: "query", param: "utm_source" },
      }),
      formField("title", "heading"),
      formField("intro", "paragraph"),
      formField("line", "divider"),
    ])
    expect(errorsOf(content, { note: "", agree: false, source: null })).toEqual(
      {}
    )
    const parsed = formDefToZod(content, {}).parse({
      note: "  ",
      source: "google",
      title: "ignored",
    })
    expect(parsed).toEqual({ note: null, source: "google" })
    expect(getAnswerFields(content).map((field) => field.key)).toEqual([
      "note",
      "agree",
      "source",
    ])
    expect(getFormFieldCategory("divider")).toBe("layout")
    expect(getFormFieldCategory("hidden")).toBe("hidden")
    expect(getFormFieldCategory("location")).toBe("input")
  })

  it("TC-4.1-01 regex validation and engine field adaptation", () => {
    const content = formContent([
      formField("code", "text", { validation: { pattern: "^[A-Z]{3}$" } }),
    ])
    expect(errorsOf(content, { code: "ab" }).code).toBe(
      "Değer beklenen biçimde değil."
    )
    expect(errorsOf(content, { code: "IST" })).toEqual({})
    expect(
      toEngineFieldDef(formField("mode", "radio", { options: options("a") }), {
        required: true,
      })
    ).toMatchObject({ key: "mode", type: "select", required: true })
  })

  it("TC-4.1-02 a required field hidden by a rule does not block the form", () => {
    const content = formContent(
      [
        formField("kind", "radio", {
          options: options("personal", "business"),
        }),
        formField("company", "text", { required: true }),
        formField("contact", "select", { options: options("email", "phone") }),
        formField("phone", "phone"),
      ],
      {
        logic: [
          rule("r1", {
            conditions: [{ field: "f_kind", op: "eq", value: "business" }],
            action: "show",
            targets: [{ kind: "field", id: "f_company" }],
          }),
          rule("r2", {
            conditions: [{ field: "f_contact", op: "eq", value: "phone" }],
            action: "require",
            targets: [{ kind: "field", id: "f_phone" }],
          }),
        ],
      }
    )

    expect(errorsOf(content, { kind: "personal", company: null })).toEqual({})
    expect(errorsOf(content, { kind: "personal", company: "stale" })).toEqual(
      {}
    )
    expect(errorsOf(content, { kind: "business", company: null }).company).toBe(
      "Bu alan zorunludur."
    )
    expect(errorsOf(content, { kind: "business", company: "Acme" })).toEqual({})
    // `require` rules make an optional field mandatory while they match.
    expect(errorsOf(content, { contact: "phone", phone: null }).phone).toBe(
      "Bu alan zorunludur."
    )
    expect(errorsOf(content, { contact: "email", phone: null })).toEqual({})
    // Hidden answers are never submitted.
    expect(
      clearHiddenAnswers(content, {
        kind: "personal",
        company: "stale",
        phone: "+905321234567",
      })
    ).toEqual({ kind: "personal", phone: "+905321234567" })
  })

  it("TC-4.1-02 hidden steps and their fields are skipped", () => {
    const content = formContent(
      [
        formField("mode", "select", { options: options("AIR", "SEA") }),
        formField("weight", "number", { required: true, stepId: "air" }),
      ],
      {
        steps: [
          { id: "step1", title: tt("Rota") },
          { id: "air", title: tt("Hava yükü") },
        ],
        logic: [
          rule("r1", {
            conditions: [{ field: "f_mode", op: "eq", value: "AIR" }],
            action: "show",
            targets: [{ kind: "step", id: "air" }],
          }),
        ],
      }
    )
    expect(
      getVisibleSteps(content, { mode: "SEA" }).map((step) => step.id)
    ).toEqual(["step1"])
    expect(errorsOf(content, { mode: "SEA", weight: null })).toEqual({})
    expect(getVisibleSteps(content, { mode: "AIR" })).toHaveLength(2)
    expect(errorsOf(content, { mode: "AIR", weight: null }).weight).toBeTruthy()
    expect(getStepFieldKeys(content, "air", { mode: "AIR" })).toEqual([
      "weight",
    ])
    expect(getStepFieldKeys(content, "air", { mode: "SEA" })).toEqual([])
  })

  it("TC-4.1-02 chained rules treat hidden answers as empty", () => {
    const content = formContent(
      [
        formField("a", "radio", { options: options("yes", "no") }),
        formField("b", "radio", { options: options("yes", "no") }),
        formField("c", "text"),
      ],
      {
        logic: [
          rule("r1", {
            conditions: [{ field: "f_a", op: "eq", value: "yes" }],
            action: "show",
            targets: [{ kind: "field", id: "f_b" }],
          }),
          rule("r2", {
            conditions: [{ field: "f_b", op: "eq", value: "yes" }],
            action: "show",
            targets: [{ kind: "field", id: "f_c" }],
          }),
        ],
      }
    )
    const shown = evaluateFormLogic(content, { a: "yes", b: "yes" })
    expect([...shown.hiddenFields]).toEqual([])
    // `b` keeps a stale "yes" but is hidden, so `c` hides too.
    const hidden = evaluateFormLogic(content, { a: "no", b: "yes" })
    expect([...hidden.hiddenFields].sort()).toEqual(["f_b", "f_c"])
  })

  it("TC-4.1-03 schema v1 content is read and migrated to v2", () => {
    const v1 = {
      fields: [
        { key: "Ad Soyad", type: "text", label: "Ad soyad", required: true },
        {
          key: "ilgi",
          type: "radio",
          label: "İlgi alanı",
          options: ["Deniz yolu", "Hava yolu"],
        },
        {
          key: "ilgi",
          type: "email",
          label: "E-posta",
          placeholder: "ornek@firma.com",
        },
      ],
      submitLabel: "Kayıt ol",
      theme: { color: "#16a34a" },
    }
    const content = migrateFormContent(v1)
    expect(formContentSchema.parse(content)).toEqual(content)
    expect(content.schemaVersion).toBe(2)
    expect(content.steps).toHaveLength(1)
    expect(content.fields.map((field) => field.key)).toEqual([
      "adSoyad",
      "ilgi",
      "ilgi2",
    ])
    expect(content.fields[0]).toMatchObject({
      label: { tr: "Ad soyad", en: "" },
      required: true,
      stepId: content.steps[0]?.id,
    })
    expect(content.fields[1]?.options).toEqual([
      { value: "denizYolu", label: { tr: "Deniz yolu", en: "" } },
      { value: "havaYolu", label: { tr: "Hava yolu", en: "" } },
    ])
    expect(content.fields[2]?.placeholder).toEqual({
      tr: "ornek@firma.com",
      en: "",
    })
    expect(content.settings.languages).toEqual(["tr"])
    expect(content.settings.submitLabel).toEqual({ tr: "Kayıt ol", en: "" })
    expect(content.theme.primaryColor).toBe("#16a34a")
  })

  it("TC-4.1-03 current content passes through, unknown versions fail", () => {
    const current = formContent([formField("name", "text")])
    expect(migrateFormContent(current)).toEqual(current)
    expect(migrateFormContent({ schemaVersion: 1, fields: [] }).fields).toEqual(
      []
    )
    expect(() => migrateFormContent({ ...current, schemaVersion: 99 })).toThrow(
      FormSchemaError
    )
    expect(() => migrateFormContent({ fields: "nope" })).toThrow()
    expect(() =>
      migrateFormContent({ ...createEmptyContent(), steps: [] })
    ).toThrow()
  })
})
