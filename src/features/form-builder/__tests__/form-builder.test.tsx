import { fireEvent, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { migrateFormContent } from "@/engine/forms"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { server } from "@/mocks/node"
import { renderRoute, screen } from "@/test/render"

const draftOf = (id: string) => migrateFormContent(db.forms.findById(id)!.draft)

function setWidth(width: number) {
  window.innerWidth = width
  fireEvent(window, new Event("resize"))
}

async function openBuilder(
  formId = "form_agent",
  as: "owner" | "manager" = "owner"
) {
  const utils = await renderRoute(`/forms/${formId}/edit`, { as })
  await screen.findByRole("textbox", { name: "Form adı" })
  return utils
}

const canvas = () => screen.getByRole("list", { name: "Adımdaki alanlar" })
const canvasLabels = () =>
  within(canvas())
    .getAllByRole("button", { name: /alanını düzenle$/ })
    .map((button) =>
      button.getAttribute("aria-label")!.replace(/ alanını düzenle$/, "")
    )

function countPatches() {
  const patches: unknown[] = []
  server.events.on("request:start", ({ request }) => {
    if (request.method === "PATCH" && request.url.includes("/forms/")) {
      patches.push(request.url)
    }
  })
  return patches
}

describe("form builder (B4.2)", () => {
  beforeEach(() => setWidth(1600))
  afterEach(() => setWidth(1024))

  it("lists forms with their stats; viewers cannot create or edit", async () => {
    await renderRoute("/forms", { as: "viewer" })
    expect(
      await screen.findByRole("heading", { name: "Formlar", level: 1 })
    ).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "Formlar" })
    expect(within(table).getByText("Navlun Teklif Formu")).toBeInTheDocument()
    expect(within(table).getByText("3.420")).toBeInTheDocument()
    expect(
      within(table).queryByRole("link", { name: "Navlun Teklif Formu" })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Yeni form" })).toBeNull()
  })

  it("creates a form and opens it in the editor", async () => {
    const { user, router } = await renderRoute("/forms", { as: "owner" })
    await user.click(await screen.findByRole("button", { name: "Yeni form" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni form" })
    await user.type(
      within(dialog).getByLabelText("Form adı"),
      "Gümrük Danışmanlığı"
    )
    expect(within(dialog).getByLabelText("Bağlantı adı")).toHaveValue(
      "gumruk-danismanligi"
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Formu oluştur" })
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/forms\/form_.+\/edit$/)
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(
      await screen.findByRole("textbox", { name: "Form adı" })
    ).toHaveValue("Gümrük Danışmanlığı")
    await screen.findByRole("list", { name: "Adımdaki alanlar" })
    expect(canvasLabels()).toEqual([
      "Ad soyad",
      "Firma adı",
      "E-posta",
      "Telefon",
      "Mesajınız",
      "Kişisel verilerimin KVKK kapsamında işlenmesini kabul ediyorum.",
    ])
  })

  it("TC-4.2-01 adds palette fields below the selection and edits them", async () => {
    const { user } = await openBuilder()
    await user.click(
      screen.getByRole("button", { name: "Ad soyad alanını düzenle" })
    )
    await user.click(screen.getByRole("button", { name: "Kısa metin ekle" }))
    expect(canvasLabels().slice(0, 3)).toEqual([
      "Ad soyad",
      "Kısa metin",
      "Firma adı",
    ])
    expect(
      screen.getByRole("button", { name: "Kısa metin alanını düzenle" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("heading", { name: "Alan özellikleri" })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Açılır liste ekle" }))
    expect(canvasLabels()[2]).toBe("Seçim")
    // Layout blocks too.
    await user.click(screen.getByRole("button", { name: "Bölüm ayırıcı ekle" }))
    expect(canvasLabels()).toContain("Ayırıcı")
  })

  it("TC-4.2-03 undo / redo with buttons and shortcuts; Delete removes the selection", async () => {
    const { user } = await openBuilder()
    const count = canvasLabels().length
    await user.click(screen.getByRole("button", { name: "Tarih ekle" }))
    expect(canvasLabels()).toHaveLength(count + 1)

    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect(canvasLabels()).toHaveLength(count)
    await user.click(screen.getByRole("button", { name: "Yinele" }))
    expect(canvasLabels()).toContain("Tarih")

    // Shortcuts act outside text inputs (the new field is still selected).
    expect(
      screen.getByRole("button", { name: "Tarih alanını düzenle" })
    ).toHaveAttribute("aria-pressed", "true")
    await user.keyboard("{Control>}d{/Control}")
    expect(canvasLabels().filter((label) => label === "Tarih")).toHaveLength(2)
    await user.keyboard("{Delete}")
    expect(canvasLabels().filter((label) => label === "Tarih")).toHaveLength(1)
    await user.keyboard("{Control>}z{/Control}")
    expect(canvasLabels().filter((label) => label === "Tarih")).toHaveLength(2)
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}")
    expect(canvasLabels().filter((label) => label === "Tarih")).toHaveLength(1)

    // Moving with the buttons.
    await user.click(
      screen.getByRole("button", { name: "Tarih alanını yukarı taşı" })
    )
    expect(canvasLabels().indexOf("Tarih")).toBe(count - 1)
  })

  it("TC-4.2-04 a forwarding block brings its fields and CRM mapping", async () => {
    const { user } = await openBuilder()
    expect(
      screen.getByRole("heading", { name: "Forwarding (Lojistik) blokları" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Rota ekle" }))
    expect(canvasLabels().slice(-3)).toEqual([
      "Taşıma modu",
      "Çıkış noktası",
      "Varış noktası",
    ])
    expect(
      within(canvas()).getAllByText("CRM'e eşli").length
    ).toBeGreaterThanOrEqual(3)

    await screen.findByText(
      "Tüm değişiklikler kaydedildi",
      {},
      { timeout: 3000 }
    )
    const draft = draftOf("form_agent")
    const mapped = Object.entries(draft.mapping.fields).map(([id, target]) => [
      draft.fields.find((field) => field.id === id)?.key,
      target,
    ])
    expect(mapped).toEqual(
      expect.arrayContaining([
        ["transportMode", "transportMode"],
        ["origin", "origin"],
        ["destination", "destination"],
      ])
    )
  })

  it("TC-4.2-04 no module blocks while the module is inactive", async () => {
    db.workspaces.update(WORKSPACE_IDS.acme, { modules: [] })
    await openBuilder()
    expect(screen.queryByRole("heading", { name: /blokları/ })).toBeNull()
    expect(
      screen.getByRole("button", { name: "Kısa metin ekle" })
    ).toBeInTheDocument()
  })

  it("TC-4.2-05 autosave sends one debounced PATCH with the latest draft", async () => {
    const patches = countPatches()
    const { user } = await openBuilder()
    await user.click(
      screen.getByRole("button", { name: "Ad soyad alanını düzenle" })
    )
    const label = screen.getByRole("textbox", { name: "Etiket (Türkçe)" })
    await user.clear(label)
    await user.type(label, "Adınız soyadınız")
    expect(patches).toHaveLength(0)
    expect(screen.getByText("Kaydediliyor…")).toBeInTheDocument()

    await screen.findByText(
      "Tüm değişiklikler kaydedildi",
      {},
      { timeout: 3000 }
    )
    expect(patches).toHaveLength(1)
    expect(draftOf("form_agent").fields[0]?.label.tr).toBe("Adınız soyadınız")

    // Renaming the form is saved the same way.
    const name = screen.getByRole("textbox", { name: "Form adı" })
    await user.clear(name)
    await user.type(name, "Acente Başvurusu")
    await waitFor(
      () =>
        expect(db.forms.findById("form_agent")?.name).toBe("Acente Başvurusu"),
      { timeout: 3000 }
    )
    expect(patches).toHaveLength(2)
  })

  it("narrow screens open the palette in a sheet", async () => {
    setWidth(1024)
    const { user } = await openBuilder()
    expect(screen.queryByRole("navigation", { name: "Alan paleti" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Alan ekle" }))
    const sheet = await screen.findByRole("dialog", { name: "Alan ekle" })
    await user.click(
      within(sheet).getByRole("button", { name: "Telefon ekle" })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Alan ekle" })).toBeNull()
    )
    expect(canvasLabels().filter((label) => label === "Telefon")).toHaveLength(
      2
    )
  })
})
