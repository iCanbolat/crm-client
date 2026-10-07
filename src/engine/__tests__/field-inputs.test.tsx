import { fireEvent, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  defaultFieldServices,
  FieldServicesProvider,
  getFieldType,
  type FieldServices,
} from "@/engine/field-types"
import { ModuleSlot, registerModules, getModules } from "@/engine/modules"
import type { FieldDef } from "@/engine/metadata"
import { renderWithProviders, screen } from "@/test/render"

import { field, testObject } from "./fixtures"

const def = (key: string) =>
  testObject().fields.find((item) => item.key === key)!

function Harness({
  definition,
  initial = null,
  onChange,
}: {
  definition: FieldDef
  initial?: unknown
  onChange: (value: unknown) => void
}) {
  const [value, setValue] = useState<unknown>(initial)
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

async function renderInput(
  definition: FieldDef,
  initial: unknown = null,
  services: Partial<FieldServices> = {}
) {
  const onChange = vi.fn()
  const utils = await renderWithProviders(
    <FieldServicesProvider value={{ ...defaultFieldServices, ...services }}>
      <Harness definition={definition} initial={initial} onChange={onChange} />
    </FieldServicesProvider>
  )
  return { ...utils, onChange, last: () => onChange.mock.calls.at(-1)?.[0] }
}

describe("field inputs (B2.1)", () => {
  it("text: emits the typed value and null when cleared", async () => {
    const { user, last } = await renderInput(field("name", "text"))
    const input = screen.getByRole("textbox", { name: "Alan" })

    await user.type(input, "Acme")
    expect(last()).toBe("Acme")
    await user.clear(input)
    expect(last()).toBeNull()
  })

  it("textarea and email render native inputs", async () => {
    const { user, last } = await renderInput(field("notes", "textarea"))
    await user.type(screen.getByRole("textbox", { name: "Alan" }), "Not")
    expect(last()).toBe("Not")
  })

  it("number and percent parse decimals", async () => {
    const { user, last } = await renderInput(field("count", "number"))
    const input = screen.getByRole("spinbutton", { name: "Alan" })

    await user.type(input, "12.5")
    expect(last()).toBe(12.5)
    await user.clear(input)
    expect(last()).toBeNull()
  })

  it("currency combines the amount with the workspace or chosen currency", async () => {
    const { user, last } = await renderInput(def("price"), null, {
      defaultCurrency: "USD",
    })

    await user.type(screen.getByRole("spinbutton", { name: "Alan" }), "1500")
    expect(last()).toEqual({ amount: 1500, currency: "USD" })

    await user.click(screen.getByRole("combobox", { name: "Para birimi" }))
    await user.click(await screen.findByRole("option", { name: "EUR" }))
    expect(last()).toEqual({ amount: 1500, currency: "EUR" })
  })

  it("date and datetime use native pickers (ISO values)", async () => {
    const { last } = await renderInput(def("day"))
    fireEvent.change(screen.getByLabelText("Alan"), {
      target: { value: "2026-10-05" },
    })
    expect(last()).toBe("2026-10-05")
  })

  it("datetime converts the local time to an ISO instant", async () => {
    const { last } = await renderInput(def("at"))
    fireEvent.change(screen.getByLabelText("Alan"), {
      target: { value: "2026-10-05T14:30" },
    })
    expect(last()).toBe(new Date("2026-10-05T14:30").toISOString())
  })

  it("boolean toggles a labelled checkbox", async () => {
    const { user, last } = await renderInput(def("active"))
    await user.click(screen.getByRole("checkbox", { name: "Alan" }))
    expect(last()).toBe(true)
  })

  it("select offers the options (and 'none' when optional)", async () => {
    const { user, last } = await renderInput({
      ...def("stage"),
      required: false,
    })

    await user.click(screen.getByRole("combobox", { name: "Alan" }))
    expect(
      await screen.findByRole("option", { name: "Seçilmedi" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("option", { name: "Kazanıldı" }))
    expect(last()).toBe("won")
  })

  it("multiselect keeps the option order of the field", async () => {
    const { user, last } = await renderInput(def("tags"))

    await user.click(screen.getByRole("button", { name: /Alan/ }))
    await user.click(
      await screen.findByRole("menuitemcheckbox", { name: "Sıcak" })
    )
    await user.click(screen.getByRole("menuitemcheckbox", { name: "VIP" }))
    expect(last()).toEqual(["vip", "hot"])

    await user.click(screen.getByRole("menuitemcheckbox", { name: "VIP" }))
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Sıcak" }))
    expect(last()).toBeNull()
  })

  it("phone builds an E.164 number from the dial code and the national number", async () => {
    const { user, last } = await renderInput(def("phone"))
    const input = screen.getByRole("textbox", { name: "Alan" })

    await user.type(input, "0532 123 45 67")
    expect(last()).toBe("+905321234567")

    await user.click(screen.getByRole("combobox", { name: "Ülke kodu" }))
    await user.click(await screen.findByRole("option", { name: /\+49/ }))
    expect(last()).toBe("+495321234567")
  })

  it("country searches by localized name", async () => {
    const { user, last } = await renderInput(def("country"))

    await user.type(screen.getByRole("combobox", { name: "Alan" }), "Alma")
    await user.click(await screen.findByRole("option", { name: /Almanya/ }))
    expect(last()).toBe("DE")
  })

  it("user lists the workspace users", async () => {
    const { user, last } = await renderInput(def("ownerId"), null, {
      users: [
        { id: "u1", name: "Elif Yılmaz" },
        { id: "u2", name: "Can Öztürk" },
      ],
    })

    await user.click(screen.getByRole("combobox", { name: "Alan" }))
    await user.click(await screen.findByRole("option", { name: "Can Öztürk" }))
    expect(last()).toBe("u2")
  })

  it("relation searches records and can create a new one", async () => {
    const searchRecords = vi.fn(async (_objectKey: string, q: string) =>
      [
        { id: "c1", label: "Acme Lojistik" },
        { id: "c2", label: "Beta Ticaret" },
      ].filter((item) => item.label.toLowerCase().includes(q.toLowerCase()))
    )
    const createRecord = vi.fn(async (_objectKey: string, label: string) => ({
      id: "c3",
      label,
    }))
    const { user, last } = await renderInput(def("companyId"), null, {
      searchRecords,
      createRecord,
    })
    const input = screen.getByRole("combobox", { name: "Alan" })

    await user.type(input, "acme")
    // The search is debounced while typing.
    await waitFor(() =>
      expect(searchRecords).toHaveBeenCalledWith(
        "company",
        "acme",
        expect.anything()
      )
    )
    await user.click(
      await screen.findByRole("option", { name: "Acme Lojistik" })
    )
    expect(last()).toBe("c1")

    await user.clear(input)
    await user.type(input, "Yeni Şirket")
    await user.click(
      await screen.findByRole("option", { name: "“Yeni Şirket” oluştur" })
    )
    await waitFor(() => expect(last()).toBe("c3"))
    expect(createRecord).toHaveBeenCalledWith("company", "Yeni Şirket")
  })

  it("file uploads through the services and removes files", async () => {
    const uploadFile = vi.fn(async (file: File) => ({
      id: `f-${file.name}`,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    }))
    const { user, last } = await renderInput(def("files"), null, { uploadFile })

    await user.upload(
      screen.getByLabelText("Alan"),
      new File(["%PDF"], "teklif.pdf", { type: "application/pdf" })
    )
    await waitFor(() =>
      expect(last()).toEqual([
        {
          id: "f-teklif.pdf",
          name: "teklif.pdf",
          size: 4,
          mimeType: "application/pdf",
        },
      ])
    )
    await user.click(
      screen.getByRole("button", { name: "teklif.pdf dosyasını kaldır" })
    )
    expect(last()).toBeNull()
  })

  it("unknown types render a read-only value", async () => {
    await renderInput(field("legacy", "nope"), { code: 7 })
    const input = screen.getByRole("textbox", { name: "Alan" })
    expect(input).toHaveValue('{"code":7}')
    expect(input).toHaveAttribute("readonly")
  })
})

describe("field cells (B2.1)", () => {
  const values: Record<string, unknown> = {
    name: "Acme",
    notes: "Satır 1",
    count: 1234,
    price: { amount: 99.5, currency: "USD" },
    ratio: 40,
    day: "2026-10-05",
    at: "2026-10-05T10:00:00.000Z",
    active: true,
    stage: "won",
    tags: ["vip", "hot"],
    email: "info@acme.test",
    phone: "+905321234567",
    site: "https://acme.test/iletisim",
    country: "DE",
    ownerId: "u1",
    companyId: "c1",
    files: [{ id: "f1", name: "a.pdf", size: 10, mimeType: "application/pdf" }],
  }

  it("renders every core type and an accessible placeholder for empty values", async () => {
    const fields = testObject().fields.filter((item) => item.key in values)
    await renderWithProviders(
      <FieldServicesProvider
        value={{
          ...defaultFieldServices,
          users: [{ id: "u1", name: "Elif Yılmaz" }],
        }}
      >
        <ul>
          {fields.map((item) => {
            const Cell = getFieldType(item.type).Cell
            return (
              <li key={item.key} data-testid={item.key}>
                <Cell
                  field={item}
                  value={values[item.key]}
                  refValue={
                    item.key === "companyId"
                      ? { id: "c1", label: "Acme Ltd" }
                      : null
                  }
                />
              </li>
            )
          })}
          {fields.map((item) => {
            const Cell = getFieldType(item.type).Cell
            return (
              <li key={`${item.key}-empty`} data-testid={`${item.key}-empty`}>
                <Cell field={item} value={null} />
              </li>
            )
          })}
        </ul>
      </FieldServicesProvider>
    )

    const cell = (key: string) => screen.getByTestId(key)
    expect(cell("count")).toHaveTextContent("1.234")
    expect(cell("price")).toHaveTextContent("$99,50")
    expect(cell("ratio")).toHaveTextContent("%40")
    expect(cell("active")).toHaveTextContent("Evet")
    expect(cell("stage")).toHaveTextContent("Kazanıldı")
    expect(cell("tags")).toHaveTextContent("VIPSıcak")
    expect(within(cell("email")).getByRole("link")).toHaveAttribute(
      "href",
      "mailto:info@acme.test"
    )
    expect(within(cell("phone")).getByRole("link")).toHaveTextContent(
      "+90 532 123 4567"
    )
    expect(within(cell("site")).getByRole("link")).toHaveTextContent(
      "acme.test/iletisim"
    )
    expect(cell("country")).toHaveTextContent("Almanya")
    expect(cell("ownerId")).toHaveTextContent("Elif Yılmaz")
    expect(
      within(cell("companyId")).getByRole("link", { name: "Acme Ltd" })
    ).toHaveAttribute("href", "/o/company/c1")
    expect(cell("files")).toHaveTextContent("a.pdf")
    expect(cell("day")).toHaveTextContent("5 Eki 2026")
    for (const item of fields) {
      expect(cell(`${item.key}-empty`)).toHaveTextContent("Boş")
    }
  })
})

describe("module slots", () => {
  it("renders slot components of active modules only", async () => {
    const original = getModules()
    registerModules([
      {
        ...original[0]!,
        status: "active",
        recordSlots: {
          "thing.detail.sidebar": [
            {
              id: "route-card",
              component: ({ record }) => <p>Rota: {record.id}</p>,
            },
          ],
        },
      },
    ])
    try {
      const record = { id: "r1", values: {}, refs: {} }
      const view = await renderWithProviders(
        <ModuleSlot
          name="thing.detail.sidebar"
          activeModuleIds={[original[0]!.id]}
          objectDef={testObject()}
          record={record}
        />
      )
      expect(screen.getByText("Rota: r1")).toBeInTheDocument()
      view.unmount()

      await renderWithProviders(
        <ModuleSlot
          name="thing.detail.sidebar"
          activeModuleIds={[]}
          objectDef={testObject()}
          record={record}
        />
      )
      expect(screen.queryByText("Rota: r1")).not.toBeInTheDocument()
    } finally {
      registerModules(original)
    }
  })
})
