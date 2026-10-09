import { fireEvent, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { renderRoute, screen } from "@/test/render"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

const setNumber = (name: string, value: number) =>
  fireEvent.change(screen.getByRole("spinbutton", { name }), {
    target: { value: String(value) },
  })

async function openNewQuote() {
  const deal = acme("deal").find(
    (row) =>
      row.values.transportMode === "SEA_FCL" &&
      row.values.stage === "rate_research"
  )!
  const company = db.records.findById(String(deal.values.companyId))!
  const utils = await renderRoute(`/quotes/new?dealId=${deal.id}`, {
    as: "owner",
  })
  await screen.findByRole("heading", { name: /Yeni teklif/, level: 1 })
  return { ...utils, deal, company }
}

describe("quote builder (B3.4)", () => {
  it("prefills the customer and route from the deal", async () => {
    const { deal, company } = await openNewQuote()
    expect(screen.getByRole("combobox", { name: "Müşteri" })).toHaveValue(
      String(company.values.name)
    )
    const origin = deal.values.origin as { name: string; code: string }
    expect(screen.getByRole("combobox", { name: "Çıkış" })).toHaveValue(
      `${origin.name} (${origin.code})`
    )
    // FCL starts with the usual ocean charges.
    expect(
      screen
        .getAllByRole("combobox", { name: /^Masraf \d/ })
        .map((item) => item.textContent?.replace("▼", "").trim())
    ).toEqual([
      "Deniz navlunu (OFR)",
      "Yakıt ek ücreti (BAF)",
      "Çıkış liman elleçleme (THC)",
      "Belge ücreti",
    ])
  })

  it("TC-3.4-01/02 totals, margin and the low margin warning follow the lines", async () => {
    await openNewQuote()
    setNumber("Miktar 1", 2)
    setNumber("Alış (birim) 1", 1000)
    setNumber("Satış (birim) 1", 1200)

    const total = await screen.findByTestId("quote-total-sell")
    await waitFor(() => expect(total).toHaveTextContent("$2.400,00"))
    expect(screen.getByTestId("quote-margin")).toHaveTextContent("%16,67")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    setNumber("Satış (birim) 1", 1050)
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Marj %8 eşiğinin altında"
      )
    )
  })

  it("saves a new quote, sends it and books the shipment on acceptance", async () => {
    const { user, router, deal } = await openNewQuote()
    await user.click(screen.getByRole("combobox", { name: "Taşıyıcı" }))
    await user.click(await screen.findByRole("option", { name: "Hapag-Lloyd" }))
    setNumber("Alış (birim) 1", 1500)
    setNumber("Satış (birim) 1", 1900)
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/quotes\/quo_/)
    )
    const quoteId = router.state.location.pathname.split("/")[2]!
    expect(db.records.findById(quoteId)!.values).toMatchObject({
      status: "draft",
      carrier: "Hapag-Lloyd",
      dealId: deal.id,
    })

    // The quote page loads after the redirect (slow under parallel coverage).
    await user.click(
      await screen.findByRole("button", { name: "Gönder" }, { timeout: 10_000 })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Teklifi e-postayla gönder",
    })
    await user.type(
      within(dialog).getByLabelText("Alıcı e-posta"),
      "satin@musteri.com"
    )
    await user.click(within(dialog).getByRole("button", { name: "Gönder" }))
    await waitFor(() =>
      expect(db.records.findById(quoteId)!.values.status).toBe("sent")
    )

    await user.click(
      await screen.findByRole("button", { name: "Kabul edildi" })
    )
    const confirm = await screen.findByRole("alertdialog")
    await user.click(
      within(confirm).getByRole("button", { name: "Kabul edildi" })
    )
    await waitFor(() =>
      expect(db.records.findById(quoteId)!.values.shipmentId).toBeTruthy()
    )
    expect(await screen.findByText("Sevkiyat oluşturuldu.")).toBeInTheDocument()
  })

  it("shows older versions read-only and opens the print preview", async () => {
    const quote = acme("quote").find((row) => row.values.version === 2)!
    const { user, router } = await renderRoute(
      `/quotes/${quote.id}?version=1`,
      {
        as: "owner",
      }
    )
    expect(
      await screen.findByText(
        "Bu versiyon salt okunur. Değişiklik için revize edin."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Kaydet" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Yazdırma önizleme" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/quotes/${quote.id}/print`)
    )
    const article = await screen.findByRole("article", {
      name: "Navlun teklifi",
    })
    // Customer facing: selling prices only.
    expect(within(article).queryByText("Alış (birim)")).not.toBeInTheDocument()
    expect(
      within(article).getByText(String(quote.values.quoteNumber), {
        exact: false,
      })
    ).toBeInTheDocument()
  })

  it("opens the builder from the quote record page", async () => {
    const quote = acme("quote")[0]!
    const { user, router } = await renderRoute(`/o/quote/${quote.id}`, {
      as: "owner",
    })
    await user.click(
      await screen.findByRole("link", { name: "Teklif oluşturucuyu aç" })
    )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/quotes/${quote.id}`)
    )
  })

  it("TC-3.1-03 the quote screens are 404 when the module is inactive", async () => {
    db.workspaces.update(WORKSPACE_IDS.acme, { modules: [] })
    await renderRoute("/quotes/new", { as: "owner" })
    expect(await screen.findByText(/bulunamadı/i)).toBeInTheDocument()
  })
})
