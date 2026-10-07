import { fireEvent, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { renderRoute, screen } from "@/test/render"

function setWidth(width: number) {
  window.innerWidth = width
  fireEvent(window, new Event("resize"))
}

async function openMapping() {
  const utils = await renderRoute("/forms/form_agent/edit?tab=mapping", {
    as: "owner",
  })
  await screen.findByRole("heading", { name: "CRM eşleme" })
  return utils
}

const requiredCard = () =>
  screen
    .getByText("Zorunlu Lead alanları")
    .closest("[data-slot=card]") as HTMLElement

describe("mapping panel (B4.5)", () => {
  beforeEach(() => setWidth(1600))
  afterEach(() => setWidth(1024))

  it("TC-4.5-01 shows required lead fields and their sources", async () => {
    const { user } = await openMapping()
    expect(within(requiredCard()).getByText("← Ad soyad")).toBeInTheDocument()

    await user.click(
      screen.getByRole("combobox", { name: "Ad soyad için hedef alan" })
    )
    await user.click(await screen.findByRole("option", { name: "Eşleme yok" }))
    expect(within(requiredCard()).getByText("eşlenmedi")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Otomatik eşle" }))
    expect(within(requiredCard()).getByText("← Ad soyad")).toBeInTheDocument()
  })

  it("TC-4.5-02 offers only type compatible lead fields", async () => {
    const { user } = await openMapping()
    await user.click(
      screen.getByRole("combobox", { name: "E-posta için hedef alan" })
    )
    const listbox = await screen.findByRole("listbox")
    const names = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent)
    // E-mail and free text fields; used targets ("Ad soyad", "Firma adı")
    // are not offered twice.
    expect(names).toEqual(["Eşleme yok", "E-posta", "Emtia"])
    await user.keyboard("{Escape}")

    await user.click(
      screen.getByRole("combobox", {
        name: "Verdiğiniz hizmetler için hedef alan",
      })
    )
    const services = within(await screen.findByRole("listbox"))
      .getAllByRole("option")
      .map((option) => option.textContent)
    expect(services).toEqual(["Eşleme yok", "Etiketler"])
  })

  it("duplicate rule needs an e-mail mapping; tracking fields are added once", async () => {
    const { user } = await openMapping()
    const link = screen.getByRole("radio", {
      name: "E-posta ile mevcut kişiye bağla",
    })
    expect(link).not.toHaveAttribute("aria-disabled", "true")
    await user.click(link)
    expect(link).toBeChecked()

    await user.click(
      screen.getByRole("combobox", { name: "E-posta için hedef alan" })
    )
    await user.click(await screen.findByRole("option", { name: "Eşleme yok" }))
    expect(
      screen.getByText(
        "Kişiye bağlamak için bir e-posta alanını e-posta hedefine eşleyin."
      )
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "UTM ve referrer alanları ekle" })
    )
    expect(
      screen.getByRole("button", { name: "İzleme alanları eklendi" })
    ).toBeDisabled()
    for (const name of ["UTM kaynağı", "UTM kampanyası", "Yönlendiren sayfa"]) {
      expect(screen.getByRole("cell", { name })).toBeInTheDocument()
    }
  })
})
