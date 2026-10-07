import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { setScenarioState } from "@/mocks/scenarios/scenario-store"
import { renderRoute, screen } from "@/test/render"
import type { SeedUserKey } from "@/mocks/db/seed"

import { SEED_VIEW_IDS } from "../mocks/factory"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

async function renderList(path: string, as: SeedUserKey = "owner") {
  const utils = await renderRoute(path, { as })
  const table = await screen.findByRole("table")
  return { ...utils, table }
}

const bodyRows = (table: HTMLElement) =>
  within(table).getAllByRole("row").slice(1)

const columnHeaders = (table: HTMLElement) =>
  within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.trim())

const searchParam = (path: string, value: unknown) =>
  `${path}=${encodeURIComponent(JSON.stringify(value))}`

describe("generic record list (B2.2)", () => {
  it("renders any object from metadata with its list layout", async () => {
    const { table } = await renderList("/o/company")

    expect(
      screen.getByRole("heading", { name: "Şirketler", level: 1 })
    ).toBeInTheDocument()
    expect(columnHeaders(table)).toEqual([
      "",
      "Şirket adı",
      "Sektör",
      "Ülke",
      "Şehir",
      "Telefon",
      "Sahip",
      "Oluşturulma",
      // Appended by the forwarding module (B3.6).
      "Şirket tipi",
    ])
    expect(bodyRows(table)).toHaveLength(20)
    expect(screen.getByText("Toplam 80 kayıt")).toBeInTheDocument()
  })

  it("TC-2.2-01 changes the page through the URL and loads that page", async () => {
    const { table, user, router } = await renderList("/o/company")
    const firstPage = bodyRows(table).map((row) => row.textContent)

    await user.click(screen.getByRole("button", { name: "Sonraki" }))

    expect(await screen.findByText("Sayfa 2 / 4")).toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({ page: 2 })
    await waitFor(() =>
      expect(
        bodyRows(screen.getByRole("table")).map((row) => row.textContent)
      ).not.toEqual(firstPage)
    )

    await user.click(screen.getByRole("combobox", { name: "Sayfa başına" }))
    await user.click(await screen.findByRole("option", { name: "50" }))
    expect(await screen.findByText("Sayfa 1 / 2")).toBeInTheDocument()
    // Page 1 is the default, so it is stripped from the URL.
    expect(router.state.location.search).toEqual({ pageSize: 50 })
  })

  it("TC-2.2-02 opening a URL applies its filters and sorting", async () => {
    const filters = [{ field: "stage", op: "in", value: ["qualified"] }]
    const { table } = await renderList(
      `/o/lead?sort=name%3Aasc&${searchParam("filters", filters)}`
    )
    const expected = acme("lead").filter(
      (row) => row.values.stage === "qualified"
    )

    expect(
      screen.getByText(`Toplam ${expected.length} kayıt`)
    ).toBeInTheDocument()
    for (const row of bodyRows(table)) {
      expect(within(row).getByText("Nitelikli")).toBeInTheDocument()
    }
    expect(
      within(table).getByRole("columnheader", { name: /Ad soyad/ })
    ).toHaveAttribute("aria-sort", "ascending")
    const names = bodyRows(table).map(
      (row) => within(row).getAllByRole("cell")[1]!.textContent!
    )
    expect(names).toEqual(
      [...names].sort((a, b) =>
        a.localeCompare(b, "tr", { sensitivity: "base" })
      )
    )
    expect(
      within(screen.getByRole("list", { name: "Etkin filtreler" })).getByText(
        "Aşama şunlardan biri: Nitelikli"
      )
    ).toBeInTheDocument()
  })

  it("sorts from the column menu and adds filters with the filter bar", async () => {
    const { user, router } = await renderList("/o/lead")

    await user.click(
      screen.getByRole("button", { name: "Ad soyad kolonu seçenekleri" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Azalan sırala" })
    )
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: "name:desc" })
    )

    await user.click(screen.getByRole("button", { name: "Filtre ekle" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("combobox", { name: "Alan" }))
    await user.click(await screen.findByRole("option", { name: "Aşama" }))
    await user.click(
      await within(dialog).findByRole("checkbox", { name: "Kayıp" })
    )
    await user.click(within(dialog).getByRole("button", { name: "Uygula" }))

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        filters: [{ field: "stage", op: "in", value: ["lost"] }],
      })
    )
    const lost = acme("lead").filter(
      (row) => row.values.stage === "lost"
    ).length
    expect(await screen.findByText(`Toplam ${lost} kayıt`)).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: "Filtreyi kaldır: Aşama şunlardan biri: Kayıp",
      })
    )
    expect(await screen.findByText("Toplam 200 kayıt")).toBeInTheDocument()
  })

  it("searches with the search box (debounced, Turkish letters folded)", async () => {
    const target = acme("company")[7]!
    const { user, router } = await renderList("/o/company")

    await user.type(
      screen.getByRole("searchbox", { name: "Şirketler içinde ara…" }),
      String(target.values.name)
    )

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        q: target.values.name,
      })
    )
    expect(
      await screen.findByRole("link", { name: String(target.values.name) })
    ).toBeInTheDocument()
  })

  it("TC-2.2-03 hiding a column is stored in a saved view", async () => {
    const { user, router, table } = await renderList("/o/company")

    await user.click(
      within(table).getByRole("button", { name: "Sektör kolonu seçenekleri" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Kolonu gizle" })
    )
    await waitFor(() =>
      expect(columnHeaders(screen.getByRole("table"))).not.toContain("Sektör")
    )
    expect(router.state.location.search).toMatchObject({
      cols: [
        "name",
        "country",
        "city",
        "phone",
        "ownerId",
        "createdAt",
        "companyTypes",
      ],
    })

    await user.click(screen.getByRole("button", { name: "Tüm kayıtlar" }))
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Yeni görünüm olarak kaydet…",
      })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Görünümü kaydet",
    })
    await user.type(
      within(dialog).getByRole("textbox", { name: "Görünüm adı" }),
      "Sade liste"
    )
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    expect(
      await screen.findByRole("button", { name: "Sade liste" })
    ).toBeInTheDocument()
    const saved = db.views.findFirst((view) => view.name === "Sade liste")!
    expect(saved.state.columns).not.toContain("industry")

    // Back to all records: the column returns…
    await user.click(screen.getByRole("button", { name: "Sade liste" }))
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Tüm kayıtlar" })
    )
    await waitFor(() =>
      expect(columnHeaders(screen.getByRole("table"))).toContain("Sektör")
    )
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    )

    // …and reopening the view hides it again.
    await user.click(screen.getByRole("button", { name: "Tüm kayıtlar" }))
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Sade liste" })
    )
    await waitFor(() =>
      expect(columnHeaders(screen.getByRole("table"))).not.toContain("Sektör")
    )
    expect(router.state.location.search).toMatchObject({ view: saved.id })
  })

  it("applies the user's default view when the list opens without parameters", async () => {
    db.viewPrefs.create({
      id: `${WORKSPACE_IDS.acme}:${SEED_USERS.owner.id}:lead`,
      defaultViewId: SEED_VIEW_IDS.qualifiedLeads,
    })
    const { router } = await renderList("/o/lead")

    expect(router.state.location.search).toMatchObject({
      view: SEED_VIEW_IDS.qualifiedLeads,
      filters: [{ field: "stage", op: "in", value: ["qualified"] }],
    })
    expect(
      screen.getByRole("button", { name: "Nitelikli lead'ler" })
    ).toBeInTheDocument()
  })

  it("TC-2.2-04 bulk assigns the selected records to an owner", async () => {
    const { user, table } = await renderList("/o/company")
    const [first, second] = bodyRows(table)
    const names = [first!, second!].map(
      (row) => within(row).getAllByRole("link")[0]!.textContent!
    )

    for (const name of names) {
      await user.click(
        screen.getByRole("checkbox", { name: `Satırı seç: ${name}` })
      )
    }
    const bar = screen.getByRole("region", { name: "Toplu işlemler" })
    expect(bar).toHaveTextContent("2 kayıt seçildi")

    await user.click(within(bar).getByRole("button", { name: "Sahip ata" }))
    await user.click(
      await screen.findByRole("menuitem", { name: SEED_USERS.agent.name })
    )

    expect(await screen.findByText("2 kayıt güncellendi.")).toBeInTheDocument()
    for (const name of names) {
      const row = acme("company").find((item) => item.values.name === name)!
      expect(row.values.ownerId).toBe(SEED_USERS.agent.id)
    }
    expect(
      screen.queryByRole("region", { name: "Toplu işlemler" })
    ).not.toBeInTheDocument()
  })

  it("bulk deletes after confirmation", async () => {
    const { user, table } = await renderList("/o/company")
    await user.click(
      within(table).getByRole("checkbox", {
        name: "Sayfadaki tüm satırları seç",
      })
    )
    const bar = screen.getByRole("region", { name: "Toplu işlemler" })
    expect(bar).toHaveTextContent("20 kayıt seçildi")

    await user.click(within(bar).getByRole("button", { name: "Sil" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Sil" }))

    expect(await screen.findByText("Toplam 60 kayıt")).toBeInTheDocument()
    expect(acme("company")).toHaveLength(60)
  })

  it("TC-2.2-05 shows the empty state", async () => {
    setScenarioState({ scenario: "empty" })
    await renderRoute("/o/deal", { as: "owner" })

    expect(await screen.findByText("Henüz kayıt yok")).toBeInTheDocument()
    expect(
      screen.getByText("İlk fırsat kaydını oluşturarak başlayın.")
    ).toBeInTheDocument()
  })

  it("TC-2.2-05 explains when filters match nothing and clears them", async () => {
    const filters = [{ field: "name", op: "eq", value: "Böyle bir şirket yok" }]
    const { user } = await renderList(
      `/o/company?${searchParam("filters", filters)}`
    )

    expect(await screen.findByText("Eşleşen kayıt yok")).toBeInTheDocument()
    await user.click(
      screen.getAllByRole("button", { name: "Filtreleri temizle" }).at(-1)!
    )
    expect(await screen.findByText("Toplam 80 kayıt")).toBeInTheDocument()
  })

  it("TC-2.2-05 shows the error state and recovers on retry", async () => {
    setScenarioState({ scenario: "error" })
    const { user } = await renderRoute("/o/company", { as: "owner" })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Sunucuda bir hata oluştu")

    setScenarioState({ scenario: "default" })
    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }))
    expect(
      await screen.findByRole("table", { name: "Şirketler" })
    ).toBeInTheDocument()
  })

  it("viewers get a read-only list (no selection, no create)", async () => {
    const { table } = await renderList("/o/company", "viewer")

    expect(within(table).queryByRole("checkbox")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Yeni Şirket" })
    ).not.toBeInTheDocument()
  })

  it("lists module objects (forwarding shipments) from their metadata", async () => {
    await renderRoute("/o/shipment", { as: "owner" })
    expect(
      await screen.findByRole("table", { name: "Sevkiyatlar" })
    ).toBeInTheDocument()
    expect(screen.getByText("Toplam 90 kayıt")).toBeInTheDocument()
  })

  it("lists an object added through metadata without any code", async () => {
    const lead = db.objects.findById(`${WORKSPACE_IDS.acme}:lead`)!.def
    db.objects.create({
      id: `${WORKSPACE_IDS.acme}:vendor`,
      workspaceId: WORKSPACE_IDS.acme,
      def: {
        ...lead,
        key: "vendor",
        label: { tr: "Tedarikçi", en: "Vendor" },
        pluralLabel: { tr: "Tedarikçiler", en: "Vendors" },
        pipeline: undefined,
      },
    })
    db.records.create({
      id: "ven_1",
      workspaceId: WORKSPACE_IDS.acme,
      objectKey: "vendor",
      values: {
        name: "Kargo Lojistik",
        stage: "new",
        ownerId: SEED_USERS.owner.id,
      },
    })

    const { table } = await renderList("/o/vendor")
    expect(
      screen.getByRole("heading", { name: "Tedarikçiler", level: 1 })
    ).toBeInTheDocument()
    expect(
      within(table).getByRole("link", { name: "Kargo Lojistik" })
    ).toHaveAttribute("href", "/o/vendor/ven_1")
  })
})
