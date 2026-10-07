import { describe, expect, it } from "vitest"

import {
  detectLogicCycles,
  evaluateFormLogic,
  findBrokenLogicRefs,
  findIncompleteRules,
  getLogicOperators,
  type FormAnswers,
  type FormLogicRule,
} from "@/engine/forms"
import type { Condition } from "@/engine/logic"

import { formContent, formField, options, rule, tt } from "./form-fixtures"

const fields = [
  formField("name", "text"),
  formField("qty", "number"),
  formField("mode", "select", { options: options("AIR", "SEA") }),
  formField("tags", "checkboxes", { options: options("a", "b") }),
  formField("agree", "consent"),
  formField("target", "text"),
]

function shown(condition: Condition, answers: FormAnswers) {
  const content = formContent(fields, {
    logic: [
      rule("r", {
        conditions: [condition],
        action: "show",
        targets: [{ kind: "field", id: "f_target" }],
      }),
    ],
  })
  return !evaluateFormLogic(content, answers).hiddenFields.has("f_target")
}

describe("form logic (B4.4)", () => {
  it("TC-4.4-01 evaluates eq, neq, in, gt, lt, isEmpty and isNotEmpty", () => {
    expect(
      shown({ field: "f_mode", op: "eq", value: "AIR" }, { mode: "AIR" })
    ).toBe(true)
    expect(
      shown({ field: "f_mode", op: "eq", value: "AIR" }, { mode: "SEA" })
    ).toBe(false)
    expect(
      shown({ field: "f_mode", op: "neq", value: "AIR" }, { mode: "SEA" })
    ).toBe(true)
    expect(
      shown({ field: "f_mode", op: "neq", value: "AIR" }, { mode: "AIR" })
    ).toBe(false)
    expect(
      shown(
        { field: "f_mode", op: "in", value: ["AIR", "SEA"] },
        { mode: "SEA" }
      )
    ).toBe(true)
    expect(
      shown({ field: "f_tags", op: "in", value: ["b"] }, { tags: ["a", "b"] })
    ).toBe(true)
    expect(
      shown({ field: "f_tags", op: "in", value: ["b"] }, { tags: ["a"] })
    ).toBe(false)
    expect(shown({ field: "f_qty", op: "gt", value: 10 }, { qty: 11 })).toBe(
      true
    )
    expect(shown({ field: "f_qty", op: "gt", value: 10 }, { qty: 10 })).toBe(
      false
    )
    expect(shown({ field: "f_qty", op: "lt", value: "10" }, { qty: 9 })).toBe(
      true
    )
    expect(shown({ field: "f_name", op: "isEmpty" }, { name: "  " })).toBe(true)
    expect(shown({ field: "f_name", op: "isNotEmpty" }, { name: "Ayşe" })).toBe(
      true
    )
    expect(
      shown({ field: "f_name", op: "contains", value: "ŞE" }, { name: "Ayşe" })
    ).toBe(true)
    expect(shown({ field: "f_agree", op: "isTrue" }, { agree: true })).toBe(
      true
    )
    // Unfinished conditions and unknown fields never match.
    expect(shown({ field: "f_mode", op: "eq" }, { mode: "AIR" })).toBe(false)
    expect(shown({ field: "f_missing", op: "isEmpty" }, {})).toBe(false)
  })

  it("offers operators by answer type", () => {
    expect(getLogicOperators(fields[0]!)).toEqual([
      "eq",
      "neq",
      "contains",
      "isEmpty",
      "isNotEmpty",
    ])
    expect(getLogicOperators(fields[1]!)).toEqual([
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "isEmpty",
      "isNotEmpty",
    ])
    expect(getLogicOperators(fields[2]!)).toEqual([
      "eq",
      "neq",
      "in",
      "notIn",
      "isEmpty",
      "isNotEmpty",
    ])
    expect(getLogicOperators(fields[4]!)).toEqual(["isTrue", "isFalse"])
  })

  it("hide wins over show; any / all; require on steps", () => {
    const content = formContent(
      [...fields, formField("extra", "text", { stepId: "s2" })],
      {
        steps: [
          { id: "step1", title: tt("1") },
          { id: "s2", title: tt("2") },
        ],
        logic: [
          rule("show", {
            match: "any",
            conditions: [
              { field: "f_mode", op: "eq", value: "AIR" },
              { field: "f_qty", op: "gt", value: 5 },
            ],
            action: "show",
            targets: [{ kind: "field", id: "f_target" }],
          }),
          rule("hide", {
            conditions: [{ field: "f_name", op: "eq", value: "x" }],
            action: "hide",
            targets: [{ kind: "field", id: "f_target" }],
          }),
          rule("req", {
            conditions: [{ field: "f_agree", op: "isTrue" }],
            action: "require",
            targets: [{ kind: "step", id: "s2" }],
          }),
        ],
      }
    )
    expect(
      evaluateFormLogic(content, { qty: 6 }).hiddenFields.has("f_target")
    ).toBe(false)
    expect(
      evaluateFormLogic(content, { qty: 6, name: "x" }).hiddenFields.has(
        "f_target"
      )
    ).toBe(true)
    expect([
      ...evaluateFormLogic(content, { agree: true }).requiredFields,
    ]).toEqual(["f_extra"])
  })

  it("TC-4.4-04 detects cyclic rules", () => {
    const show = (id: string, from: string, to: FormLogicRule["targets"]) =>
      rule(id, {
        conditions: [{ field: from, op: "isNotEmpty" }],
        action: "show",
        targets: to,
      })
    const base = formContent(fields, {
      steps: [{ id: "step1", title: tt("1") }],
    })

    expect(
      detectLogicCycles({
        ...base,
        logic: [show("a", "f_name", [{ kind: "field", id: "f_qty" }])],
      })
    ).toEqual([])
    expect(
      detectLogicCycles({
        ...base,
        logic: [
          show("a", "f_name", [{ kind: "field", id: "f_qty" }]),
          show("b", "f_qty", [{ kind: "field", id: "f_mode" }]),
          show("c", "f_mode", [{ kind: "field", id: "f_name" }]),
        ],
      })
    ).toEqual([["f_name", "f_qty", "f_mode"]])
    // A field hiding its own step is a cycle; `require` rules are not.
    expect(
      detectLogicCycles({
        ...base,
        logic: [show("a", "f_name", [{ kind: "step", id: "step1" }])],
      })
    ).toEqual([["f_name"]])
    expect(
      detectLogicCycles({
        ...base,
        logic: [
          rule("r", {
            conditions: [{ field: "f_name", op: "isEmpty" }],
            action: "require",
            targets: [{ kind: "field", id: "f_name" }],
          }),
        ],
      })
    ).toEqual([])
  })

  it("finds broken references and unfinished rules", () => {
    const content = formContent(fields, {
      logic: [
        rule("ok", {
          conditions: [{ field: "f_name", op: "isEmpty" }],
          action: "show",
          targets: [{ kind: "field", id: "f_qty" }],
        }),
        rule("gone", {
          conditions: [{ field: "f_deleted", op: "isEmpty" }],
          action: "hide",
          targets: [{ kind: "step", id: "nope" }],
        }),
        rule("draft", {
          conditions: [{ field: "f_mode", op: "eq" }],
          action: "show",
          targets: [],
        }),
      ],
    })
    expect(findBrokenLogicRefs(content)).toEqual([
      { ruleId: "gone", ref: "f_deleted", kind: "condition" },
      { ruleId: "gone", ref: "nope", kind: "target" },
    ])
    expect(findIncompleteRules(content)).toEqual(["draft"])
  })
})
