import { fireEvent } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import "@/app/modules"
import { formatFieldValue, getFieldType } from "@/engine/field-types"
import type { FieldDef } from "@/engine/metadata"
import { renderWithProviders, screen } from "@/test/render"

const field = (key: string, type: string): FieldDef => ({
  key,
  label: { tr: key, en: key },
  type,
})

const valid = (type: string, value: unknown) =>
  getFieldType(type).toZod(field("x", type)).safeParse(value)

function Harness({
  definition,
  onChange,
  initial = null,
}: {
  definition: FieldDef
  onChange: (value: unknown) => void
  initial?: unknown
}) {
  const [value, setValue] = useState<unknown>(initial)
  const Input = getFieldType(definition.type).Input
  return (
    <div>
      <span id="field-label">Alan</span>
      <Input
        id="field"
        labelId="field-label"
        field={definition}
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
      />
    </div>
  )
}

async function renderInput(type: string, initial: unknown = null) {
  const onChange = vi.fn()
  const utils = await renderWithProviders(
    <Harness
      definition={field("x", type)}
      onChange={onChange}
      initial={initial}
    />
  )
  return { ...utils, last: () => onChange.mock.calls.at(-1)?.[0] }
}

const format = (type: string, value: unknown) =>
  formatFieldValue(field("x", type), value, { language: "tr" })

describe("visa & education field types (B8.2)", () => {
  it("TC-8.2-05 passport: validation, masking and input", async () => {
    const passport = {
      number: "u1234567",
      issuingCountry: "TR",
      issuedAt: "2024-01-01",
      expiresAt: "2034-01-01",
    }
    const parsed = valid("passport", passport)
    expect(parsed.success && parsed.data).toMatchObject({ number: "U1234567" })
    expect(valid("passport", { ...passport, number: "12" }).success).toBe(false)
    expect(
      valid("passport", { ...passport, expiresAt: "2023-01-01" }).success
    ).toBe(false)
    expect(format("passport", { ...passport, number: "U1234567" })).toBe(
      "U•••••67 · Bitiş 1 Oca 2034"
    )
    expect(getFieldType("passport").isEmpty(null)).toBe(true)

    const { user, last } = await renderInput("passport")
    await user.type(screen.getByRole("textbox", { name: "Pasaport no" }), "u99")
    expect(last()).toMatchObject({ number: "U99" })
    const [issued, expires] = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type=date]")
    )
    fireEvent.change(issued!, { target: { value: "2024-01-01" } })
    fireEvent.change(expires!, { target: { value: "2034-01-01" } })
    expect(last()).toMatchObject({
      number: "U99",
      issuedAt: "2024-01-01",
      expiresAt: "2034-01-01",
    })
  })

  it("TC-8.2-05 language scores: per-exam rules, CEFR in lists", async () => {
    const type = getFieldType("languageScore")
    expect(
      valid("languageScore", [{ exam: "IELTS", overall: 6.5 }]).success
    ).toBe(true)
    const invalid = valid("languageScore", [{ exam: "IELTS", overall: 7.25 }])
    expect(invalid.success).toBe(false)
    expect(invalid.error?.issues[0]?.message).toBe(
      "IELTS puanı 0.5 adımlarla girilir."
    )
    expect(
      format("languageScore", [
        { exam: "IELTS", overall: 7 },
        { exam: "GOETHE", level: "B2" },
      ])
    ).toBe("IELTS 7 (C1), GOETHE B2 (B2)")
    expect(type.toComparable([{ exam: "TOEFL", overall: 100 }])).toBe(4)

    const { user, last } = await renderInput("languageScore")
    await user.click(screen.getByRole("button", { name: "Sınav sonucu ekle" }))
    await user.type(
      screen.getByRole("spinbutton", { name: "Genel puan" }),
      "6.5"
    )
    expect(last()).toEqual([{ exam: "IELTS", overall: 6.5 }])
    expect(screen.getAllByTestId("language-score-row")).toHaveLength(1)
  })

  it("TC-8.2-05 education history: GPA within its scale", async () => {
    const entry = {
      level: "bachelor",
      institution: "Ege Üniversitesi",
      gpa: 3.2,
      gpaScale: 4,
      graduationYear: 2024,
    }
    expect(valid("educationHistory", [entry]).success).toBe(true)
    expect(valid("educationHistory", [{ ...entry, gpa: 4.5 }]).success).toBe(
      false
    )
    expect(
      valid("educationHistory", [{ ...entry, institution: "" }]).success
    ).toBe(false)
    expect(format("educationHistory", [entry])).toBe(
      "Lisans — Ege Üniversitesi (2024)"
    )

    const { user, last } = await renderInput("educationHistory")
    await user.click(screen.getByRole("button", { name: "Eğitim ekle" }))
    await user.type(screen.getByRole("textbox", { name: "Okul" }), "ODTÜ")
    expect(last()).toEqual([
      { level: "bachelor", institution: "ODTÜ", gpaScale: 4 },
    ])
  })

  it("TC-8.2-05 intake: month + year, sortable", async () => {
    expect(valid("intake", { year: 2027, month: 9 }).success).toBe(true)
    expect(valid("intake", { year: 2027, month: 13 }).success).toBe(false)
    expect(format("intake", { year: 2027, month: 9 })).toBe("Eylül 2027")
    expect(getFieldType("intake").toComparable({ year: 2027, month: 9 })).toBe(
      202709
    )

    const { user, last } = await renderInput("intake", { year: 2027, month: 9 })
    expect(screen.getByRole("combobox", { name: "Ay" })).toHaveTextContent(
      "Eylül"
    )
    await user.click(screen.getByRole("combobox", { name: "Ay" }))
    await user.click(await screen.findByRole("option", { name: "Ocak" }))
    expect(last()).toEqual({ year: 2027, month: 1 })
    await user.click(screen.getByRole("combobox", { name: "Yıl" }))
    await user.click(await screen.findByRole("option", { name: "2028" }))
    expect(last()).toEqual({ year: 2028, month: 1 })
    expect(screen.getByRole("combobox", { name: "Yıl" })).toHaveTextContent(
      "2028"
    )
  })
})
