import { fireEvent, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { migrateFormContent } from "@/engine/forms"
import { db } from "@/mocks/db"
import { renderRoute, screen } from "@/test/render"

function setWidth(width: number) {
  window.innerWidth = width
  fireEvent(window, new Event("resize"))
}

async function openDesign(formId = "form_agent") {
  const utils = await renderRoute(`/forms/${formId}/edit?tab=design`, {
    as: "owner",
  })
  await screen.findByRole("heading", { name: "Canlı önizleme" })
  return utils
}

const preview = () =>
  screen
    .getByRole("heading", { name: "Canlı önizleme" })
    .closest("section") as HTMLElement
const themed = () =>
  preview().querySelector<HTMLElement>("[data-slot=form-theme]")!

describe("theme & settings (B4.6)", () => {
  beforeEach(() => setWidth(1600))
  afterEach(() => setWidth(1024))

  it("TC-4.6-01 theme changes restyle the live preview", async () => {
    const { user } = await openDesign()
    const primary = screen.getByRole("textbox", { name: "Ana renk" })
    await user.clear(primary)
    await user.type(primary, "#0F766E")
    expect(themed().style.getPropertyValue("--primary")).toBe("#0f766e")
    expect(themed().style.getPropertyValue("--primary-foreground")).toBe(
      "#ffffff"
    )

    fireEvent.input(screen.getByLabelText("Arka plan seçici"), {
      target: { value: "#fafaf9" },
    })
    expect(themed().style.getPropertyValue("--background")).toBe("#fafaf9")

    await user.click(screen.getByRole("button", { name: "Fazla" }))
    expect(themed().style.getPropertyValue("--radius")).toBe("0.875rem")

    await user.click(screen.getByRole("combobox", { name: "Yazı tipi" }))
    await user.click(await screen.findByRole("option", { name: "Serif" }))
    expect(themed().style.getPropertyValue("--form-font")).toMatch(/Georgia/)

    const button = screen.getByRole("textbox", { name: "Buton metni (Türkçe)" })
    await user.clear(button)
    await user.type(button, "Teklif iste")
    expect(
      within(preview()).getByRole("button", { name: "Teklif iste" })
    ).toBeInTheDocument()
  })

  it("TC-4.6-02 warns about low contrast colors", async () => {
    const { user } = await openDesign()
    expect(
      screen.queryByRole("list", { name: "Erişilebilirlik uyarıları" })
    ).toBeNull()
    const text = screen.getByRole("textbox", { name: "Metin rengi" })
    await user.clear(text)
    await user.type(text, "#cccccc")
    expect(
      within(
        screen.getByRole("list", { name: "Erişilebilirlik uyarıları" })
      ).getByText(/Metin ile arka plan kontrastı düşük \(1.61:1/)
    ).toBeInTheDocument()
  })

  it("TC-4.6-03 the mobile preview is phone wide", async () => {
    const { user } = await openDesign()
    const frame = () => preview().querySelector<HTMLElement>("[data-device]")!
    expect(frame().dataset.device).toBe("desktop")
    expect(frame().style.width).toBe("")
    await user.click(within(preview()).getByRole("button", { name: "Mobil" }))
    expect(frame().dataset.device).toBe("mobile")
    expect(frame().style.width).toBe("375px")
  })

  it("validates redirect, recipients and limit; saves settings", async () => {
    const { user } = await openDesign()
    const redirect = screen.getByRole("textbox", { name: "Yönlendirme adresi" })
    await user.type(redirect, "http://acme.test")
    expect(
      screen.getByText("https:// ile başlayan geçerli bir adres girin.")
    ).toBeInTheDocument()
    await user.clear(redirect)
    await user.type(redirect, "https://acme.test/tesekkurler")
    expect(
      screen.queryByText("https:// ile başlayan geçerli bir adres girin.")
    ).toBeNull()

    const email = screen.getByRole("textbox", { name: "Bildirim alıcıları" })
    await user.type(email, "satis@")
    await user.click(screen.getByRole("button", { name: "Ekle" }))
    expect(
      screen.getByText("Geçerli bir e-posta adresi girin.")
    ).toBeInTheDocument()
    await user.clear(email)
    await user.type(email, "Satis@Acme.test{Enter}")
    await user.type(email, "satis@acme.test{Enter}")
    expect(screen.getByText("Bu adres zaten listede.")).toBeInTheDocument()
    expect(
      within(
        screen.getByRole("list", { name: "Bildirim alıcıları" })
      ).getByText("satis@acme.test")
    ).toBeInTheDocument()

    const limit = screen.getByRole("textbox", { name: "Gönderim limiti" })
    await user.type(limit, "0")
    expect(
      screen.getByText("Pozitif bir tam sayı girin veya boş bırakın.")
    ).toBeInTheDocument()
    await user.clear(limit)
    await user.type(limit, "500")
    await user.click(
      screen.getByRole("switch", { name: "Spam koruması (honeypot)" })
    )

    await screen.findByText(
      "Tüm değişiklikler kaydedildi",
      {},
      { timeout: 3000 }
    )
    expect(
      migrateFormContent(db.forms.findById("form_agent")!.draft).settings
    ).toMatchObject({
      redirectUrl: "https://acme.test/tesekkurler",
      notifyEmails: ["satis@acme.test"],
      maxSubmissions: 500,
      honeypot: false,
    })
  })

  it("form languages and the link name", async () => {
    const { user } = await openDesign()
    expect(
      screen.getByRole("button", { name: "İngilizce" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "İngilizce" }))
    // Turkish only: no editor language switch, the last language stays.
    expect(screen.queryByRole("button", { name: "İngilizce" })).toBeNull()
    expect(screen.getByRole("checkbox", { name: "Türkçe" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )

    const slug = screen.getByRole("textbox", { name: "Bağlantı adı" })
    await user.clear(slug)
    await user.type(slug, "navlun-teklif")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(
      await screen.findByText("Bu bağlantı adı başka bir formda kullanılıyor.")
    ).toBeInTheDocument()
    await user.clear(slug)
    await user.type(slug, "acente-ol")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() =>
      expect(db.forms.findById("form_agent")?.slug).toBe("acente-ol")
    )
  })
})
