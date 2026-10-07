import { fireEvent, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { renderRoute, screen } from "@/test/render"

function setWidth(width: number) {
  window.innerWidth = width
  fireEvent(window, new Event("resize"))
}

describe("publish flow (B4.7)", () => {
  beforeEach(() => setWidth(1600))
  afterEach(() => setWidth(1024))

  it("TC-4.7-02 publishes the draft and shows the embed code", async () => {
    const { user } = await renderRoute("/forms/form_agent/edit", {
      as: "owner",
    })
    await user.click(await screen.findByRole("button", { name: "Yayınla" }))
    const dialog = await screen.findByRole("dialog", {
      name: "v1 olarak yayınla",
    })
    expect(
      within(dialog).getByText("Form yayınlanmaya hazır.")
    ).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole("button", { name: "v1 olarak yayınla" })
    )

    const done = await screen.findByRole("dialog", { name: "v1 yayında" })
    expect(
      (
        within(done).getByRole("textbox", {
          name: "Form bağlantısı",
        }) as HTMLTextAreaElement
      ).value
    ).toMatch(
      /^http:\/\/acme-lojistik\.forms\.localhost(:\d+)?\/f\/acente-basvuru$/
    )
    await user.click(within(done).getByRole("tab", { name: "iframe" }))
    expect(
      (
        within(done).getByRole("textbox", {
          name: "iframe kodu",
        }) as HTMLTextAreaElement
      ).value
    ).toContain("/embed/acente-basvuru")
    await user.click(within(done).getByRole("tab", { name: "JavaScript" }))
    expect(
      (
        within(done).getByRole("textbox", {
          name: "JavaScript yerleştirme kodu",
        }) as HTMLTextAreaElement
      ).value
    ).toContain("crm-form:resize")
    await user.click(within(done).getByRole("button", { name: "Kapat" }))

    expect(db.forms.findById("form_agent")).toMatchObject({
      status: "published",
      publishedVersion: 1,
    })
    expect(await screen.findByText("Yayında")).toBeInTheDocument()
  })

  it("TC-4.5-01 blocks publishing until the lead name is mapped", async () => {
    const { user } = await renderRoute("/forms/form_agent/edit?tab=mapping", {
      as: "owner",
    })
    await user.click(
      await screen.findByRole("combobox", { name: "Ad soyad için hedef alan" })
    )
    await user.click(await screen.findByRole("option", { name: "Eşleme yok" }))

    await user.click(screen.getByRole("button", { name: "Yayınla" }))
    const dialog = await screen.findByRole("dialog", {
      name: "v1 olarak yayınla",
    })
    expect(
      within(dialog).getByText(
        "Zorunlu Ad soyad alanı bir form alanına eşlenmedi."
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "v1 olarak yayınla" })
    ).toBeDisabled()

    await user.click(within(dialog).getByRole("button", { name: "Düzelt" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("tab", { name: "CRM eşleme" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("TC-4.7-03 restores an old version into the editor", async () => {
    const { user } = await renderRoute("/forms/form_freight/edit?tab=publish", {
      as: "owner",
    })
    const v1 = await screen.findByRole("listitem", { name: "Versiyon 1" })
    await user.click(
      within(v1).getByRole("button", { name: "Taslağa geri yükle" })
    )
    const confirm = await screen.findByRole("alertdialog", {
      name: "v1 taslağa yüklensin mi?",
    })
    await user.click(
      within(confirm).getByRole("button", { name: "Taslağa geri yükle" })
    )
    expect(await screen.findByText("v1 taslağa yüklendi.")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Alanlar" }))
    await user.click(screen.getByRole("button", { name: /Yük ve rota/ }))
    expect(
      screen.queryByRole("button", {
        name: "Konteyner ihtiyacı alanını düzenle",
      })
    ).toBeNull()
    expect(
      screen.getByRole("button", { name: "Taşıma modu alanını düzenle" })
    ).toBeInTheDocument()
    // History starts over with the restored draft.
    expect(screen.getByRole("button", { name: "Geri al" })).toBeDisabled()
  })
})
