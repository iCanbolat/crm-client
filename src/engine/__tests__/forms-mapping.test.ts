import { describe, expect, it } from "vitest"

import {
  getMappableTargets,
  getRequiredTargets,
  isMappingCompatible,
  suggestMapping,
  validateMapping,
} from "@/engine/forms"
import type { ObjectDef } from "@/engine/metadata"
import { coreObjects } from "@/features/records/mocks/core-objects"

import { formContent, formField, options, tt } from "./form-fixtures"

const lead = coreObjects().find((def) => def.key === "lead") as ObjectDef
const target = (key: string) => lead.fields.find((field) => field.key === key)!

describe("form → CRM mapping (B4.5)", () => {
  it("TC-4.5-01 the lead's required fields must be mapped", () => {
    // Stage and owner are set by the server.
    expect(getRequiredTargets(lead).map((field) => field.key)).toEqual(["name"])

    const content = formContent([
      formField("fullName", "text", { required: true }),
    ])
    expect(validateMapping(content, lead)).toEqual([
      { code: "requiredTarget", target: "name" },
    ])

    content.mapping.fields = { f_fullName: "name" }
    expect(validateMapping(content, lead)).toEqual([])

    content.fields[0]!.required = false
    expect(validateMapping(content, lead)).toEqual([
      { code: "requiredTargetOptional", fieldId: "f_fullName", target: "name" },
    ])
  })

  it("TC-4.5-02 type compatible targets only", () => {
    const email = formField("email", "email")
    expect(isMappingCompatible(email, target("email"))).toBe(true)
    expect(isMappingCompatible(email, target("companyName"))).toBe(true)
    expect(isMappingCompatible(email, target("estimatedValue"))).toBe(false)
    expect(isMappingCompatible(formField("x", "number"), target("name"))).toBe(
      false
    )
    expect(
      isMappingCompatible(
        formField("x", "radio", { options: options("a") }),
        target("source")
      )
    ).toBe(true)
    expect(
      isMappingCompatible(formField("x", "checkboxes"), target("tags"))
    ).toBe(true)
    expect(
      isMappingCompatible(formField("x", "checkboxes"), target("source"))
    ).toBe(false)
    expect(
      isMappingCompatible(formField("x", "hidden"), target("source"))
    ).toBe(true)
    expect(isMappingCompatible(formField("x", "heading"), target("name"))).toBe(
      false
    )
    expect(
      isMappingCompatible(formField("x", "text"), target("createdAt"))
    ).toBe(false)

    // Stage, owner and read-only fields are never offered.
    const offered = getMappableTargets(formField("x", "select"), lead).map(
      (field) => field.key
    )
    expect(offered).toContain("source")
    expect(offered).not.toContain("stage")
    expect(offered).not.toContain("ownerId")

    const content = formContent([
      formField("name", "text", { required: true }),
      formField("budget", "number"),
      formField("gone", "text"),
    ])
    content.mapping.fields = {
      f_name: "name",
      f_budget: "name",
      f_missing: "email",
      f_gone: "nope",
    }
    expect(validateMapping(content, lead)).toEqual([
      { code: "typeMismatch", fieldId: "f_budget", target: "name" },
      { code: "unknownField", fieldId: "f_missing", target: "email" },
      { code: "unknownTarget", fieldId: "f_gone", target: "nope" },
    ])
    content.mapping.fields = { f_name: "name", f_gone: "name" }
    expect(validateMapping(content, lead)).toEqual([
      { code: "duplicateTarget", fieldId: "f_gone", target: "name" },
    ])
  })

  it("auto-maps by key, label and the only e-mail / phone target", () => {
    const content = formContent([
      formField("name", "text"),
      formField("firma", "text", { label: tt("Şirket adı") }),
      formField("mail", "email"),
      formField("gsm", "phone"),
      formField("intro", "paragraph"),
      formField("budget", "number"),
    ])
    expect(suggestMapping(content, lead)).toEqual({
      f_name: "name",
      f_firma: "companyName",
      f_mail: "email",
      f_gsm: "phone",
    })
    // Existing entries are kept and their targets not reused.
    content.mapping.fields = { f_firma: "name" }
    expect(suggestMapping(content, lead)).toMatchObject({
      f_firma: "name",
      f_mail: "email",
    })
    expect(suggestMapping(content, lead).f_name).toBeUndefined()
  })

  it("linking contacts by e-mail needs a mapped e-mail answer", () => {
    const content = formContent([formField("name", "text", { required: true })])
    content.mapping = {
      ...content.mapping,
      fields: { f_name: "name" },
      duplicate: "linkContactByEmail",
    }
    expect(validateMapping(content, lead)).toEqual([
      { code: "duplicateNeedsEmail" },
    ])
    content.fields.push(formField("email", "email"))
    content.mapping.fields.f_email = "email"
    expect(validateMapping(content, lead)).toEqual([])
  })
})
