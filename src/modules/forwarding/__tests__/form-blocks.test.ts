import { describe, expect, it } from "vitest"

import "@/app/modules"
import {
  evaluateFormLogic,
  formDefToZod,
  instantiateBlock,
  migrateFormContent,
  suggestMapping,
  validateMapping,
  type FormBlockDef,
  type FormContent,
} from "@/engine/forms"
import { getFormBlocks } from "@/engine/modules"
import { createStarterContent } from "@/features/form-builder"
import { getObjectDef } from "@/features/records/mocks/store"
import { WORKSPACE_IDS } from "@/mocks/db/seed"

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

describe("forwarding blocks → freight request (B4.5)", () => {
  it("TC-4.5-03 blocks map to compatible lead fields automatically", () => {
    const lead = getObjectDef(WORKSPACE_IDS.acme, "lead")!
    let content = createStarterContent()
    for (const block of forwardingFormBlocks) {
      content = addBlockFields(content, block)
    }
    const byKey = (key: string) =>
      content.fields.find((field) => field.key === key)!.id
    expect(content.mapping.fields).toMatchObject({
      [byKey("transportMode")]: "transportMode",
      [byKey("origin")]: "origin",
      [byKey("destination")]: "destination",
      [byKey("grossWeight")]: "grossWeight",
      [byKey("containers")]: "containers",
      [byKey("incoterm")]: "incoterm",
      [byKey("readyDate")]: "readyDate",
    })
    expect(validateMapping(content, lead)).toEqual([])

    // "Auto-map" finds the same targets for unmapped block fields.
    const unmapped = { ...content, mapping: { ...content.mapping, fields: {} } }
    expect(suggestMapping(unmapped, lead)).toEqual(content.mapping.fields)
  })
})

function addBlockFields(
  content: FormContent,
  block: FormBlockDef
): FormContent {
  const { fields, mapping } = instantiateBlock(block, {
    stepId: content.steps[0]!.id,
    takenKeys: new Set(content.fields.map((field) => field.key)),
  })
  return {
    ...content,
    fields: [...content.fields, ...fields],
    mapping: {
      ...content.mapping,
      fields: { ...content.mapping.fields, ...mapping },
    },
  }
}
