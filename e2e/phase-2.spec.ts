import type { Page } from "@playwright/test"

import { ACCOUNTS, expect, test } from "./fixtures"

/**
 * Faz 2 simülasyonu: şirket oluştur → kişi ekle → lead oluştur → listede
 * ara/sırala/filtrele → kanban'da (klavye ve aşama kapısıyla) taşı → not ve
 * görev ekle → admin özel alan ekler → alan formda görünür.
 *
 * Mock DB sayfa belleğinde yaşar: akış boyunca tam sayfa yenileme yapılmaz,
 * gezinme uygulama içi linklerle olur.
 */

async function expectNoViolations(
  page: Page,
  makeAxeBuilder: () => import("@axe-core/playwright").default
) {
  // Scan settled UI only: fade-in animations skew color contrast.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running")
  )
  expect((await makeAxeBuilder().analyze()).violations).toEqual([])
}

test.describe("Faz 2 — CRM çekirdek motoru", () => {
  test("uçtan uca: şirket → kişi → lead → liste → kanban → aktivite → özel alan", async ({
    page,
    openApp,
    openNav,
    submitLogin,
  }) => {
    test.setTimeout(90_000)
    await openApp("/o/company")
    await expect(
      page.getByRole("heading", { name: "Şirketler", level: 1 })
    ).toBeVisible()

    // 1. Şirket oluştur (sheet formu)
    await page.getByRole("button", { name: "Yeni Şirket" }).click()
    const companySheet = page.getByRole("dialog", { name: "Yeni Şirket" })
    await companySheet
      .getByRole("textbox", { name: /Şirket adı/ })
      .fill("Delta Lojistik A.Ş.")
    await companySheet.getByRole("combobox", { name: "Sektör" }).click()
    await page.getByRole("option", { name: "Lojistik" }).click()
    await companySheet.getByRole("button", { name: "Kaydet" }).click()
    await expect(page.getByText("Kayıt oluşturuldu.")).toBeVisible()
    await expect(companySheet).toBeHidden()

    await page.getByRole("link", { name: "Delta Lojistik A.Ş." }).click()
    await expect(
      page.getByRole("heading", { name: "Delta Lojistik A.Ş.", level: 1 })
    ).toBeVisible()

    // 2. Kişi ekle (ilişkili liste, şirket önceden seçili)
    await page.getByRole("button", { name: "Yeni Kişi ekle" }).click()
    const contactSheet = page.getByRole("dialog", { name: "Yeni Kişi" })
    await expect(
      contactSheet.getByRole("combobox", { name: "Şirket" })
    ).toHaveValue("Delta Lojistik A.Ş.")
    await contactSheet
      .getByRole("textbox", { name: /Ad soyad/ })
      .fill("Ece Yıldız")
    await contactSheet
      .getByRole("textbox", { name: "E-posta" })
      .fill("ece@delta.test")
    await contactSheet.getByRole("button", { name: "Kaydet" }).click()
    await expect(
      page
        .getByRole("list", { name: /Kişiler/ })
        .getByRole("link", { name: "Ece Yıldız" })
    ).toBeVisible()

    // 3. Lead oluştur
    await openNav()
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Lead'ler" })
      .click()
    await expect(
      page.getByRole("heading", { name: "Lead'ler", level: 1 })
    ).toBeVisible()
    await page.getByRole("button", { name: "Yeni Lead" }).click()
    const leadSheet = page.getByRole("dialog", { name: "Yeni Lead" })
    await leadSheet.getByRole("textbox", { name: /Ad soyad/ }).fill("Mert Kaya")
    await leadSheet
      .getByRole("textbox", { name: "Şirket adı" })
      .fill("Delta Lojistik A.Ş.")
    await leadSheet
      .getByRole("spinbutton", { name: "Tahmini değer" })
      .fill("25000")
    await leadSheet.getByRole("button", { name: "Kaydet" }).click()
    await expect(page.getByText("Toplam 201 kayıt")).toBeVisible()

    // 4. Listede ara, sırala, filtrele
    const search = page.getByRole("searchbox", { name: "Lead'ler içinde ara…" })
    await search.fill("Mert Kaya")
    await expect(page.getByText("Toplam 1 kayıt")).toBeVisible()
    await expect(page.getByRole("link", { name: "Mert Kaya" })).toBeVisible()
    await search.fill("")
    await expect(page.getByText("Toplam 201 kayıt")).toBeVisible()

    await page
      .getByRole("button", { name: "Ad soyad kolonu seçenekleri" })
      .click()
    await page.getByRole("menuitem", { name: "Artan sırala" }).click()
    await expect(page).toHaveURL(/sort=name%3Aasc/)
    await expect(
      page.getByRole("columnheader", { name: /Ad soyad/ })
    ).toHaveAttribute("aria-sort", "ascending")

    await page.getByRole("button", { name: "Filtre ekle" }).click()
    const filter = page.getByRole("dialog", { name: "Filtre ekle" })
    await filter.getByRole("combobox", { name: "Alan" }).click()
    await page.getByRole("option", { name: "Aşama" }).click()
    await filter.getByRole("checkbox", { name: "Yeni" }).click()
    await filter.getByRole("button", { name: "Uygula" }).click()
    await expect(
      page
        .getByRole("list", { name: "Etkin filtreler" })
        .getByText("Aşama şunlardan biri: Yeni")
    ).toBeVisible()
    await expect(page.getByText("Toplam 201 kayıt")).toBeHidden()
    await page.getByRole("button", { name: "Filtreleri temizle" }).click()
    await expect(page.getByText("Toplam 201 kayıt")).toBeVisible()

    // 5. Kanban: klavyeyle iki aşama ilerlet, ardından aşama kapısıyla "Kayıp"
    await page.getByRole("button", { name: "Kanban" }).click()
    const board = page.getByRole("region", { name: "Lead'ler panosu" })
    await expect(board).toBeVisible()
    const handle = board.getByRole("button", { name: "Sürükle: Mert Kaya" })
    await handle.focus()
    // dnd-kit attaches its key listener right after the drag starts.
    await page.keyboard.press("Space")
    await expect(board.locator("li[data-dragging]")).toHaveCount(1)
    // Under load dnd-kit may still be measuring the columns right after the
    // drag starts: press again until the target column is hovered.
    const moveRightTo = async (name: string) => {
      const column = board.getByRole("region", { name })
      await expect(async () => {
        if ((await column.getAttribute("data-over")) !== "true") {
          await page.keyboard.press("ArrowRight")
        }
        await expect(column).toHaveAttribute("data-over", "true", {
          timeout: 1_000,
        })
      }).toPass()
    }
    await moveRightTo("İletişim kuruldu")
    await moveRightTo("Nitelikli")
    await page.keyboard.press("Space")
    await expect(
      board
        .getByRole("region", { name: "Nitelikli" })
        .getByRole("link", { name: /Mert Kaya/ })
    ).toBeVisible()

    await board.getByRole("button", { name: "Taşı: Mert Kaya" }).click()
    await page.getByRole("menuitem", { name: "Kayıp" }).click()
    const gate = page.getByRole("dialog", {
      name: '"Kayıp" aşaması için bilgi gerekli',
    })
    await gate.getByRole("combobox", { name: "Kayıp nedeni" }).click()
    await page.getByRole("option", { name: "Rakip tercih edildi" }).click()
    await gate.getByRole("button", { name: "Taşı" }).click()
    await expect(
      board
        .getByRole("region", { name: "Kayıp" })
        .getByRole("link", { name: /Mert Kaya/ })
    ).toBeVisible()

    // 6. Not ve görev ekle
    await board.getByRole("link", { name: /Mert Kaya/ }).click()
    await expect(
      page.getByRole("heading", { name: "Mert Kaya", level: 1 })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Geçerli aşama: Kayıp" })
    ).toBeVisible()
    await page.getByRole("tab", { name: "Zaman çizelgesi" }).click()
    const composer = page.getByRole("form", { name: "Aktivite ekle" })
    await composer
      .getByRole("textbox", { name: "Not" })
      .fill("Rakip %10 daha ucuz teklif verdi.")
    await composer.getByRole("button", { name: "Notu kaydet" }).click()
    await expect(
      page
        .getByRole("list", { name: "Aktivite geçmişi" })
        .getByRole("listitem")
        .first()
    ).toContainText("Rakip %10 daha ucuz teklif verdi.")

    await page.getByRole("button", { name: "Görev ekle" }).click()
    const taskDialog = page.getByRole("dialog", { name: "Yeni görev" })
    await taskDialog
      .getByRole("textbox", { name: "Başlık" })
      .fill("3 ay sonra tekrar ara")
    await taskDialog.getByRole("button", { name: "Görevi oluştur" }).click()
    await expect(
      page
        .getByRole("list", { name: "Açık görevler" })
        .getByText("3 ay sonra tekrar ara")
    ).toBeVisible()

    // 7. Admin özel alan ekler → alan formda görünür
    await page
      .getByRole("button", { name: `Kullanıcı menüsü: ${ACCOUNTS.owner.name}` })
      .click()
    await page.getByRole("menuitem", { name: "Çıkış yap" }).click()
    await expect(page).toHaveURL(/\/login/)
    await submitLogin("admin")
    await expect(page).not.toHaveURL(/\/login/)

    await openNav()
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Nesneler" })
      // Bottom of a long drawer: the dialog's scroll lock moves it mid-click.
      .press("Enter")
    await page
      .getByRole("list", { name: "Nesneler" })
      .getByRole("link", { name: /Lead'ler/ })
      .click()
    await page.getByRole("button", { name: "Alan ekle" }).click()
    const fieldDialog = page.getByRole("dialog", { name: "Yeni alan" })
    await fieldDialog
      .getByRole("textbox", { name: "Etiket (Türkçe)" })
      .fill("Gümrük durumu")
    await expect(
      fieldDialog.getByRole("textbox", { name: "Anahtar" })
    ).toHaveValue("gumrukDurumu")
    await fieldDialog.getByRole("button", { name: "Alan ekle" }).click()
    await expect(page.getByText("Alan eklendi.")).toBeVisible()

    await page.getByRole("button", { name: "Listeyi aç" }).click()
    await expect(
      page.getByRole("columnheader", { name: /Gümrük durumu/ })
    ).toBeVisible()
    await page.getByRole("button", { name: "Yeni Lead" }).click()
    await expect(
      page
        .getByRole("dialog", { name: "Yeni Lead" })
        .getByRole("textbox", { name: "Gümrük durumu" })
    ).toBeVisible()
  })

  test("TC-2.2-02 paylaşılan link aynı filtre ve sıralamayla açılır", async ({
    page,
    openApp,
  }) => {
    const filters = encodeURIComponent(
      JSON.stringify([{ field: "stage", op: "in", value: ["won"] }])
    )
    await openApp(`/o/deal?sort=amount%3Adesc&filters=${filters}`)

    await expect(
      page
        .getByRole("list", { name: "Etkin filtreler" })
        .getByText("Aşama şunlardan biri: Kazanıldı")
    ).toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: /Tutar/ })
    ).toHaveAttribute("aria-sort", "descending")
    const rows = page.getByRole("table", { name: "Fırsatlar" }).getByRole("row")
    await expect(rows.nth(1)).toContainText("Kazanıldı")
  })

  test("TC-2.5-01 kanban kartı fareyle sürüklenince aşaması değişir", async ({
    page,
    openApp,
    isMobile,
  }) => {
    test.skip(isMobile, "Pointer drag on desktop; mobile uses the move menu")
    await openApp("/o/deal?layout=kanban")
    const board = page.getByRole("region", { name: "Fırsatlar panosu" })
    const from = board.getByRole("region", { name: "Fiyat araştırma" })
    const to = board.getByRole("region", { name: "Teklif gönderildi" })
    const card = from.getByRole("listitem").first()
    const title = (await card.getByRole("link").textContent())!.trim()
    const handle = card.getByRole("button", { name: /^Sürükle:/ })

    const start = (await handle.boundingBox())!
    const target = (await to.boundingBox())!
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(start.x + 40, start.y + 10, { steps: 5 })
    await page.mouse.move(target.x + target.width / 2, target.y + 120, {
      steps: 15,
    })
    await page.mouse.up()

    await expect(
      to.getByRole("link", { name: title.slice(0, 20) }).first()
    ).toBeVisible()
  })

  test("a11y: liste, kanban, kayıt formu, detay, görevler ve nesne ayarlarında WCAG AA ihlali yok", async ({
    page,
    openApp,
    openNav,
    makeAxeBuilder,
  }) => {
    await openApp("/o/deal")
    await expect(page.getByRole("table", { name: "Fırsatlar" })).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)

    await page.getByRole("button", { name: "Yeni Fırsat" }).click()
    await expect(
      page.getByRole("dialog", { name: "Yeni Fırsat" })
    ).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)
    await page
      .getByRole("dialog", { name: "Yeni Fırsat" })
      .getByRole("button", { name: "Vazgeç" })
      .click()

    await page.getByRole("button", { name: "Kanban" }).click()
    await expect(
      page.getByRole("region", { name: "Fırsatlar panosu" })
    ).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)

    await page
      .getByRole("region", { name: "Fırsatlar panosu" })
      .getByRole("listitem")
      .first()
      .getByRole("link")
      .click()
    await expect(page.getByRole("tablist")).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)

    await page.getByRole("tab", { name: "Zaman çizelgesi" }).click()
    await expect(
      page.getByRole("form", { name: "Aktivite ekle" })
    ).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)

    await openNav()
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Görevlerim" })
      .click()
    await expect(
      page.getByRole("heading", { name: "Görevlerim", level: 1 })
    ).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)

    await openNav()
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Nesneler" })
      // Bottom of a long drawer: the dialog's scroll lock moves it mid-click.
      .press("Enter")
    await page
      .getByRole("list", { name: "Nesneler" })
      .getByRole("link", { name: /Fırsatlar/ })
      .click()
    await expect(page.getByRole("table", { name: "Alanlar" })).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)

    await page.getByRole("tab", { name: "Pipeline" }).click()
    await expect(page.getByRole("list", { name: "Aşamalar" })).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)
  })
})
