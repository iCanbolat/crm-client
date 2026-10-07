import { describe, expect, it } from "vitest"

import type { ObjectDef } from "@/engine/metadata"
import {
  applyModuleMetadata,
  applyObjectExtension,
  getDashboardWidgets,
  getModuleObjects,
  isModuleActive,
  registerModules,
  stripInactiveModules,
  type ModuleManifest,
} from "@/engine/modules"
import { getFieldType, hasFieldType } from "@/engine/field-types"
import { ShipIcon } from "lucide-react"

import { field, testObject } from "./fixtures"

const t = (text: string) => ({ tr: text, en: text })

function lead(): ObjectDef {
  return {
    ...testObject(),
    key: "lead",
    pipeline: {
      field: "stage",
      stages: [
        { key: "new", label: t("Yeni"), kind: "open" },
        { key: "won", label: t("Kazanıldı"), kind: "won" },
      ],
    },
    layouts: {
      list: { columns: ["name"] },
      detail: {
        highlights: ["name"],
        sections: [
          { key: "main", label: t("Ana"), fields: ["name"] },
          { key: "system", label: t("Sistem"), fields: ["ownerId"] },
        ],
        related: [],
      },
    },
  }
}

const quote: ObjectDef = {
  ...testObject(),
  key: "quote",
  fields: [field("number", "text")],
  primaryField: "number",
}

const manifest: ModuleManifest = {
  id: "forwarding",
  status: "active",
  label: t("Forwarding"),
  description: t("Lojistik"),
  icon: ShipIcon,
  objects: [quote],
  extend: {
    lead: {
      fields: [field("origin", "port"), field("mode", "select")],
      fieldPatches: { reason: { helpText: t("Neden?") } },
      sections: [
        { key: "freight", label: t("Rota"), fields: ["origin", "mode"] },
        { key: "main", label: t("Ana"), fields: ["mode"] },
      ],
      columns: ["origin", "name"],
      related: [{ objectKey: "quote", field: "leadId" }],
      pipeline: {
        field: "stage",
        stages: [
          { key: "open", label: t("Açık"), kind: "open", color: "blue" },
          { key: "done", label: t("Bitti"), kind: "won" },
        ],
      },
    },
  },
  fieldTypes: [{ ...getFieldType("text"), type: "port", creatable: false }],
  dashboardWidgets: [{ id: "w1", size: 2, component: () => null }],
}

describe("module system (B3.1)", () => {
  it("TC-3.1-01 merges a module's extension into a core object", () => {
    const merged = applyObjectExtension(
      lead(),
      "forwarding",
      manifest.extend!.lead!
    )

    const origin = merged.fields.find((item) => item.key === "origin")
    expect(origin).toMatchObject({ type: "port", moduleId: "forwarding" })
    expect(
      merged.fields.find((item) => item.key === "reason")?.helpText
    ).toEqual(t("Neden?"))
    // New sections go before the system block; existing ones are merged.
    expect(
      merged.layouts.detail.sections.map((section) => section.key)
    ).toEqual(["main", "freight", "system"])
    expect(merged.layouts.detail.sections[0]!.fields).toEqual(["name", "mode"])
    expect(merged.layouts.list.columns).toEqual(["name", "origin"])
    expect(merged.layouts.detail.related).toEqual([
      { objectKey: "quote", field: "leadId" },
    ])
    // A replaced pipeline rewrites the stage options.
    expect(merged.pipeline?.stages.map((stage) => stage.key)).toEqual([
      "open",
      "done",
    ])
    expect(merged.fields.find((item) => item.key === "stage")?.options).toEqual(
      [
        { value: "open", label: t("Açık"), color: "blue" },
        { value: "done", label: t("Bitti") },
      ]
    )
  })

  it("TC-3.1-01 is idempotent and refuses to redefine foreign fields", () => {
    const once = applyModuleMetadata([lead()], manifest)
    const twice = applyModuleMetadata(once, manifest)
    expect(twice).toEqual(once)
    expect(once.map((def) => def.key)).toEqual(["lead", "quote"])
    expect(getModuleObjects(manifest)[0]?.moduleId).toBe("forwarding")

    expect(() =>
      applyObjectExtension(lead(), "forwarding", {
        fields: [field("name", "text")],
      })
    ).toThrow(/cannot redefine/)
  })

  it("TC-3.1-02 strips objects and fields of inactive modules", () => {
    const defs = applyModuleMetadata([lead()], manifest)
    const stripped = stripInactiveModules(defs, () => false)

    expect(stripped.map((def) => def.key)).toEqual(["lead"])
    const leadDef = stripped[0]!
    expect(leadDef.fields.some((item) => item.key === "origin")).toBe(false)
    expect(leadDef.layouts.list.columns).toEqual(["name"])
    expect(
      leadDef.layouts.detail.sections.map((section) => section.key)
    ).toEqual(["main", "system"])
    // Active modules leave the metadata untouched.
    expect(stripInactiveModules(defs, () => true)).toEqual(defs)
  })

  it("registers module field types and widgets of active modules only", () => {
    registerModules([
      manifest,
      { ...manifest, id: "health-tourism", status: "coming-soon" },
    ])
    expect(hasFieldType("port")).toBe(true)
    expect(
      getDashboardWidgets(["forwarding"]).map((widget) => widget.id)
    ).toEqual(["w1"])
    expect(getDashboardWidgets([])).toEqual([])
    expect(isModuleActive("forwarding", ["forwarding"])).toBe(true)
    expect(isModuleActive("health-tourism", ["health-tourism"])).toBe(false)
    expect(isModuleActive(undefined, [])).toBe(true)
  })
})
