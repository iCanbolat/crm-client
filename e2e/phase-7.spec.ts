import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Faz 7 simülasyonu: yönetici "web formundan gelen talepleri dağıt" kuralını
 * açar → public navlun formundan gönderim → kural lead'i sırayla Zeynep'e
 * atar ve görev açar (çalışma geçmişi) → Zeynep'in zilinde bildirim, tıklayınca
 * lead → Raporlar → Lead kaynaklarında "Web formu" bir artmış, CSV iner.
 *
 * Admin ↔ public tam sayfa geçişleri için mock DB localStorage'da kalıcıdır.
 */

const RULE = "Web formundan gelen navlun taleplerini dağıt"
const LEAD = "Deniz Yalçın"
const PUBLIC_FORM = "/f/navlun-teklif?__host=acme-lojistik.forms.localhost"

/** Full page load that keeps the persisted mock DB and session. */
async function goto(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByTestId("msw-badge")).toBeVisible({ timeout: 15_000 })
  await page.waitForLoadState("networkidle")
}

async function webFormLeads(page: Page) {
  await goto(page, "/reports/leadSources?range=30d")
  const table = page.getByRole("table", { name: "Lead kaynak performansı" })
  await expect(table).toBeVisible()
  const row = table.getByRole("row", { name: /^Web formu/ })
  if ((await row.count()) === 0) return 0
  return Number(await row.getByRole("cell").first().textContent())
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

test.describe("Faz 7 — Raporlama, bildirimler & otomasyon", () => {
  test("uçtan uca: kural → form gönderimi → atama + görev → bildirim → rapor", async ({
    page,
    openApp,
    submitLogin,
    expectNoViolations,
  }) => {
    test.setTimeout(150_000)

    // 1. Yönetici: rapordaki başlangıç sayısı, kuralı aç
    await openApp("/reports", { as: "admin" })
    await expect(
      page.getByRole("heading", { name: "Raporlar", level: 1 })
    ).toBeVisible()
    await expectNoViolations()
    const before = await webFormLeads(page)

    await goto(page, "/settings/automations")
    await page
      .getByRole("switch", { name: `${RULE} kuralını aç/kapat` })
      .click()
    await expect(page.getByText("Kural açıldı.")).toBeVisible()
    await expectNoViolations()

    // 2. Public form: navlun talebi
    await page.goto(PUBLIC_FORM)
    await page.waitForFunction(
      () => document.documentElement.dataset.msw === "ready"
    )
    await page.getByRole("textbox", { name: /Ad soyad/ }).fill(LEAD)
    await page
      .getByRole("textbox", { name: /Firma adı/ })
      .fill("Yalçın Tekstil")
    await page
      .getByRole("textbox", { name: /E-posta/ })
      .fill("deniz@yalcintekstil.test")
    await page.getByRole("button", { name: "İleri" }).click()
    await page.getByRole("combobox", { name: /Taşıma modu/ }).click()
    await page.getByRole("option", { name: "Hava", exact: true }).click()
    await page.getByRole("combobox", { name: /Çıkış noktası/ }).fill("Ambarlı")
    await page.getByRole("option", { name: /İstanbul \(Ambarlı\)/ }).click()
    await page.getByRole("combobox", { name: /Varış noktası/ }).fill("Hamburg")
    await page
      .getByRole("option", { name: /Hamburg/ })
      .first()
      .click()
    await page.getByRole("checkbox", { name: /KVKK/ }).click()
    await page.getByRole("button", { name: "Teklif iste" }).click()
    await expect(page.getByRole("status")).toContainText("Teşekkürler!")

    // 3. Çalışma geçmişi: Zeynep'e atandı, görev açıldı
    await goto(page, "/settings/automations/aut_acme_webform")
    const runs = page.getByRole("table", { name: "Çalışma geçmişi" })
    const run = runs.getByRole("row").nth(1)
    await expect(run).toContainText(LEAD)
    await expect(run).toContainText("Başarılı")
    await expect(run).toContainText(
      "Sırayla ata (round-robin): Yapıldı — Zeynep Kaya"
    )
    await expect(run).toContainText(
      "Görev oluştur: Yapıldı — Navlun talebini 24 saat içinde ara → Zeynep Kaya"
    )
    await expectNoViolations()

    // 4. Zeynep: zilde bildirim → lead
    await page.evaluate(() => localStorage.removeItem("auth:session"))
    await page.goto("/login?redirect=%2Fdashboard")
    await expect(page.getByTestId("msw-badge")).toBeVisible()
    await submitLogin("manager")
    await expect(page).toHaveURL(/\/dashboard/)
    const bell = page.getByRole("button", {
      name: /^Bildirimler, \d+ okunmamış$/,
    })
    await expect(bell).toBeVisible()
    await bell.click()
    const notifications = page.getByRole("list", { name: "Bildirimler" })
    const assigned = notifications.getByRole("button", {
      name: new RegExp(`Size bir kayıt atandı.*${LEAD}`),
    })
    await expect(assigned).toBeVisible()
    await expectNoViolations()
    await assigned.click()
    await expect(page.getByRole("heading", { name: LEAD })).toBeVisible()
    await expect(page.getByText("Zeynep Kaya").first()).toBeVisible()

    // 5. Rapor: "Web formu" bir arttı, CSV iner
    expect(await webFormLeads(page)).toBe(before + 1)
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "CSV indir" }).click()
    expect((await download).suggestedFilename()).toMatch(
      /^leadSources-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/
    )
    await expectNoViolations()
  })
})
