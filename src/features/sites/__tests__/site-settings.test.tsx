import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { renderRoute, screen } from "@/test/render"

import { DOMAIN_STEP_MS } from "../mocks/store"

async function openSite(as: "owner" | "manager" = "owner") {
  const utils = await renderRoute("/site", { as })
  await screen.findByRole("heading", { name: "Site & Alan Adları", level: 1 })
  return utils
}

const preview = () => screen.getByRole("figure", { name: "Önizleme" })

describe("site settings page (B5.2)", () => {
  it("TC-5.2-02 branding changes show in the preview and are saved", async () => {
    const { user } = await openSite()
    expect(screen.getByTestId("site-public-url")).toHaveTextContent(
      /acme-lojistik\.forms\.localhost/
    )

    const name = screen.getByRole("textbox", { name: "Görünen ad" })
    await user.clear(name)
    await user.type(name, "Acme Freight")
    expect(within(preview()).getByText("Acme Freight")).toBeInTheDocument()

    const color = screen.getByRole("textbox", { name: "Vurgu rengi" })
    await user.clear(color)
    await user.type(color, "#B91C1C")
    expect(screen.getByTestId("site-preview-header").style.borderTopColor).toBe(
      "rgb(185, 28, 28)"
    )
    expect(within(preview()).getByText("KVKK")).toBeInTheDocument()

    const subdomain = screen.getByRole("textbox", { name: "Alt alan adı" })
    await user.clear(subdomain)
    await user.type(subdomain, "acme")
    expect(screen.getByTestId("site-public-url")).toHaveTextContent(
      /\/\/acme\.forms\.localhost/
    )

    await user.click(screen.getByRole("combobox", { name: "Form" }))
    await user.click(
      await screen.findByRole("option", { name: "Navlun Teklif Formu" })
    )
    await user.click(
      screen.getByRole("button", { name: "Değişiklikleri kaydet" })
    )

    await waitFor(() =>
      expect(db.sites.findById("site_ws_acme")).toMatchObject({
        subdomain: "acme",
        defaultFormId: "form_freight",
        brand: { name: "Acme Freight", primaryColor: "#b91c1c" },
      })
    )
    expect(
      await screen.findByText("Site ayarları kaydedildi")
    ).toBeInTheDocument()
  })

  it("TC-5.2-01 shows the taken-subdomain error from the API", async () => {
    const { user } = await openSite()
    const subdomain = screen.getByRole("textbox", { name: "Alt alan adı" })
    await user.clear(subdomain)
    await user.type(subdomain, "marmara-forwarding")
    await user.click(
      screen.getByRole("button", { name: "Değişiklikleri kaydet" })
    )
    expect(
      await screen.findByText("Bu alt alan adı kullanılıyor.")
    ).toBeInTheDocument()

    await user.clear(subdomain)
    await user.type(subdomain, "x")
    await user.click(
      screen.getByRole("button", { name: "Değişiklikleri kaydet" })
    )
    expect(
      await screen.findByText(/Geçerli bir alt alan adı girin/)
    ).toBeInTheDocument()
  })

  it("is read-only for managers", async () => {
    await openSite("manager")
    expect(
      screen.getByText("Site ayarlarını yalnız yöneticiler değiştirebilir.")
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Görünen ad" })).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "Değişiklikleri kaydet" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Alan adı ekle" })
    ).not.toBeInTheDocument()
  })
})

describe("domains card (B5.3)", () => {
  it("adds a domain and shows its DNS records", async () => {
    const { user } = await openSite()
    expect(
      await screen.findByText("Henüz alan adı eklenmedi.")
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Alan adı ekle" }))
    const dialog = await screen.findByRole("dialog")
    await user.type(
      within(dialog).getByRole("textbox", { name: "Alan adı" }),
      "acmelojistik.com"
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Alan adı ekle" })
    )
    expect(
      await within(dialog).findByText(/Ana alan adı eklenemez/)
    ).toBeInTheDocument()

    const input = within(dialog).getByRole("textbox", { name: "Alan adı" })
    await user.clear(input)
    await user.type(input, "teklif.acmelojistik.com")
    await user.click(
      within(dialog).getByRole("button", { name: "Alan adı ekle" })
    )

    const item = await screen.findByRole("listitem", {
      name: "teklif.acmelojistik.com",
    })
    expect(within(item).getByText("DNS bekleniyor")).toBeInTheDocument()
    expect(
      within(item).getByText("cname.forms-platform.com")
    ).toBeInTheDocument()
    expect(
      within(item).getByText("_crm-verify.teklif.acmelojistik.com")
    ).toBeInTheDocument()
    expect(
      within(item).getByRole("list", { name: "Doğrulama adımları" })
    ).toBeInTheDocument()
  })

  it("TC-5.3-03 explains a failed verification and retries", async () => {
    const past = new Date(Date.now() - 10 * DOMAIN_STEP_MS).toISOString()
    db.domains.create({
      id: "dom_fail",
      workspaceId: "ws_acme",
      hostname: "fail.acmelojistik.com",
      status: "pending_dns",
      isPrimary: true,
      verifyToken: "crm-verify=abc",
      failureReason: null,
      checkStartedAt: past,
      verifiedAt: null,
      createdAt: past,
    })
    const { user } = await openSite()
    const item = await screen.findByRole("listitem", {
      name: "fail.acmelojistik.com",
    })
    expect(within(item).getByText("Başarısız")).toBeInTheDocument()
    expect(within(item).getByRole("alert")).toHaveTextContent(
      /CNAME kaydı cname\.forms-platform\.com adresine yönlenmiyor/
    )

    await user.click(within(item).getByRole("button", { name: "Yeniden dene" }))
    expect(await within(item).findByText("DNS bekleniyor")).toBeInTheDocument()
    expect(within(item).queryByRole("alert")).not.toBeInTheDocument()
  })

  it("TC-5.3-04 makes an active domain primary and removes one", async () => {
    const past = new Date(Date.now() - 10 * DOMAIN_STEP_MS).toISOString()
    for (const [id, hostname, isPrimary] of [
      ["dom_a", "teklif.acmelojistik.com", true],
      ["dom_b", "form.acmelojistik.com", false],
    ] as const) {
      db.domains.create({
        id,
        workspaceId: "ws_acme",
        hostname,
        status: "pending_dns",
        isPrimary,
        verifyToken: "crm-verify=abc",
        failureReason: null,
        checkStartedAt: past,
        verifiedAt: null,
        createdAt: past,
      })
    }
    const { user } = await openSite()
    expect(await screen.findByTestId("site-public-url")).toHaveTextContent(
      "https://teklif.acmelojistik.com"
    )
    const second = await screen.findByRole("listitem", {
      name: "form.acmelojistik.com",
    })
    expect(within(second).getByText("Aktif")).toBeInTheDocument()
    await user.click(
      within(second).getByRole("button", { name: "Birincil yap" })
    )
    await waitFor(() =>
      expect(screen.getByTestId("site-public-url")).toHaveTextContent(
        "https://form.acmelojistik.com"
      )
    )
    expect(within(second).getByText("Birincil")).toBeInTheDocument()

    const first = screen.getByRole("listitem", {
      name: "teklif.acmelojistik.com",
    })
    await user.click(within(first).getByRole("button", { name: "Kaldır" }))
    const confirm = await screen.findByRole("alertdialog")
    await user.click(within(confirm).getByRole("button", { name: "Kaldır" }))
    await waitFor(() =>
      expect(
        screen.queryByRole("listitem", { name: "teklif.acmelojistik.com" })
      ).not.toBeInTheDocument()
    )
  })
})
