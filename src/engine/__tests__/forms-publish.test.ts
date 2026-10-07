import { describe, expect, it } from "vitest"

import {
  hasBlockingIssues,
  validateFormForPublish,
  type FormContent,
} from "@/engine/forms"
import type { ObjectDef } from "@/engine/metadata"
import { coreObjects } from "@/features/records/mocks/core-objects"

import { formContent, formField, rule, tt } from "./form-fixtures"

const lead = coreObjects().find((def) => def.key === "lead") as ObjectDef

function publishable(): FormContent {
  const content = formContent([
    formField("name", "text", { required: true, label: tt("Ad", "Name") }),
    formField("email", "email", { label: tt("E-posta", "Email") }),
  ])
  content.mapping.fields = { f_name: "name", f_email: "email" }
  return content
}

const codes = (content: FormContent) =>
  validateFormForPublish(content, lead).map(
    (issue) => `${issue.severity}:${issue.code}`
  )

describe("publish check (B4.7)", () => {
  it("a complete form has no issues", () => {
    expect(validateFormForPublish(publishable(), lead)).toEqual([])
  })

  it("blocks forms without inputs, duplicate keys, bad logic or redirect", () => {
    expect(codes(formContent([formField("title", "heading")]))).toEqual([
      "error:noInputs",
      "error:requiredTarget",
    ])

    const content = publishable()
    content.fields.push(formField("name", "text", { id: "f_name2" }))
    content.logic = [
      rule("loop", {
        conditions: [{ field: "f_name", op: "isNotEmpty" }],
        action: "hide",
        targets: [{ kind: "field", id: "f_name" }],
      }),
      rule("gone", {
        conditions: [{ field: "f_x", op: "isEmpty" }],
        action: "show",
        targets: [{ kind: "field", id: "f_email" }],
      }),
      rule("draft", {
        conditions: [{ field: "f_email", op: "eq" }],
        action: "show",
        targets: [],
      }),
    ]
    content.settings.redirectUrl = "javascript:alert(1)"
    expect(codes(content)).toEqual([
      "error:duplicateKey",
      "error:logicCycle",
      "error:logicBroken",
      "error:logicIncomplete",
      "error:invalidRedirect",
    ])
    expect(hasBlockingIssues(validateFormForPublish(content, lead))).toBe(true)
  })

  it("TC-4.5-01 / TC-4.5-02 mapping errors block publishing", () => {
    const content = publishable()
    content.mapping.fields = { f_email: "estimatedValue" }
    expect(codes(content)).toEqual([
      "error:typeMismatch",
      "error:requiredTarget",
    ])
    // Unknown target object (e.g. its module was deactivated).
    expect(validateFormForPublish(publishable(), undefined)).toEqual([
      { code: "unknownTarget", severity: "error" },
    ])
  })

  it("translations and contrast are warnings only", () => {
    const content = publishable()
    content.fields[0]!.label.en = ""
    content.theme.textColor = "#dddddd"
    const issues = validateFormForPublish(content, lead)
    expect(issues).toEqual([
      { code: "missingTranslation", severity: "warning", count: 1 },
      { code: "lowContrast", severity: "warning", count: 1 },
    ])
    expect(hasBlockingIssues(issues)).toBe(false)
  })
})
