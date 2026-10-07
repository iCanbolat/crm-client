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

async function openCreateSheet(path: string, buttonName: string) {
  const utils = await renderRoute(path, { as: "owner" })
  await screen.findByRole("table")
  await utils.user.click(screen.getByRole("button", { name: buttonName }))
  const sheet = await screen.findByRole("dialog", { name: buttonName })
  return { ...utils, sheet }
}

describe("dynamic record form (B2.4)", () => {
  it("renders inputs generated from metadata, grouped by layout section", async () => {
    const { sheet } = await openCreateSheet("/o/deal", "Yeni Fırsat")

    const legends = within(sheet)
      .getAllByRole("group")
      .map((group) => group.querySelector("legend")?.textContent)
      .filter(Boolean)
    expect(legends).toEqual([
      "Fırsat bilgileri",
      "Durum",
      "Sahiplik ve kayıt bilgisi",
      "Notlar",
    ])
    expect(
      within(sheet).getByRole("textbox", { name: /Fırsat adı/ })
    ).toBeInTheDocument()
    expect(
      within(sheet).getByRole("combobox", { name: /Aşama/ })
    ).toHaveTextContent("Fiyat araştırma")
    expect(
      within(sheet).getByRole("combobox", { name: /Sahip/ })
    ).toHaveTextContent(SEED_USERS.owner.name)
    // Server-maintained fields are not part of the form.
    expect(
      within(sheet).queryByLabelText("Oluşturulma")
    ).not.toBeInTheDocument()
  })

  it("TC-2.4-01 cannot submit while required fields are empty", async () => {
    let posted = false
    server.use(
      http.post(apiPath("/records/:objectKey"), () => {
        posted = true
        return HttpResponse.json({})
      })
    )
    const { user, sheet } = await openCreateSheet("/o/company", "Yeni Şirket")

    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    const name = within(sheet).getByRole("textbox", { name: /Şirket adı/ })
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(name).toHaveAccessibleDescription("Bu alan zorunludur.")
    expect(name).toHaveFocus()
    expect(posted).toBe(false)
  })

  it("TC-2.4-02 shows 422 field errors next to the field", async () => {
    server.use(
      http.post(apiPath("/records/:objectKey"), () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Lütfen formdaki hataları düzeltin.",
              fieldErrors: {
                taxNumber: ["Bu vergi numarası başka bir şirkette kayıtlı."],
              },
            },
          },
          { status: 422 }
        )
      )
    )
    const { user, sheet } = await openCreateSheet("/o/company", "Yeni Şirket")

    await user.type(
      within(sheet).getByRole("textbox", { name: /Şirket adı/ }),
      "Acme"
    )
    await user.type(
      within(sheet).getByRole("textbox", { name: "Vergi numarası" }),
      "1234567890"
    )
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    const tax = within(sheet).getByRole("textbox", { name: "Vergi numarası" })
    await waitFor(() =>
      expect(tax).toHaveAccessibleDescription(
        "Bu vergi numarası başka bir şirkette kayıtlı."
      )
    )
    expect(tax).toHaveFocus()
    expect(
      screen.getByRole("dialog", { name: "Yeni Şirket" })
    ).toBeInTheDocument()
  })

  it("TC-2.4-03 the relation picker searches, selects and can create the target", async () => {
    const company = acme("company")[4]!
    const { user, sheet } = await openCreateSheet("/o/contact", "Yeni Kişi")

    await user.type(
      within(sheet).getByRole("textbox", { name: /Ad soyad/ }),
      "Deniz Kara"
    )
    const picker = within(sheet).getByRole("combobox", { name: "Şirket" })
    await user.type(picker, String(company.values.name).slice(0, 6))
    await user.click(
      await screen.findByRole("option", { name: String(company.values.name) })
    )
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    await waitFor(() =>
      expect(
        acme("contact").find((row) => row.values.name === "Deniz Kara")?.values
      ).toMatchObject({
        companyId: company.id,
      })
    )
  })

  it("TC-2.4-03 'create new' in the picker creates the related record", async () => {
    const { user, sheet } = await openCreateSheet("/o/contact", "Yeni Kişi")

    await user.type(
      within(sheet).getByRole("textbox", { name: /Ad soyad/ }),
      "Ece Tan"
    )
    await user.type(
      within(sheet).getByRole("combobox", { name: "Şirket" }),
      "Zirve Kargo"
    )
    await user.click(
      await screen.findByRole("option", { name: "“Zirve Kargo” oluştur" })
    )
    expect(
      await screen.findByText("“Zirve Kargo” oluşturuldu.")
    ).toBeInTheDocument()

    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      const created = acme("company").find(
        (row) => row.values.name === "Zirve Kargo"
      )
      expect(created).toBeDefined()
      expect(
        acme("contact").find((row) => row.values.name === "Ece Tan")?.values
          .companyId
      ).toBe(created!.id)
    })
  })

  it("TC-2.4-04 updates the list cache after creating a record", async () => {
    const { user, sheet } = await openCreateSheet("/o/company", "Yeni Şirket")
    expect(screen.getByText("Toplam 80 kayıt")).toBeInTheDocument()

    await user.type(
      within(sheet).getByRole("textbox", { name: /Şirket adı/ }),
      "Yeni Lojistik A.Ş."
    )
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText("Kayıt oluşturuldu.")).toBeInTheDocument()
    expect(await screen.findByText("Toplam 81 kayıt")).toBeInTheDocument()
    // Newest first: the record is on the first page right away.
    expect(
      within(screen.getByRole("table")).getByRole("link", {
        name: "Yeni Lojistik A.Ş.",
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: "Yeni Şirket" })
    ).not.toBeInTheDocument()
  })

  it("warns before discarding unsaved changes", async () => {
    const { user, sheet } = await openCreateSheet("/o/company", "Yeni Şirket")
    await user.type(
      within(sheet).getByRole("textbox", { name: /Şirket adı/ }),
      "Taslak"
    )

    await user.click(within(sheet).getByRole("button", { name: "Vazgeç" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(confirm).toHaveTextContent("Kaydedilmemiş değişiklikler var")

    await user.click(
      within(confirm).getByRole("button", { name: "Düzenlemeye devam et" })
    )
    expect(
      within(sheet).getByRole("textbox", { name: /Şirket adı/ })
    ).toHaveValue("Taslak")

    await user.click(within(sheet).getByRole("button", { name: "Vazgeç" }))
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Değişiklikleri at",
      })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Yeni Şirket" })
      ).not.toBeInTheDocument()
    )
  })

  it("edits a record in the sheet from its page", async () => {
    const deal = acme("deal")[0]!
    const { user } = await renderRoute(`/o/deal/${deal.id}`, { as: "owner" })

    await user.click(await screen.findByRole("button", { name: "Düzenle" }))
    const sheet = await screen.findByRole("dialog", { name: /düzenle/ })
    const name = within(sheet).getByRole("textbox", { name: /Fırsat adı/ })
    expect(name).toHaveValue(String(deal.values.name))
    await user.clear(name)
    await user.type(name, "Güncellenmiş fırsat")
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    expect(
      await screen.findByRole("heading", {
        name: "Güncellenmiş fırsat",
        level: 1,
      })
    ).toBeInTheDocument()
    expect(db.records.findById(deal.id)!.values.name).toBe(
      "Güncellenmiş fırsat"
    )
  })

  it("creates on the full page and opens the new record", async () => {
    const { user, router } = await renderRoute("/o/lead/new", { as: "owner" })

    await user.type(
      await screen.findByRole("textbox", { name: /Ad soyad/ }),
      "Kemal Er"
    )
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/o\/lead\/led_/)
    )
    expect(
      await screen.findByRole("heading", { name: "Kemal Er", level: 1 })
    ).toBeInTheDocument()
  })

  it("blocks leaving the full page edit with unsaved changes", async () => {
    const company = acme("company")[0]!
    const { user, router } = await renderRoute(
      `/o/company/${company.id}/edit`,
      {
        as: "owner",
      }
    )

    await user.type(
      await screen.findByRole("textbox", { name: "Şehir" }),
      " Merkez"
    )
    await user.click(
      within(screen.getByRole("navigation", { name: "breadcrumb" })).getByRole(
        "link",
        {
          name: "Şirketler",
        }
      )
    )

    const confirm = await screen.findByRole("alertdialog")
    expect(router.state.location.pathname).toBe(`/o/company/${company.id}/edit`)
    await user.click(
      within(confirm).getByRole("button", { name: "Değişiklikleri at" })
    )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/o/company")
    )
  })
})
