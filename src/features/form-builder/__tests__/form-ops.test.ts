import { describe, expect, it } from "vitest"

import {
  formContent,
  formField,
  rule,
  tt,
} from "@/engine/__tests__/form-fixtures"
import type { FormBlockDef } from "@/engine/forms"

import { createPaletteField, createStarterContent } from "../lib/defaults"
import * as ops from "../lib/form-ops"
import { slugify, uniqueSlug } from "../lib/slug"

const keys = (fields: { key: string }[]) => fields.map((field) => field.key)

function twoSteps() {
  return formContent(
    [
      formField("a", "text"),
      formField("b", "text"),
      formField("c", "text"),
      formField("d", "text", { stepId: "s2" }),
    ],
    {
      steps: [
        { id: "step1", title: tt("1") },
        { id: "s2", title: tt("2") },
      ],
    }
  )
}

const routeBlock: FormBlockDef = {
  id: "test.route",
  label: tt("Rota"),
  description: tt("Rota"),
  icon: (() => null) as never,
  fields: [
    { key: "origin", type: "location", label: tt("Çıkış"), mapTo: "origin" },
    {
      key: "mode",
      type: "select",
      label: tt("Mod"),
      mapTo: "transportMode",
      width: "half",
    },
  ],
}

describe("form draft operations (B4.2)", () => {
  it("TC-4.2-01 inserts palette fields at an index or the end of a step", () => {
    const content = twoSteps()
    const field = createPaletteField("email", {
      stepId: "step1",
      takenKeys: new Set(),
    })
    expect(field).toMatchObject({ type: "email", key: "email", width: "half" })
    expect(
      keys(
        ops.insertFields(content, [field], { stepId: "step1", index: 1 }).fields
      )
    ).toEqual(["a", "email", "b", "c", "d"])
    expect(
      keys(ops.insertFields(content, [field], { stepId: "step1" }).fields)
    ).toEqual(["a", "b", "c", "email", "d"])
    expect(
      keys(ops.insertFields(content, [field], { stepId: "s2" }).fields)
    ).toEqual(["a", "b", "c", "d", "email"])
    const empty = ops.addStep(content, { id: "s0", title: tt("0") })
    const moved = ops.moveStep(empty, "s0", 0)
    expect(
      keys(ops.insertFields(moved, [field], { stepId: "s0" }).fields)
    ).toEqual(["email", "a", "b", "c", "d"])
    // Keys stay unique.
    expect(
      createPaletteField("text", {
        stepId: "step1",
        takenKeys: new Set(["text"]),
      }).key
    ).toBe("text2")
  })

  it("TC-4.2-02 moves fields within and across steps", () => {
    const content = twoSteps()
    expect(
      keys(ops.moveField(content, "f_a", { stepId: "step1", index: 2 }).fields)
    ).toEqual(["b", "c", "a", "d"])
    expect(
      keys(ops.moveField(content, "f_c", { stepId: "step1", index: 0 }).fields)
    ).toEqual(["c", "a", "b", "d"])
    const across = ops.moveField(content, "f_a", { stepId: "s2", index: 0 })
    expect(keys(across.fields)).toEqual(["b", "c", "a", "d"])
    expect(across.fields[2]?.stepId).toBe("s2")
    expect(ops.moveField(content, "missing", { stepId: "s2", index: 0 })).toBe(
      content
    )
  })

  it("duplicates below the original and removes with rules and mapping", () => {
    let content = twoSteps()
    content.mapping.fields = { f_a: "name", f_b: "email" }
    content.logic = [
      rule("r1", {
        conditions: [{ field: "f_a", op: "isNotEmpty" }],
        action: "show",
        targets: [{ kind: "field", id: "f_b" }],
      }),
      rule("r2", {
        conditions: [{ field: "f_c", op: "isNotEmpty" }],
        action: "hide",
        targets: [
          { kind: "field", id: "f_a" },
          { kind: "field", id: "f_d" },
        ],
      }),
    ]
    const copy = ops.duplicateField(content, "f_a", () => "f_copy")
    expect(copy.id).toBe("f_copy")
    expect(keys(copy.content.fields)).toEqual(["a", "a2", "b", "c", "d"])
    expect(copy.content.mapping.fields).toEqual(content.mapping.fields)
    expect(ops.duplicateField(content, "nope").id).toBeNull()

    content = ops.removeField(content, "f_a")
    expect(keys(content.fields)).toEqual(["b", "c", "d"])
    expect(content.mapping.fields).toEqual({ f_b: "email" })
    // r1 lost its only condition; r2 keeps its other target.
    expect(content.logic).toEqual([
      rule("r2", {
        conditions: [{ field: "f_c", op: "isNotEmpty" }],
        action: "hide",
        targets: [{ kind: "field", id: "f_d" }],
      }),
    ])
  })

  it("TC-4.2-04 adds a module block with its mapping (targets used once)", () => {
    const content = formContent([formField("name", "text")])
    content.mapping.fields = { f_name: "name" }
    let n = 0
    const createId = () => `blk${++n}`
    const first = ops.addBlock(content, routeBlock, {
      stepId: "step1",
      createId,
    })
    expect(first.ids).toEqual(["blk1", "blk2"])
    expect(first.content.fields.slice(1)).toMatchObject([
      {
        id: "blk1",
        key: "origin",
        type: "location",
        blockId: "test.route",
        width: "full",
      },
      { id: "blk2", key: "mode", type: "select", width: "half" },
    ])
    expect(first.content.mapping.fields).toEqual({
      f_name: "name",
      blk1: "origin",
      blk2: "transportMode",
    })

    const second = ops.addBlock(first.content, routeBlock, {
      stepId: "step1",
      index: 0,
      createId,
    })
    expect(keys(second.content.fields)).toEqual([
      "origin2",
      "mode2",
      "name",
      "origin",
      "mode",
    ])
    expect(Object.keys(second.content.mapping.fields)).toEqual([
      "f_name",
      "blk1",
      "blk2",
    ])
  })

  it("adds, renames, reorders and removes steps", () => {
    let content = twoSteps()
    content.logic = [
      rule("r1", {
        conditions: [{ field: "f_a", op: "isNotEmpty" }],
        action: "show",
        targets: [{ kind: "step", id: "s2" }],
      }),
    ]
    content = ops.updateStep(content, "s2", { title: tt("Yük") })
    expect(content.steps[1]?.title.tr).toBe("Yük")
    const reordered = ops.moveStep(content, "s2", 0)
    expect(reordered.steps.map((step) => step.id)).toEqual(["s2", "step1"])
    expect(keys(reordered.fields)).toEqual(["d", "a", "b", "c"])

    const removed = ops.removeStep(content, "s2")
    expect(removed.steps.map((step) => step.id)).toEqual(["step1"])
    expect(removed.fields.every((field) => field.stepId === "step1")).toBe(true)
    expect(keys(removed.fields)).toEqual(["a", "b", "c", "d"])
    expect(removed.logic).toEqual([])
    // The last step stays; unknown ids are ignored.
    expect(ops.removeStep(removed, "step1")).toBe(removed)
    expect(ops.removeStep(content, "nope")).toBe(content)
    expect(ops.moveStep(content, "nope", 0)).toBe(content)
  })

  it("starts new forms with mapped contact fields and derives link names", () => {
    const content = createStarterContent()
    expect(keys(content.fields)).toEqual([
      "name",
      "companyName",
      "email",
      "phone",
      "message",
      "consent",
    ])
    expect(content.mapping.fields).toMatchObject({
      fld_name: "name",
      fld_email: "email",
    })
    expect(slugify("Navlun Teklif Formu — İstanbul")).toBe(
      "navlun-teklif-formu-istanbul"
    )
    expect(slugify("!!!")).toBe("form")
    expect(uniqueSlug("iletisim", new Set(["iletisim", "iletisim-2"]))).toBe(
      "iletisim-3"
    )
  })
})
