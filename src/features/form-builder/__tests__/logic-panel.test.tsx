import { fireEvent, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { migrateFormContent } from "@/engine/forms"
import { db } from "@/mocks/db"
import { renderRoute, screen } from "@/test/render"

function setWidth(width: number) {
  window.innerWidth = width
  fireEvent(window, new Event("resize"))
}

async function openLogic(formId = "form_agent") {
  const utils = await renderRoute(`/forms/${formId}/edit?tab=logic`, {
    as: "owner",
  })
  await screen.findByRole("heading", { name: "Koşullu mantık" })
  return utils
}

describe("logic panel (B4.4)", () => {
  beforeEach(() => setWidth(1600))
  afterEach(() => setWidth(1024))

  it("builds a show rule that the canvas and the preview follow", async () => {
    const { user } = await openLogic()
    expect(screen.getByText("Henüz kural yok")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Kural ekle" }))
    const card = screen.getByRole("listitem", { name: "Kural 1" })
    expect(within(card).getByText(/Kuralı tamamlayın/)).toBeInTheDocument()

    await user.click(
      within(card).getByRole("combobox", { name: "Koşul 1 alanı" })
    )
    await user.click(
      await screen.findByRole("option", { name: "Verdiğiniz hizmetler" })
    )
    expect(
      within(card).getByRole("combobox", { name: "Koşul 1 operatörü" })
    ).toHaveTextContent("şunlardan biri")

    await user.click(
      within(card).getByRole("button", { name: "Koşul 1 değeri" })
    )
    await user.click(
      await screen.findByRole("menuitemcheckbox", { name: "Hava yolu" })
    )
    await user.keyboard("{Escape}")

    await user.click(within(card).getByRole("button", { name: "Hedefler" }))
    await user.click(
      await screen.findByRole("menuitemcheckbox", { name: "Firma adı" })
    )
    await user.keyboard("{Escape}")
    await waitFor(() =>
      expect(within(card).queryByText(/Kuralı tamamlayın/)).toBeNull()
    )

    // Canvas badge on the target.
    await user.click(screen.getByRole("tab", { name: "Alanlar" }))
    const target = (
      await screen.findByRole("button", { name: "Firma adı alanını düzenle" })
    ).closest("li")!
    expect(within(target).getByText("Koşullu")).toBeInTheDocument()

    // Preview: hidden until "Hava yolu" is ticked.
    await user.click(screen.getByRole("button", { name: "Önizle" }))
    const dialog = await screen.findByRole("dialog", { name: /Önizleme/ })
    expect(within(dialog).queryByLabelText("Firma adı")).toBeNull()
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Hava yolu" })
    )
    expect(within(dialog).getByLabelText("Firma adı")).toBeInTheDocument()

    await screen.findByText(
      "Tüm değişiklikler kaydedildi",
      {},
      { timeout: 3000 }
    )
    const saved = migrateFormContent(
      db.forms.findById("form_agent")!.draft
    ).logic
    expect(saved).toEqual([
      expect.objectContaining({
        action: "show",
        conditions: [{ field: "fld_services", op: "in", value: ["air"] }],
        targets: [{ kind: "field", id: "fld_companyName" }],
      }),
    ])
  })

  it("TC-4.4-04 warns about cyclic rules", async () => {
    const row = db.forms.findById("form_agent")!
    const content = migrateFormContent(row.draft)
    const show = (id: string, from: string, to: string) => ({
      id,
      match: "all" as const,
      conditions: [{ field: from, op: "isNotEmpty" as const }],
      action: "show" as const,
      targets: [{ kind: "field" as const, id: to }],
    })
    content.logic = [
      show("a", "fld_name", "fld_email"),
      show("b", "fld_email", "fld_name"),
    ]
    db.forms.update(row.id, { draft: content })

    const { user } = await openLogic()
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Döngüsel kurallar var")
    expect(alert).toHaveTextContent("Ad soyad → E-posta → Ad soyad")

    await user.click(screen.getByRole("button", { name: "Kural 2 silinsin" }))
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
