import { describe, expect, it } from "vitest"

import "@/app/modules"
import { getFormBlocks } from "@/engine/modules"

import { forwardingFormBlocks } from "../form-blocks"
import { leadExtension } from "../metadata/extend"

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
