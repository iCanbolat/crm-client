import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Faz 3 simülasyonu (forwarding): FCL İstanbul → Hamburg navlun talebi →
 * nitelikli → dönüştür (şirket + kişi + fırsat + teklif taslağı) → 3 masraf
 * kalemi ve marj → gönder → kabul → sevkiyat oluşur → milestone ilerlet →
 * dashboard'da yansıması.
 *
 * Mock DB sayfa belleğinde yaşar: tam sayfa yenileme yapılmaz.
 */

async function expectNoViolations(
  page: Page,
  makeAxeBuilder: () => import("@axe-core/playwright").default
) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running")
  )
  expect((await makeAxeBuilder().analyze()).violations).toEqual([])
}

async function pickLocation(
  page: Page,
  scope: ReturnType<Page["getByRole"]>,
  label: string,
  text: string,
  option: RegExp
) {
  const input = scope.getByRole("combobox", { name: label })
  await input.fill(text)
  await page.getByRole("option", { name: option }).click()
}

test.describe("Faz 3 — Forwarding modülü", () => {
  test("uçtan uca: navlun talebi → dönüştür → teklif → kabul → sevkiyat → dashboard", async ({
    page,
    openApp,
    openNav,
    makeAxeBuilder,
  }) => {
    test.setTimeout(120_000)
    await openApp("/o/lead")

    // 1. FCL navlun talebi
    await page.getByRole("button", { name: "Yeni Lead" }).click()
    const sheet = page.getByRole("dialog", { name: "Yeni Lead" })
    await sheet.getByRole("textbox", { name: /Ad soyad/ }).fill("Kerem Aksoy")
    await sheet
      .getByRole("textbox", { name: "Şirket adı" })
      .fill("Boğaziçi Tekstil")
    await sheet
      .getByRole("textbox", { name: "E-posta" })
      .fill("kerem@bogazici.test")
    await sheet.getByRole("combobox", { name: "Taşıma modu" }).click()
    await page.getByRole("option", { name: "Deniz — FCL (komple)" }).click()
    await pickLocation(page, sheet, "Çıkış", "Ambarlı", /İstanbul \(Ambarlı\)/)
    await pickLocation(page, sheet, "Varış", "Hamburg", /Hamburg DEHAM/)
    await sheet.getByRole("button", { name: "Konteyner ekle" }).click()
    await sheet.getByRole("spinbutton", { name: "Adet" }).fill("2")
    await sheet.getByRole("button", { name: "Kaydet" }).click()
    await expect(page.getByText("Kayıt oluşturuldu.")).toBeVisible()
    await expect(sheet).toBeHidden()

    await page.getByRole("link", { name: "Kerem Aksoy" }).click()
    await expect(
      page.getByRole("heading", { name: "Kerem Aksoy", level: 1 })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Rota özeti" })
    ).toBeVisible()

    // 2. Nitelikli yap
    await page.getByRole("button", { name: "Aşamaya taşı: Nitelikli" }).click()
    await expect(
      page.getByRole("button", { name: "Geçerli aşama: Nitelikli" })
    ).toBeVisible()

    // 3. Dönüştür (+ teklif taslağı)
    await page.getByRole("button", { name: "Dönüştür", exact: true }).click()
    const convert = page.getByRole("dialog", { name: "Lead'i dönüştür" })
    await expect(
      convert.getByRole("radio", { name: /Yeni şirket oluştur/ })
    ).toBeChecked()
    await expectNoViolations(page, makeAxeBuilder)
    await convert.getByRole("button", { name: "Dönüştür", exact: true }).click()
    await expect(page).toHaveURL(/\/quotes\/new\?/)
    await expect(
      page.getByRole("heading", { name: /Yeni teklif/, level: 1 })
    ).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Müşteri" })).toHaveValue(
      "Boğaziçi Tekstil"
    )

    // 4. Teklif: taşıyıcı + 3 masraf kalemi + marj
    await page.getByRole("combobox", { name: "Taşıyıcı" }).click()
    await page.getByRole("option", { name: "MSC" }).click()
    await page
      .getByRole("button", { name: /Kalemi kaldır: Belge ücreti/ })
      .click()
    const prices: [number, number][] = [
      [1650, 1990],
      [300, 360],
      [190, 230],
    ]
    for (const [index, [buy, sell]] of prices.entries()) {
      await page
        .getByRole("spinbutton", { name: `Alış (birim) ${index + 1}` })
        .fill(String(buy))
      await page
        .getByRole("spinbutton", { name: `Satış (birim) ${index + 1}` })
        .fill(String(sell))
    }
    await expect(page.getByTestId("quote-margin")).toContainText("%")
    await expect(page.getByRole("alert")).toHaveCount(0)
    await expectNoViolations(page, makeAxeBuilder)
    await page.getByRole("button", { name: "Kaydet", exact: true }).click()
    await expect(page.getByText("Teklif oluşturuldu.")).toBeVisible()
    await expect(page).toHaveURL(/\/quotes\/quo_/)

    // 5. Gönder → kabul
    await page.getByRole("button", { name: "Gönder", exact: true }).click()
    const send = page.getByRole("dialog", { name: "Teklifi e-postayla gönder" })
    await send.getByLabel("Alıcı e-posta").fill("kerem@bogazici.test")
    await send.getByRole("button", { name: "Gönder" }).click()
    await expect(send).toBeHidden()
    await page.getByRole("button", { name: "Kabul edildi" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Kabul edildi" })
      .click()
    await expect(page.getByText("Sevkiyat oluşturuldu.")).toBeVisible()
    await page.getByRole("button", { name: "Sevkiyatı aç" }).click()

    // 6. Sevkiyat: milestone ilerlet
    await expect(
      page.getByRole("heading", { name: /^SHP-/, level: 1 })
    ).toBeVisible()
    const timeline = page.getByRole("list", { name: "Sevkiyat aşamaları" })
    await expect(timeline.getByRole("listitem").first()).toHaveAttribute(
      "aria-current",
      "step"
    )
    await page.getByRole("button", { name: "Sonraki aşamayı kaydet" }).click()
    const record = page.getByRole("dialog", { name: "Aşama kaydet" })
    await expect(record.getByRole("combobox", { name: "Aşama" })).toContainText(
      "Yük hazır"
    )
    await record.getByRole("button", { name: "Kaydet" }).click()
    await expect(page.getByText("Aşama kaydedildi.")).toBeVisible()
    await expect(timeline.getByRole("listitem").nth(1)).toHaveAttribute(
      "aria-current",
      "step"
    )
    await expectNoViolations(page, makeAxeBuilder)

    // 7. Dashboard
    await openNav()
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Panel" })
      .click()
    const win = page.getByRole("region", { name: "Teklif kazanma oranı" })
    await expect(win.getByTestId("win-rate")).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Aylık ciro ve marj" })
    ).toBeVisible()
    await expect(
      page
        .getByRole("region", { name: "Duruma göre sevkiyatlar" })
        .getByText("Yük hazır")
    ).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)
  })

  test("acente ağı ve gecikmiş sevkiyatlar görünümü", async ({
    page,
    openApp,
    openNav,
  }) => {
    await openApp("/dashboard")
    await openNav()
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Acente ağı" })
      .click()
    await expect(page.getByText("Toplam 20 kayıt")).toBeVisible()

    await openNav()
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Sevkiyatlar" })
      .click()
    await expect(page.getByRole("table", { name: "Sevkiyatlar" })).toBeVisible()
  })
})
