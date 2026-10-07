import { fireEvent, waitFor } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import "@/app/modules"
import { formatFieldValue, getFieldType } from "@/engine/field-types"
import type { FieldDef } from "@/engine/metadata"
import { metadataToZod } from "@/engine/records"
import { signInAs } from "@/test/auth"
import { renderWithProviders, screen } from "@/test/render"

import {
  fetchCarriers,
  fetchFxRates,
  fetchLocations,
} from "../api/reference.api"
import { searchLocations } from "../mocks/reference-handlers"
import { location } from "../mocks/reference/locations"

const field = (
  key: string,
  type: string,
  extra: Partial<FieldDef> = {}
): FieldDef => ({
  key,
  label: { tr: key, en: key },
  type,
  ...extra,
})

const valid = (type: string, value: unknown) =>
  getFieldType(type).toZod(field("x", type)).safeParse(value).success

function Harness({
  definition,
  onChange,
}: {
  definition: FieldDef
  onChange: (v: unknown) => void
}) {
  const [value, setValue] = useState<unknown>(null)
  const Input = getFieldType(definition.type).Input
  return (
    <div>
      <label htmlFor="field" id="field-label">
        Alan
      </label>
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

async function renderInput(definition: FieldDef) {
  const onChange = vi.fn()
  const utils = await renderWithProviders(
    <Harness definition={definition} onChange={onChange} />
  )
  return { ...utils, last: () => onChange.mock.calls.at(-1)?.[0] }
}

describe("forwarding field types (B3.2)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  it("location types accept only their kinds and format as “Name (CODE)”", () => {
    const hamburg = location("DEHAM")
    const frankfurt = location("FRA")
    expect(valid("port", hamburg)).toBe(true)
    expect(valid("port", frankfurt)).toBe(false)
    expect(valid("airport", frankfurt)).toBe(true)
    expect(valid("location", frankfurt)).toBe(true)
    expect(valid("location", { code: "X" })).toBe(false)
    expect(
      formatFieldValue(field("o", "port"), hamburg, { language: "tr" })
    ).toBe("Hamburg (DEHAM)")
    expect(getFieldType("port").toComparable(hamburg)).toBe("Hamburg DEHAM")
    expect(getFieldType("port").isEmpty(null)).toBe(true)
  })

  it("cargo types validate and format containers, dimensions, weight and volume", () => {
    expect(valid("container", [{ type: "40HC", count: 2 }])).toBe(true)
    expect(valid("container", [{ type: "99XX", count: 2 }])).toBe(false)
    expect(valid("container", [])).toBe(false)
    expect(
      formatFieldValue(
        field("c", "container"),
        [
          { type: "40HC", count: 2 },
          { type: "20DC", count: 1 },
        ],
        { language: "tr" }
      )
    ).toBe("2 × 40HC, 1 × 20DC")
    expect(
      getFieldType("container").toComparable([{ type: "40HC", count: 3 }])
    ).toBe(3)

    const dims = [{ length: 120, width: 80, height: 100, quantity: 2 }]
    expect(valid("dimensions", dims)).toBe(true)
    expect(valid("dimensions", [{ ...dims[0], quantity: 0 }])).toBe(false)
    expect(getFieldType("dimensions").toComparable(dims)).toBe(1.92)
    expect(
      formatFieldValue(field("d", "dimensions"), dims, { language: "tr" })
    ).toBe("2 × 120×80×100 cm")

    expect(valid("weight", 1200.5)).toBe(true)
    expect(valid("weight", -1)).toBe(false)
    expect(
      formatFieldValue(field("w", "weight"), 1200.5, { language: "en" })
    ).toBe("1,200.5 kg")
    expect(
      formatFieldValue(field("v", "volume"), 2.5, { language: "tr" })
    ).toBe("2,5 m³")
  })

  it("trade types validate HS codes and dangerous goods", () => {
    expect(valid("hsCode", "8471.30")).toBe(true)
    expect(valid("hsCode", "847130")).toBe(true)
    expect(valid("hsCode", "84")).toBe(false)
    expect(valid("dangerousGoods", { imoClass: "3", unNumber: "1203" })).toBe(
      true
    )
    expect(valid("dangerousGoods", { imoClass: "3", unNumber: "12" })).toBe(
      false
    )
    expect(
      formatFieldValue(
        field("g", "dangerousGoods"),
        { imoClass: "3", unNumber: "1203" },
        { language: "tr" }
      )
    ).toBe("IMO 3 · UN1203")
  })

  it("TC-3.2-04 port autocomplete finds ports by code and by name", async () => {
    expect(searchLocations("deham", ["port"])[0]?.code).toBe("DEHAM")
    expect(
      searchLocations("hamb", ["port"]).map((item) => item.code)
    ).toContain("DEHAM")
    // Turkish letters are folded: "izmir" finds "İzmir".
    expect(searchLocations("izmir", ["port"])[0]?.code).toBe("TRIZM")
    expect(searchLocations("", ["airport"])).toHaveLength(20)
    expect(searchLocations("fra", ["airport"])[0]?.code).toBe("FRA")

    const { user, last } = await renderInput(field("origin", "port"))
    const input = screen.getByRole("combobox", { name: "Alan" })
    await user.type(input, "hamburg")
    // Wait for the debounced search, not the initial list.
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1))
    await user.click(screen.getByRole("option", { name: /Hamburg/ }))
    expect(last()).toEqual(location("DEHAM"))
  })

  it("serves the reference data through the API", async () => {
    const ports = await fetchLocations({ q: "rotterdam", kinds: ["port"] })
    expect(ports.map((item) => item.code)).toEqual(["NLRTM"])
    const everything = await fetchLocations({})
    expect(everything.length).toBeGreaterThan(0)
    expect(
      (await fetchCarriers("air")).every((item) => item.kind === "air")
    ).toBe(true)
    expect((await fetchCarriers()).length).toBe(25)
    expect((await fetchFxRates()).rates.USD).toBe(1)
  })

  it("container input adds, edits and removes rows", async () => {
    const { user, last } = await renderInput(field("containers", "container"))
    await user.click(screen.getByRole("button", { name: "Konteyner ekle" }))
    expect(last()).toEqual([{ type: "40HC", count: 1 }])

    const count = screen.getByRole("spinbutton", { name: "Adet" })
    fireEvent.change(count, { target: { value: "3" } })
    expect(last()).toEqual([{ type: "40HC", count: 3 }])

    await user.click(screen.getByRole("button", { name: "Satırı kaldır" }))
    expect(last()).toBeNull()
  })

  it("dimension input shows the total volume", async () => {
    const { user, last } = await renderInput(field("dimensions", "dimensions"))
    await user.click(screen.getByRole("button", { name: "Ölçü satırı ekle" }))
    expect(last()).toEqual([
      { length: 120, width: 80, height: 100, quantity: 1 },
    ])
    fireEvent.change(screen.getByRole("spinbutton", { name: "Adet" }), {
      target: { value: "2" },
    })
    await waitFor(() =>
      expect(screen.getByText("Toplam hacim: 1,92 m³")).toBeInTheDocument()
    )
  })

  it("dangerous goods input emits a structured value", async () => {
    const { user, last } = await renderInput(field("goods", "dangerousGoods"))
    await user.type(
      screen.getByRole("textbox", { name: "UN numarası" }),
      "1203"
    )
    expect(last()).toEqual({ imoClass: "", unNumber: "1203" })
  })

  it("HS code input emits the typed code", async () => {
    const { user, last } = await renderInput(field("hs", "hsCode"))
    await user.type(screen.getByRole("textbox", { name: "Alan" }), "8471")
    expect(last()).toBe("8471")
  })

  it("weight input carries its unit", async () => {
    const { last } = await renderInput(field("grossWeight", "weight"))
    expect(screen.getByText("kg")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("spinbutton", { name: "Alan" }), {
      target: { value: "1500" },
    })
    expect(last()).toBe(1500)
  })

  it("TC-3.3-01 conditional fields are validated only while visible", () => {
    const def = {
      key: "lead",
      label: { tr: "Lead", en: "Lead" },
      pluralLabel: { tr: "Lead", en: "Lead" },
      icon: "inbox",
      primaryField: "name",
      fields: [
        field("name", "text", { required: true }),
        field("transportMode", "select", {
          options: [
            { value: "SEA_FCL", label: { tr: "FCL", en: "FCL" } },
            { value: "AIR", label: { tr: "Hava", en: "Air" } },
          ],
        }),
        field("containers", "container", {
          required: true,
          visibleWhen: [
            { field: "transportMode", op: "in", value: ["SEA_FCL"] },
          ],
        }),
      ],
      layouts: {
        list: { columns: ["name"] },
        detail: { highlights: [], sections: [], related: [] },
      },
    }
    const schema = metadataToZod(def)
    expect(schema.safeParse({ name: "A", transportMode: "AIR" }).success).toBe(
      true
    )
    const fcl = schema.safeParse({ name: "A", transportMode: "SEA_FCL" })
    expect(fcl.success).toBe(false)
    expect(fcl.error?.issues[0]?.path).toEqual(["containers"])
    // PATCH: a hidden field is only checked when it is sent.
    const partial = metadataToZod(def, {
      partial: true,
      current: { name: "A", transportMode: "SEA_FCL" },
    })
    expect(partial.safeParse({ name: "B" }).success).toBe(true)
    expect(partial.safeParse({ containers: null }).success).toBe(false)
  })
})
