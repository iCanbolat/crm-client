import { waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { server } from "@/mocks/node"
import { apiPath } from "@/mocks/utils/http"
import { renderRoute, screen } from "@/test/render"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

async function renderDetail(
  objectKey: string,
  id: string,
  as: "owner" | "agent" | "viewer" = "owner"
) {
  const utils = await renderRoute(`/o/${objectKey}/${id}`, { as })
  await screen.findByRole("tablist")
  return utils
}

describe("generic record page (B2.3)", () => {
  it("TC-2.3-01 renders the layout sections in metadata order", async () => {
    const company = acme("company")[0]!
    await renderDetail("company", company.id)

    expect(
      screen.getByRole("heading", {
        name: String(company.values.name),
        level: 1,
      })
    ).toBeInTheDocument()
    const sections = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    expect(sections).toEqual([
      "Genel bilgiler",
      "İletişim",
      "Sahiplik ve kayıt bilgisi",
      "Notlar",
    ])
    const terms = within(
      screen
        .getByRole("heading", { name: "Genel bilgiler" })
        .closest("[data-slot=card]")!
    )
      .getAllByRole("term")
      .map((term) => term.textContent)
    expect(terms).toEqual([
      "Şirket adı",
      "Sektör",
      "Web sitesi",
      "Vergi numarası",
      "Çalışan sayısı",
      "Yıllık ciro",
      // Forwarding extends the overview section (B3.6).
      "Şirket tipi",
      "Hizmetler",
    ])
    // Breadcrumb shows the live record name.
    const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(
      within(breadcrumb).getByText(String(company.values.name))
    ).toBeInTheDocument()
    expect(
      within(breadcrumb).getByRole("link", { name: "Şirketler" })
    ).toBeInTheDocument()
  })

  it("edits a field inline and keeps the new value", async () => {
    const company = acme("company")[0]!
    const { user } = await renderDetail("company", company.id)

    await user.click(screen.getByRole("button", { name: "Düzenle: Şehir" }))
    const input = screen.getByRole("textbox", { name: "Şehir" })
    await user.clear(input)
    await user.type(input, "Mersin{Enter}")

    expect(await screen.findByText("Şehir güncellendi.")).toBeInTheDocument()
    expect(db.records.findById(company.id)!.values.city).toBe("Mersin")
    expect(screen.getByText("Mersin")).toBeInTheDocument()
  })

  it("validates inline values on the client", async () => {
    const company = acme("company")[0]!
    const { user } = await renderDetail("company", company.id)

    await user.click(
      screen.getByRole("button", { name: "Düzenle: Vergi numarası" })
    )
    const input = screen.getByRole("textbox", { name: "Vergi numarası" })
    await user.clear(input)
    await user.type(input, "12ab{Enter}")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Değer beklenen biçimde değil."
    )
    expect(input).toHaveAttribute("aria-invalid", "true")
    await user.keyboard("{Escape}")
    expect(
      screen.queryByRole("textbox", { name: "Vergi numarası" })
    ).not.toBeInTheDocument()
  })

  it("TC-2.3-02 rolls an inline edit back when the server rejects it", async () => {
    const company = acme("company")[0]!
    const originalCity = String(company.values.city)
    server.use(
      http.patch(apiPath("/records/:objectKey/:id"), () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "x" } },
          { status: 500 }
        )
      )
    )
    const { user } = await renderDetail("company", company.id)

    await user.click(screen.getByRole("button", { name: "Düzenle: Şehir" }))
    const input = screen.getByRole("textbox", { name: "Şehir" })
    await user.clear(input)
    await user.type(input, "Mersin{Enter}")

    expect(
      await screen.findByText(
        "Sunucuda bir hata oluştu. Lütfen biraz sonra tekrar deneyin."
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText("Mersin")).not.toBeInTheDocument()
    )
    expect(screen.getByText(originalCity)).toBeInTheDocument()
  })

  it("TC-2.3-03 related lists link to the related record", async () => {
    const contact = acme("contact")[0]!
    const companyId = String(contact.values.companyId)
    const { user, router } = await renderDetail("company", companyId)

    const related = await screen.findByRole("list", { name: /Kişiler/ })
    await user.click(
      within(related).getByRole("link", { name: String(contact.values.name) })
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/o/contact/${contact.id}`)
    )
    expect(
      await screen.findByRole("heading", {
        name: String(contact.values.name),
        level: 1,
      })
    ).toBeInTheDocument()

    // The relation cell goes back to the company.
    const company = db.records.findById(companyId)!
    await user.click(
      screen.getAllByRole("link", { name: String(company.values.name) })[0]!
    )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/o/company/${companyId}`)
    )
  })

  it("adds a related record prefilled with the parent", async () => {
    const company = acme("company")[0]!
    const { user } = await renderDetail("company", company.id)

    await user.click(
      await screen.findByRole("button", { name: "Yeni Kişi ekle" })
    )
    const sheet = await screen.findByRole("dialog", { name: "Yeni Kişi" })
    expect(within(sheet).getByRole("combobox", { name: "Şirket" })).toHaveValue(
      String(company.values.name)
    )
    await user.type(
      within(sheet).getByRole("textbox", { name: /Ad soyad/ }),
      "Yeni Kişi"
    )
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    await waitFor(() =>
      expect(
        acme("contact").some(
          (row) =>
            row.values.name === "Yeni Kişi" &&
            row.values.companyId === company.id
        )
      ).toBe(true)
    )
  })

  it("moves the record through the pipeline from the header", async () => {
    const deal = acme("deal").find(
      (row) => row.values.stage === "rate_research"
    )!
    const { user } = await renderDetail("deal", deal.id)

    await user.click(
      screen.getByRole("button", { name: "Aşamaya taşı: Müzakere" })
    )
    await waitFor(() =>
      expect(db.records.findById(deal.id)!.values.stage).toBe("negotiation")
    )
    expect(
      screen.getByRole("button", { name: "Geçerli aşama: Müzakere" })
    ).toHaveAttribute("aria-current", "step")
  })

  it("deletes the record after confirmation and returns to the list", async () => {
    const company = acme("company")[3]!
    const { user, router } = await renderDetail("company", company.id)

    await user.click(screen.getByRole("button", { name: "Diğer işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Kaydı sil" }))
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Sil",
      })
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/o/company")
    )
    expect(db.records.findById(company.id)).toBeUndefined()
  })

  it("shows the files tab and uploads attachments", async () => {
    const deal = acme("deal")[0]!
    const { user } = await renderRoute(`/o/deal/${deal.id}?tab=files`, {
      as: "owner",
    })

    expect(await screen.findByText("Henüz dosya yok")).toBeInTheDocument()
    await user.upload(
      screen.getByLabelText("Dosya yükle"),
      new File(["%PDF"], "teklif.pdf", { type: "application/pdf" })
    )
    expect(await screen.findByText("Dosya yüklendi.")).toBeInTheDocument()
    expect(
      await screen.findByRole("list", { name: "Dosyalar" })
    ).toBeInTheDocument()
  })

  it("is read-only for viewers and for agents on others' records", async () => {
    const foreign = acme("company").find(
      (row) => row.values.ownerId !== SEED_USERS.agent.id
    )!
    await renderDetail("company", foreign.id, "agent")

    expect(
      screen.queryByRole("button", { name: /Düzenle: / })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Düzenle" })
    ).not.toBeInTheDocument()
  })

  it("renders the 404 page for unknown records", async () => {
    await renderRoute("/o/company/cmp_missing", { as: "owner" })
    expect(await screen.findByText("Sayfa bulunamadı")).toBeInTheDocument()
  })
})
