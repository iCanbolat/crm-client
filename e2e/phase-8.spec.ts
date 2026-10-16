import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Faz 8 simülasyonu (Vize & Eğitim): public ön başvuru formu → talep →
 * şirketsiz dönüştürme (başvuran + okul başvurusu) → program seçilince belge
 * listesi → dashboard; vize dosyasında randevu kapısı, ödeme planı ve
 * tahsilat, vize sonuçları raporu. Her adımda axe.
 *
 * Admin ↔ public tam sayfa geçişleri için mock DB localStorage'da kalıcıdır.
 */

const STUDENT = "Defne Arslan"
const PUBLIC_FORM =
  "/f/yurtdisi-egitim-on-basvuru?__host=atlas-yurtdisi-egitim.forms.localhost"
/** Seeded tourist visa file in "Ön görüşme" without a payment plan. */
const VISA_ID = "vis_atl_051"

async function goto(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByTestId("msw-badge")).toBeVisible({ timeout: 15_000 })
  await page.waitForLoadState("networkidle")
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e:persist")) return
    sessionStorage.setItem("e2e:persist", "1")
    localStorage.clear()
    localStorage.setItem(
      "msw:scenario",
      JSON.stringify({
        state: { scenario: "default", persist: true },
        version: 0,
      })
    )
  })
})

test.describe("Faz 8 — Vize & Eğitim Danışmanlığı", () => {
  test("eğitim: ön başvuru → bireysel dönüştürme → program → belge listesi → dashboard", async ({
    page,
    openApp,
    expectNoViolations,
  }) => {
    test.setTimeout(150_000)

    // 1. Public ön başvuru formu
    await page.goto(PUBLIC_FORM)
    await page.waitForFunction(
      () => document.documentElement.dataset.msw === "ready"
    )
    await page.getByRole("textbox", { name: /Ad soyad/ }).fill(STUDENT)
    await page
      .getByRole("textbox", { name: /E-posta/ })
      .fill("defne.arslan@example.test")
    await page.getByRole("button", { name: "İleri" }).click()
    await page.getByRole("checkbox", { name: "Birleşik Krallık" }).click()
    await page.getByRole("combobox", { name: /Eğitim seviyesi/ }).click()
    await page.getByRole("option", { name: "Yüksek lisans" }).click()
    await page.getByRole("checkbox", { name: /KVKK/ }).click()
    await page.getByRole("button", { name: "Ön başvuruyu gönder" }).click()
    await expect(page.getByRole("status")).toContainText("Teşekkürler!")

    // 2. Danışman: talep → bireysel dönüştürme
    await openApp(`/o/lead?q=${encodeURIComponent(STUDENT)}`, {
      as: "atlasOwner",
    })
    await page.getByRole("link", { name: STUDENT }).first().click()
    await expect(
      page.getByRole("heading", { name: "Talep özeti", level: 2 })
    ).toBeVisible()
    await page.getByRole("button", { name: "Dönüştür" }).click()
    const dialog = page.getByRole("dialog", { name: "Talep kaydını dönüştür" })
    // No companies in the visa sector (Faz 10).
    await expect(
      dialog.getByRole("radiogroup", { name: "Şirket" })
    ).toHaveCount(0)
    await expect(
      dialog.getByRole("checkbox", { name: "Okul başvurusu aç" })
    ).toBeChecked()
    await expectNoViolations()
    await dialog.getByRole("button", { name: "Dönüştür" }).click()
    await expect(page).toHaveURL(/\/o\/enrollment\/enr_/)
    await expect(
      page.getByText("Belge listesi program seçilince oluşur.")
    ).toBeVisible()

    // 3. Program seçilince uygunluk ve belge listesi
    await page.getByRole("button", { name: "Düzenle", exact: true }).click()
    const sheet = page.getByRole("dialog")
    await sheet.getByRole("combobox", { name: /Program/ }).fill("MSc Data")
    await page
      .getByRole("option", { name: /MSc Data Science/ })
      .first()
      .click()
    await sheet.getByRole("button", { name: "Kaydet" }).click()
    await expect(page.getByText(/zorunlu belge tamam/)).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Uygunluk", level: 2 })
    ).toBeVisible()
    await expect(page.getByText("Dil sınavı sonucu yok.")).toBeVisible()
    await expectNoViolations()

    // 4. Dashboard
    await goto(page, "/dashboard")
    for (const name of ["Açık talepler", "Vize onay oranı", "Eksik belgeler"]) {
      await expect(page.getByRole("region", { name })).toBeVisible()
    }
    await expectNoViolations()
  })

  test("vize: randevu kapısı → ödeme planı → tahsilat → rapor", async ({
    page,
    openApp,
    expectNoViolations,
  }) => {
    test.setTimeout(120_000)

    await openApp(`/o/visaApplication/${VISA_ID}`, { as: "atlasOwner" })
    await expect(
      page.getByRole("heading", { name: "Belge kontrol listesi", level: 2 })
    ).toBeVisible()

    // Randevu olmadan "Randevu alındı"ya geçilemez.
    await page
      .getByRole("button", { name: "Aşamaya taşı: Randevu alındı" })
      .click()
    await expect(
      page.getByText(/planlanmış bir konsolosluk randevusu ekleyin/)
    ).toBeVisible()
    await expectNoViolations()

    // Ödeme planı: 3 eşit taksit, ilk taksit tahsil edilir.
    await page.getByRole("button", { name: "Plan oluştur" }).click()
    const plan = page.getByRole("dialog", { name: "Ödeme planı oluştur" })
    await plan.getByLabel("Hizmet bedeli").fill("9000")
    await plan.getByRole("button", { name: "Kaydet" }).click()
    await expect(page.getByText("Ödeme planı kaydedildi.")).toBeVisible()
    await page.getByRole("button", { name: "Ödeme al" }).first().click()
    const pay = page.getByRole("dialog", { name: /1\. taksit/ })
    await pay.getByRole("button", { name: "Ödeme al" }).click()
    await expect(page.getByText("Ödeme kaydedildi.")).toBeVisible()
    await expectNoViolations()

    // Vize sonuçları raporu
    await goto(page, "/reports/visaOutcomes?range=365d")
    await expect(
      page.getByRole("table", { name: "Vize sonuçları" })
    ).toBeVisible()
    await expectNoViolations()
  })
})
