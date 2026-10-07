import { act, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { renderRoute, screen } from "@/test/render"

import { fromOptionDrafts, toOptionDrafts, uniqueKey } from "../lib/drafts"

const objectDef = (key: string) =>
  db.objects.findById(`${WORKSPACE_IDS.acme}:${key}`)!.def

describe("object settings helpers", () => {
  it("generates unique keys and option values from labels", () => {
    expect(uniqueKey("Müşteri Segmenti", ["musteriSegmenti"])).toBe(
      "musteriSegmenti2"
    )
    expect(uniqueKey("", [], "option")).toBe("option")
    const options = fromOptionDrafts([
      ...toOptionDrafts([{ value: "a", label: { tr: "A", en: "A" } }]),
      {
        id: "x",
        value: null,
        labelTr: "Büyük Firma",
        labelEn: "",
        color: "blue",
      },
    ])
    expect(options).toEqual([
      { value: "a", label: { tr: "A", en: "A" } },
      {
        value: "buyukFirma",
        label: { tr: "Büyük Firma", en: "Büyük Firma" },
        color: "blue",
      },
    ])
  })
})

describe("Settings → Objects (B2.7)", () => {
  it("lists the objects for admins and hides the page from other roles", async () => {
    await renderRoute("/settings/objects", { as: "admin" })
    const list = await screen.findByRole("list", { name: "Nesneler" })
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual([
      expect.stringContaining("Şirketler"),
      expect.stringContaining("Kişiler"),
      expect.stringContaining("Lead'ler"),
      expect.stringContaining("Fırsatlar"),
      expect.stringContaining("Teklifler"),
      expect.stringContaining("Sevkiyatlar"),
    ])
  })

  it("renders the 403 page for managers", async () => {
    await renderRoute("/settings/objects/company", { as: "manager" })
    expect(
      await screen.findByText("Bu sayfaya erişiminiz yok")
    ).toBeInTheDocument()
  })

  it("TC-2.7-01 a new custom field shows up in the table, the record page and the form", async () => {
    const { user, router } = await renderRoute("/settings/objects/company", {
      as: "admin",
    })

    await user.click(await screen.findByRole("button", { name: "Alan ekle" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni alan" })
    await user.type(
      within(dialog).getByRole("textbox", { name: "Etiket (Türkçe)" }),
      "Müşteri segmenti"
    )
    expect(
      within(dialog).getByRole("textbox", { name: "Anahtar" })
    ).toHaveValue("musteriSegmenti")
    await user.click(
      within(dialog).getByRole("combobox", { name: "Alan tipi" })
    )
    await user.click(
      await screen.findByRole("option", { name: "Seçim listesi" })
    )

    // Options are required for picklists.
    await user.click(within(dialog).getByRole("button", { name: "Alan ekle" }))
    expect(
      within(dialog).getByText("En az bir seçenek ekleyin.")
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole("button", { name: "Seçenek ekle" })
    )
    await user.type(
      within(dialog).getByRole("textbox", {
        name: "Seçenek 1 etiketi (Türkçe)",
      }),
      "Kurumsal"
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Seçenek ekle" })
    )
    await user.type(
      within(dialog).getByRole("textbox", {
        name: "Seçenek 2 etiketi (Türkçe)",
      }),
      "KOBİ"
    )
    await user.click(within(dialog).getByRole("button", { name: "Alan ekle" }))

    expect(await screen.findByText("Alan eklendi.")).toBeInTheDocument()
    const fieldsTable = screen.getByRole("table", { name: "Alanlar" })
    const row = within(fieldsTable)
      .getByRole("rowheader", { name: "Müşteri segmenti" })
      .closest("tr")!
    expect(row).toHaveTextContent("musteriSegmenti")
    expect(row).toHaveTextContent("Özel")

    // Table
    await act(() =>
      router.navigate({ to: "/o/$objectKey", params: { objectKey: "company" } })
    )
    const table = await screen.findByRole("table", { name: "Şirketler" })
    expect(
      within(table).getByRole("columnheader", { name: /Müşteri segmenti/ })
    ).toBeInTheDocument()

    // Form
    await user.click(screen.getByRole("button", { name: "Yeni Şirket" }))
    const sheet = await screen.findByRole("dialog", { name: "Yeni Şirket" })
    await user.type(
      within(sheet).getByRole("textbox", { name: /Şirket adı/ }),
      "Segmentli A.Ş."
    )
    await user.click(
      within(sheet).getByRole("combobox", { name: "Müşteri segmenti" })
    )
    await user.click(await screen.findByRole("option", { name: "KOBİ" }))
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText("Kayıt oluşturuldu.")).toBeInTheDocument()

    // Record page
    const created = db.records.findFirst(
      (row) => row.values.name === "Segmentli A.Ş."
    )!
    expect(created.values.musteriSegmenti).toBe("kobi")
    await act(() =>
      router.navigate({
        to: "/o/$objectKey/$recordId",
        params: { objectKey: "company", recordId: created.id },
      })
    )
    const section = await screen.findByRole("heading", {
      name: "Özel alanlar",
      level: 2,
    })
    const card = within(section.closest("[data-slot=card]") as HTMLElement)
    expect(card.getByText("Müşteri segmenti")).toBeInTheDocument()
    expect(card.getByText("KOBİ")).toBeInTheDocument()
  })

  it("TC-2.7-02 system fields cannot be deleted; custom fields can", async () => {
    db.objects.update(`${WORKSPACE_IDS.acme}:company`, {
      def: {
        ...objectDef("company"),
        fields: [
          ...objectDef("company").fields,
          {
            key: "temp",
            label: { tr: "Geçici", en: "Temp" },
            type: "text",
            custom: true,
          },
        ],
      },
    })
    const { user } = await renderRoute("/settings/objects/company", {
      as: "admin",
    })
    const table = await screen.findByRole("table", { name: "Alanlar" })

    expect(
      within(table).getByRole("button", { name: "Şirket adı silinemez" })
    ).toHaveAttribute("aria-disabled", "true")
    expect(
      within(table).queryByRole("button", { name: "Alanı sil: Şirket adı" })
    ).not.toBeInTheDocument()
    expect(
      within(table).queryByRole("button", { name: "Alanı sil: Sahip" })
    ).not.toBeInTheDocument()

    await user.click(
      within(table).getByRole("button", { name: "Alanı sil: Geçici" })
    )
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Sil",
      })
    )
    expect(await screen.findByText("Alan silindi.")).toBeInTheDocument()
    expect(
      objectDef("company").fields.some((field) => field.key === "temp")
    ).toBe(false)
  })

  it("edits a field label and its picklist values", async () => {
    const { user } = await renderRoute("/settings/objects/company", {
      as: "admin",
    })

    await user.click(
      await screen.findByRole("button", { name: "Alanı düzenle: Sektör" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Alanı düzenle: Sektör",
    })
    expect(
      within(dialog).getByRole("textbox", { name: "Anahtar" })
    ).toHaveAttribute("readonly")
    const label = within(dialog).getByRole("textbox", {
      name: "Etiket (Türkçe)",
    })
    await user.clear(label)
    await user.type(label, "Endüstri")
    await user.click(
      within(dialog).getByRole("button", { name: "Seçeneği kaldır: Diğer" })
    )
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText("Alan güncellendi.")).toBeInTheDocument()
    const industry = objectDef("company").fields.find(
      (field) => field.key === "industry"
    )!
    expect(industry.label.tr).toBe("Endüstri")
    expect(industry.options?.map((option) => option.value)).not.toContain(
      "other"
    )
  })

  it("TC-2.7-03 reordering pipeline stages reorders the kanban columns", async () => {
    const { user, router } = await renderRoute(
      "/settings/objects/deal?tab=pipeline",
      {
        as: "admin",
      }
    )

    await user.click(
      await screen.findByRole("button", { name: "Aşağı taşı: Fiyat araştırma" })
    )
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(
      await screen.findByText("Nesne ayarları kaydedildi.")
    ).toBeInTheDocument()

    await act(() =>
      router.navigate({
        to: "/o/$objectKey",
        params: { objectKey: "deal" },
        search: { layout: "kanban" },
      })
    )
    const board = await screen.findByRole("region", {
      name: "Fırsatlar panosu",
    })
    const headings = within(board)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings.slice(0, 2)).toEqual([
      "Teklif gönderildi",
      "Fiyat araştırma",
    ])
  })

  it("adds a stage with a stage gate", async () => {
    const { user } = await renderRoute("/settings/objects/lead?tab=pipeline", {
      as: "admin",
    })

    await user.click(await screen.findByRole("button", { name: "Aşama ekle" }))
    await user.type(
      screen.getByRole("textbox", { name: "Aşama 6 adı (Türkçe)" }),
      "Beklemede"
    )
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(
      await screen.findByText("Nesne ayarları kaydedildi.")
    ).toBeInTheDocument()

    const stages = objectDef("lead").pipeline!.stages
    expect(stages.at(-1)).toMatchObject({ key: "beklemede", kind: "open" })
    expect(
      objectDef("lead")
        .fields.find((field) => field.key === "stage")!
        .options!.at(-1)
    ).toMatchObject({ value: "beklemede" })
  })

  it("explains when a stage with records cannot be removed", async () => {
    const { user } = await renderRoute("/settings/objects/deal?tab=pipeline", {
      as: "admin",
    })

    await user.click(
      await screen.findByRole("button", {
        name: "Aşamayı sil: Kazanıldı (booking)",
      })
    )
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(
      await screen.findByText(
        "Kayıt bulunan bir aşama silinemez. Önce kayıtları başka bir aşamaya taşıyın."
      )
    ).toBeInTheDocument()
    expect(
      objectDef("deal").pipeline!.stages.map((stage) => stage.key)
    ).toContain("won")
  })

  it("edits the detail layout and the default list columns", async () => {
    const { user } = await renderRoute("/settings/objects/contact?tab=layout", {
      as: "admin",
    })

    await user.click(
      await screen.findByRole("button", { name: "Yukarı taşı: Ünvan" })
    )
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(
      await screen.findByText("Nesne ayarları kaydedildi.")
    ).toBeInTheDocument()
    expect(objectDef("contact").layouts.detail.sections[0]!.fields).toEqual([
      "title",
      "name",
      "companyId",
    ])

    await user.click(screen.getByRole("tab", { name: "Liste kolonları" }))
    await user.click(
      await screen.findByRole("button", { name: "Kolonu kaldır: Ünvan" })
    )
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() =>
      expect(objectDef("contact").layouts.list.columns).not.toContain("title")
    )
  })
})
