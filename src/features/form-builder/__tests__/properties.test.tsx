import { fireEvent, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { renderRoute, screen } from "@/test/render"

function setWidth(width: number) {
  window.innerWidth = width
  fireEvent(window, new Event("resize"))
}

const canvas = () => screen.getByRole("list", { name: "Adımdaki alanlar" })

async function openWithNewTextField() {
  const utils = await renderRoute("/forms/form_agent/edit", { as: "owner" })
  await screen.findByRole("textbox", { name: "Form adı" })
  await utils.user.click(
    screen.getByRole("button", { name: "Kısa metin ekle" })
  )
  return utils
}

describe("field properties & languages (B4.3)", () => {
  beforeEach(() => setWidth(1600))
  afterEach(() => setWidth(1024))

  it("TC-4.3-01 property changes show on the canvas immediately", async () => {
    const { user } = await openWithNewTextField()
    const tr = screen.getByRole("textbox", { name: "Etiket (Türkçe)" })
    await user.clear(tr)
    await user.type(tr, "Liman kodu")
    expect(
      screen.getByRole("button", { name: "Liman kodu alanını düzenle" })
    ).toBeInTheDocument()
    expect(within(canvas()).getByText("Liman kodu")).toBeInTheDocument()

    await user.type(
      screen.getByRole("textbox", { name: "Yer tutucu (Türkçe)" }),
      "TRIST"
    )
    expect(within(canvas()).getByPlaceholderText("TRIST")).toBeInTheDocument()

    await user.type(
      screen.getByRole("textbox", { name: "Yardım metni (Türkçe)" }),
      "UN/LOCODE"
    )
    expect(within(canvas()).getByText("UN/LOCODE")).toBeInTheDocument()

    await user.click(screen.getByRole("switch", { name: "Zorunlu alan" }))
    const card = screen
      .getByRole("button", { name: "Liman kodu alanını düzenle" })
      .closest("li")!
    expect(within(card).getByText("(zorunlu)")).toBeInTheDocument()

    // Width and key.
    await user.click(screen.getByRole("button", { name: "Yarım satır" }))
    const key = screen.getByRole("textbox", { name: "Yanıt anahtarı" })
    await user.clear(key)
    await user.type(key, "1x")
    expect(screen.getByText(/Küçük harfle başlayan/)).toBeInTheDocument()
    await user.clear(key)
    await user.type(key, "email")
    expect(
      screen.getByText("Bu anahtar başka bir alanda kullanılıyor.")
    ).toBeInTheDocument()
    await user.clear(key)
    await user.type(key, "portCode")
    expect(
      screen.queryByText("Bu anahtar başka bir alanda kullanılıyor.")
    ).toBeNull()
  })

  it("TC-4.3-02 the regex rule works in the preview", async () => {
    const { user } = await openWithNewTextField()
    const tr = screen.getByRole("textbox", { name: "Etiket (Türkçe)" })
    await user.clear(tr)
    await user.type(tr, "Liman kodu")
    const pattern = screen.getByRole("textbox", {
      name: "Biçim (düzenli ifade)",
    })
    await user.click(pattern)
    await user.paste("^[A-Z")
    expect(screen.getByText("Geçersiz düzenli ifade.")).toBeInTheDocument()
    await user.paste("]{5}$")
    expect(screen.queryByText("Geçersiz düzenli ifade.")).toBeNull()

    await user.click(screen.getByRole("button", { name: "Önizle" }))
    const dialog = await screen.findByRole("dialog", { name: /Önizleme/ })
    const input = within(dialog).getByRole("textbox", { name: "Liman kodu" })
    await user.type(input, "ist")
    await user.click(within(dialog).getByRole("button", { name: "Gönder" }))
    expect(
      within(dialog).getByText("Değer beklenen biçimde değil.")
    ).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, "TRIST")
    await waitFor(() =>
      expect(
        within(dialog).queryByText("Değer beklenen biçimde değil.")
      ).toBeNull()
    )
  })

  it("TC-4.3-03 flags missing English texts", async () => {
    const { user } = await openWithNewTextField()
    const en = screen.getByRole("textbox", { name: "Etiket (İngilizce)" })
    await user.clear(en)
    expect(screen.getByText("Bu dil için çeviri eksik.")).toBeInTheDocument()
    const card = screen
      .getByRole("button", { name: "Kısa metin alanını düzenle" })
      .closest("li")!
    expect(within(card).getByText("EN çevirisi eksik")).toBeInTheDocument()

    // The editor language shows the English texts (falls back to Turkish).
    await user.click(screen.getByRole("button", { name: "İngilizce" }))
    expect(
      screen.getByRole("button", { name: "Full name alanını düzenle" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Kısa metin alanını düzenle" })
    ).toBeInTheDocument()
  })

  it("edits options, defaults, consent links and hidden field sources", async () => {
    const { user } = await renderRoute("/forms/form_agent/edit", {
      as: "owner",
    })
    await screen.findByRole("textbox", { name: "Form adı" })
    await user.click(screen.getByRole("button", { name: "Tek seçim ekle" }))
    const option = screen.getByRole("textbox", {
      name: "Seçenek 1 etiketi (Türkçe)",
    })
    await user.clear(option)
    await user.type(option, "Deniz")
    expect(
      within(canvas()).getByRole("radio", { name: "Deniz" })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Gizli alan ekle" }))
    await user.click(screen.getByRole("combobox", { name: "Değer kaynağı" }))
    await user.click(
      await screen.findByRole("option", { name: "URL parametresi" })
    )
    await user.type(
      screen.getByRole("textbox", { name: "Parametre adı" }),
      "utm_source"
    )
    expect(
      within(canvas()).getByText(/URL parametresi: utm_source/)
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: /KVKK kapsamında işlenmesini kabul ediyorum\. alanını düzenle/,
      })
    )
    await user.type(
      screen.getByRole("textbox", { name: "Aydınlatma metni bağlantısı" }),
      "https://acme.test/kvkk"
    )
    expect(
      within(canvas()).getByRole("link", { name: /Aydınlatma metni/ })
    ).toHaveAttribute("href", "https://acme.test/kvkk")
  })
})
