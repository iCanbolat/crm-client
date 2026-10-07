import { describe, expect, it } from "vitest"

import "@/app/modules"
import {
  evaluateFormLogic,
  formDefToZod,
  migrateFormContent,
} from "@/engine/forms"
import { getFormBlocks } from "@/engine/modules"

import { forwardingFormBlocks } from "../form-blocks"
import { leadExtension } from "../metadata/extend"
import { seedForwardingForms } from "../mocks/forms-seed"

describe("forwarding form blocks (B4.2)", () => {
  it("TC-4.2-04 are offered only while the module is active", () => {
    expect(getFormBlocks(["forwarding"]).map((block) => block.id)).toEqual([
      "forwarding.route",
      "forwarding.cargo",
      "forwarding.containers",
      "forwarding.incoterm",
      "forwarding.readyDate",
    ])
    expect(getFormBlocks([])).toEqual([])
  })

  it("map every field to the freight request field of the same key and type", () => {
    const leadFields = new Map(
      (leadExtension.fields ?? []).map((field) => [field.key, field])
    )
    for (const block of forwardingFormBlocks) {
      for (const field of block.fields) {
        expect(field.mapTo, `${block.id}.${field.key}`).toBe(field.key)
        expect(leadFields.get(field.key)?.type, field.key).toBe(field.type)
      }
    }
  })
})

describe("freight quote form logic (B4.4)", () => {
  it("TC-4.4-02 containers are hidden for air freight and required for FCL", () => {
    const form = seedForwardingForms().forms.find(
      (row) => row.id === "form_freight"
    )!
    const content = migrateFormContent(form.draft)
    const id = (key: string) =>
      content.fields.find((field) => field.key === key)!.id

    const air = evaluateFormLogic(content, { transportMode: "AIR" })
    expect(air.hiddenFields.has(id("containers"))).toBe(true)
    expect(air.hiddenFields.has(id("dimensions"))).toBe(false)

    const fcl = evaluateFormLogic(content, { transportMode: "SEA_FCL" })
    expect(fcl.hiddenFields.has(id("containers"))).toBe(false)
    expect(fcl.hiddenFields.has(id("dimensions"))).toBe(true)
    expect(fcl.requiredFields.has(id("containers"))).toBe(true)

    const errors = (answers: Record<string, unknown>) => {
      const result = formDefToZod(content, answers).safeParse(answers)
      return result.success
        ? []
        : result.error.issues.map((issue) => issue.path[0])
    }
    expect(errors({ transportMode: "AIR", containers: null })).not.toContain(
      "containers"
    )
    expect(errors({ transportMode: "SEA_FCL", containers: null })).toContain(
      "containers"
    )
  })
})
