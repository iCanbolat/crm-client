import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Faz 4 simülasyonu (form builder): "Navlun Teklif Formu" oluştur → Rota +
 * Yük bilgisi blokları → koşul (Taşıma modu = Hava → Ölçüler) → Lead
 * eşlemesi → tema + mobil önizleme → önizlemede doldur ve gönder → yayınla
 * → embed kodu → listede "Yayında". Versiyonlar: taslağı değiştir → yayınla
 * → eski versiyona dön → yeniden yayınla.
 *
 * Mock DB sayfa belleğinde yaşar: tam sayfa yenileme yapılmaz.
 */

/** Palette lives in a sheet below 1440 px; mobile opens properties after adding. */
async function addFromPalette(page: Page, item: string, isMobile: boolean) {
  await page.getByRole("button", { name: "Alan ekle", exact: true }).click()
  const palette = page.getByRole("dialog", { name: "Alan ekle" })
  await palette.getByRole("button", { name: item }).click()
  await expect(palette).toBeHidden()
  if (isMobile) {
    await expect(
      page.getByRole("dialog", { name: "Alan özellikleri" })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("dialog", { name: "Alan özellikleri" })
    ).toBeHidden()
  }
}

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name }).click()
  await expect(page.getByRole("tab", { name })).toHaveAttribute(
    "aria-selected",
    "true"
  )
}

test.describe("Faz 4 — Form builder", () => {
  test("uçtan uca: oluştur → bloklar → koşul → eşleme → tema → önizle → yayınla → embed", async ({
    page,
    openApp,
    isMobile,
    expectNoViolations,
  }) => {
    test.setTimeout(150_000)
    await openApp("/forms")
    await expect(
      page.getByRole("heading", { name: "Formlar", level: 1 })
    ).toBeVisible()
    await expectNoViolations()

    // 1. Yeni form
    await page.getByRole("button", { name: "Yeni form" }).click()
    const create = page.getByRole("dialog", { name: "Yeni form" })
    await create.getByLabel("Form adı").fill("Navlun Teklif Formu")
    await expect(create.getByLabel("Bağlantı adı")).toHaveValue(
      "navlun-teklif-formu"
    )
    await create.getByRole("button", { name: "Formu oluştur" }).click()
    await expect(page.getByRole("textbox", { name: "Form adı" })).toHaveValue(
      "Navlun Teklif Formu"
    )

    // 2. Forwarding blokları
    await addFromPalette(page, "Rota ekle", isMobile)
    await addFromPalette(page, "Yük bilgisi ekle", isMobile)
    const canvas = page.getByRole("list", { name: "Adımdaki alanlar" })
    for (const label of [
      "Taşıma modu",
      "Çıkış noktası",
      "Varış noktası",
      "Ölçüler",
    ]) {
      await expect(
        canvas.getByRole("button", { name: `${label} alanını düzenle` })
      ).toBeVisible()
    }
    await expect(page.getByText("Tüm değişiklikler kaydedildi")).toBeVisible()
    await expectNoViolations()

    // 3. Koşul: Taşıma modu = Hava → Ölçüler göster
    await openTab(page, "Mantık")
    await page.getByRole("button", { name: "Kural ekle" }).click()
    const rule = page.getByRole("listitem", { name: "Kural 1" })
    await rule.getByRole("combobox", { name: "Koşul 1 alanı" }).click()
    await page.getByRole("option", { name: "Taşıma modu" }).click()
    await expect(
      rule.getByRole("combobox", { name: "Koşul 1 operatörü" })
    ).toContainText("eşittir")
    await rule.getByRole("combobox", { name: "Koşul 1 değeri" }).click()
    await page.getByRole("option", { name: "Hava", exact: true }).click()
    await rule.getByRole("button", { name: "Hedefler" }).click()
    await page.getByRole("menuitemcheckbox", { name: "Ölçüler" }).click()
    await page.keyboard.press("Escape")
    await expect(rule.getByText(/Kuralı tamamlayın/)).toBeHidden()
    await expectNoViolations()

    // 4. CRM eşleme: bloklar ve zorunlu "Ad soyad" eşli
    await openTab(page, "CRM eşleme")
    await expect(page.getByText("← Ad soyad")).toBeVisible()
    await expect(
      page.getByRole("combobox", { name: "Taşıma modu için hedef alan" })
    ).toContainText("Taşıma modu")
    await expect(
      page.getByRole("combobox", { name: "Çıkış noktası için hedef alan" })
    ).toContainText("Çıkış")
    await expectNoViolations()

    // 5. Tema + mobil önizleme
    await openTab(page, "Tema & ayarlar")
    const primary = page.getByRole("textbox", { name: "Ana renk", exact: true })
    await primary.fill("#0f766e")
    const preview = page.locator("section", {
      has: page.getByRole("heading", { name: "Canlı önizleme" }),
    })
    await expect(preview.locator("[data-slot=form-theme]")).toHaveCSS(
      "--primary",
      "#0f766e"
    )
    await preview.getByRole("button", { name: "Mobil" }).click()
    await expect(preview.locator("[data-device=mobile]")).toHaveAttribute(
      "style",
      /width: 375px/
    )
    await expectNoViolations()

    // 6. Önizlemede doldur ve gönder
    await page.getByRole("button", { name: "Önizle" }).click()
    const dialog = page.getByRole("dialog", {
      name: "Önizleme: Navlun Teklif Formu",
    })
    await expect(dialog.getByText("Ölçüler")).toBeHidden()
    await dialog.getByRole("textbox", { name: /Ad soyad/ }).fill("Kerem Aksoy")
    await dialog
      .getByRole("textbox", { name: /E-posta/ })
      .fill("kerem@bogazici.test")
    await dialog.getByRole("combobox", { name: /Taşıma modu/ }).click()
    await page.getByRole("option", { name: "Hava", exact: true }).click()
    await expect(dialog.getByText("Ölçüler")).toBeVisible()
    await dialog
      .getByRole("combobox", { name: /Çıkış noktası/ })
      .fill("Ambarlı")
    await page.getByRole("option", { name: /İstanbul \(Ambarlı\)/ }).click()
    await dialog
      .getByRole("combobox", { name: /Varış noktası/ })
      .fill("Hamburg")
    await page
      .getByRole("option", { name: /Hamburg/ })
      .first()
      .click()
    await dialog.getByRole("checkbox", { name: /KVKK/ }).click()
    await expectNoViolations()
    await dialog.getByRole("button", { name: "Gönder" }).click()
    await expect(dialog.getByRole("status")).toContainText("Teşekkürler!")
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()

    // 7. Yayınla → embed kodu
    await page.getByRole("button", { name: "Yayınla" }).click()
    const publish = page.getByRole("dialog", { name: "v1 olarak yayınla" })
    await expect(publish.getByText("Form yayınlanmaya hazır.")).toBeVisible()
    await publish.getByRole("button", { name: "v1 olarak yayınla" }).click()
    const done = page.getByRole("dialog", { name: "v1 yayında" })
    await expect(
      done.getByRole("textbox", { name: "Form bağlantısı" })
    ).toHaveValue(
      /^http:\/\/acme-lojistik\.forms\.localhost:\d+\/f\/navlun-teklif-formu$/
    )
    await done.getByRole("tab", { name: "iframe" }).click()
    await expect(
      done.getByRole("textbox", { name: "iframe kodu" })
    ).toHaveValue(
      /src="http:\/\/acme-lojistik\.forms\.localhost:\d+\/embed\/navlun-teklif-formu"/
    )
    await expectNoViolations()
    await done.getByRole("button", { name: "Kapat" }).click()

    // 8. Listede yayında
    await page.getByLabel("Formlara dön").click()
    const row = page.getByRole("row", {
      name: /Navlun Teklif Formu \/f\/navlun-teklif-formu/,
    })
    await expect(row.getByText("Yayında", { exact: true })).toBeVisible()
    await expect(row.getByText("v1", { exact: true })).toBeVisible()
  })

  test("versiyonlar: taslağı değiştir → yayınla → eski versiyona dön", async ({
    page,
    openApp,
    isMobile,
    expectNoViolations,
  }) => {
    test.setTimeout(90_000)
    await openApp("/forms/form_freight/edit")
    await page.getByRole("button", { name: "Ad soyad alanını kopyala" }).click()
    if (isMobile) {
      // The copy is selected: its properties open in a sheet.
      await expect(
        page.getByRole("dialog", { name: "Alan özellikleri" })
      ).toBeVisible()
      await page.keyboard.press("Escape")
    }
    await expect(page.getByText("Tüm değişiklikler kaydedildi")).toBeVisible()
    await expect(page.getByText("Yayınlanmamış değişiklik")).toBeVisible()

    await page.getByRole("button", { name: "Yayınla" }).click()
    await page
      .getByRole("dialog", { name: "v4 olarak yayınla" })
      .getByRole("button", { name: "v4 olarak yayınla" })
      .click()
    await page
      .getByRole("dialog", { name: "v4 yayında" })
      .getByRole("button", { name: "Kapat" })
      .click()

    await openTab(page, "Yayın")
    await expect(
      page.getByRole("listitem", { name: "Versiyon 4" }).getByText("Yayında")
    ).toBeVisible()
    await expectNoViolations()
    await page
      .getByRole("listitem", { name: "Versiyon 1" })
      .getByRole("button", { name: "Taslağa geri yükle" })
      .click()
    await page
      .getByRole("alertdialog", { name: "v1 taslağa yüklensin mi?" })
      .getByRole("button", { name: "Taslağa geri yükle" })
      .click()
    await expect(page.getByText("v1 taslağa yüklendi.")).toBeVisible()

    await page.getByRole("button", { name: "Yayınla" }).first().click()
    await page
      .getByRole("dialog", { name: "v5 olarak yayınla" })
      .getByRole("button", { name: "v5 olarak yayınla" })
      .click()
    await page
      .getByRole("dialog", { name: "v5 yayında" })
      .getByRole("button", { name: "Kapat" })
      .click()
    await expect(
      page.getByRole("listitem", { name: "Versiyon 5" }).getByText("Yayında")
    ).toBeVisible()

    // v1 had no containers field.
    await openTab(page, "Alanlar")
    await page.getByRole("button", { name: /Yük ve rota/ }).click()
    await expect(
      page.getByRole("button", { name: "Taşıma modu alanını düzenle" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Konteyner ihtiyacı alanını düzenle" })
    ).toHaveCount(0)
  })

  test("geniş ekranda paletten sürükle ve kanvasta sırala (fare)", async ({
    page,
    openApp,
    isMobile,
  }) => {
    test.skip(isMobile, "fare sürükleme yalnız masaüstü")
    await page.setViewportSize({ width: 1600, height: 1000 })
    await openApp("/forms/form_agent/edit")
    const canvas = page.getByRole("list", { name: "Adımdaki alanlar" })
    const labels = () =>
      canvas
        .getByRole("button", { name: /alanını düzenle$/ })
        .evaluateAll((buttons) =>
          buttons.map((button) =>
            button.getAttribute("aria-label")!.replace(/ alanını düzenle$/, "")
          )
        )

    // Palette item → above "Firma adı".
    const palette = page.getByRole("navigation", { name: "Alan paleti" })
    await palette
      .getByRole("button", { name: "Tarih ekle" })
      .dragTo(
        canvas.getByRole("button", { name: "Firma adı alanını düzenle" }),
        { steps: 12 }
      )
    await expect.poll(labels).toEqual(expect.arrayContaining(["Tarih"]))
    expect((await labels()).indexOf("Tarih")).toBeLessThan(
      (await labels()).indexOf("E-posta")
    )

    // Handle drag: "E-posta" to the top.
    await page
      .getByRole("button", { name: "E-posta alanını taşı" })
      .dragTo(
        canvas.getByRole("button", { name: "Ad soyad alanını düzenle" }),
        { steps: 12 }
      )
    await expect.poll(async () => (await labels())[0]).toBe("E-posta")
  })
})
