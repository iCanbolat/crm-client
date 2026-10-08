import { describe, expect, it } from "vitest"

import { applyMapping, validateSubmission } from "@/engine/forms"
import type { ObjectDef } from "@/engine/metadata"
import { coreObjects } from "@/features/records/mocks/core-objects"

import { formContent, formField, options, rule, tt } from "./form-fixtures"

const lead = coreObjects().find((def) => def.key === "lead") as ObjectDef

describe("submission → record values (B5.5)", () => {
  it("TC-5.5-01 maps answers by field id and converts types", () => {
    const content = formContent([
      formField("fullName", "text", { required: true }),
      formField("mail", "email"),
      formField("topic", "radio", {
        options: [
          { value: "sea", label: tt("Deniz", "Sea") },
          { value: "air", label: tt("Hava", "Air") },
        ],
      }),
      formField("how", "select", { options: options("referral", "webForm") }),
      formField("utmSource", "hidden"),
      formField("note", "textarea"),
      formField("unmappedAnswer", "text"),
    ])
    content.mapping.fields = {
      f_fullName: "name",
      f_mail: "email",
      f_topic: "companyName",
      f_how: "source",
      f_utmSource: "message",
      f_note: "companyName_missing",
    }
    const result = applyMapping(
      content,
      lead,
      {
        fullName: "Ayşe Demir",
        mail: "ayse@firma.test",
        topic: "sea",
        how: "referral",
        utmSource: "google",
        note: "Merhaba",
        unmappedAnswer: "ignored",
      },
      "tr"
    )
    expect(result.values).toEqual({
      name: "Ayşe Demir",
      email: "ayse@firma.test",
      // A choice lands on a text target as its label in the form language.
      companyName: "Deniz",
      source: "referral",
      message: "google",
    })
    // The target field no longer exists.
    expect(result.unmapped).toEqual(["note"])
  })

  it("TC-5.5-01 skips blank and logic-hidden answers, drops unknown options", () => {
    const content = formContent([
      formField("fullName", "text"),
      formField("mode", "radio", { options: options("sea", "air") }),
      formField("detail", "textarea"),
      formField("how", "select", { options: options("billboard") }),
    ])
    content.logic = [
      rule("r1", {
        conditions: [{ field: "f_mode", op: "eq", value: "air" }],
        action: "hide",
        targets: [{ kind: "field", id: "f_detail" }],
      }),
    ]
    content.mapping.fields = {
      f_fullName: "name",
      f_detail: "message",
      f_how: "source",
    }
    const result = applyMapping(content, lead, {
      fullName: "",
      mode: "air",
      detail: "hidden by logic",
      how: "billboard",
    })
    expect(result.values).toEqual({})
    // "billboard" is not one of the lead's sources.
    expect(result.unmapped).toEqual(["how"])
  })

  it("validates submissions with the renderer's schema", () => {
    const content = formContent([
      formField("fullName", "text", { required: true }),
      formField("mail", "email"),
    ])
    expect(validateSubmission(content, { fullName: "", mail: "x" })).toEqual({
      ok: false,
      fieldErrors: {
        fullName: [expect.any(String)],
        mail: [expect.any(String)],
      },
    })
    expect(
      validateSubmission(content, {
        fullName: "Ayşe",
        mail: "a@b.co",
        extra: 1,
      })
    ).toEqual({ ok: true, answers: { fullName: "Ayşe", mail: "a@b.co" } })
  })
})
