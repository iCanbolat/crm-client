import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Faz 6 simülasyonu (WhatsApp kanalı): Marmara yöneticisi kendi WABA'sını
 * bağlar → şablonlar Meta onayından geçer → "Yola çıktı" otomatik bildirimini
 * açar → sevkiyatta ATD kaydı → günlükte gönderildi + konuşmada şablon balonu
 * → pencere kapalıyken serbest metin kilitli → simüle müşteri cevabı →
 * inbox'ta okunmamış → serbest metin cevap. Ayrıca agent'ın kısıtlı görünümü.
 *
 * Sayfa geçişleri tam yükleme olduğundan mock DB localStorage'da kalıcıdır.
 */

const SHIPMENT = { id: "shp_m0003", number: "SHP-2026-0003" }
const CUSTOMER = { name: "Leyla Adıvar", phone: "+905139718111" }

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

/** Full page load that keeps the persisted mock DB and session. */
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

test.describe("Faz 6 — WhatsApp kanalı", () => {
  test("uçtan uca: bağlantı → şablon onayı → olay bildirimi → gelen kutusu", async ({
    page,
    openApp,
    openNav,
    makeAxeBuilder,
    isMobile,
  }) => {
    test.setTimeout(150_000)

    // 1. Marmara Forwarding'e geç (Elif orada yönetici)
    await openApp("/dashboard")
    await openNav()
    await page
      .getByRole("button", { name: "Çalışma alanı: Acme Lojistik" })
      .click()
    await page
      .getByRole("menuitemradio", { name: /Marmara Forwarding/ })
      .click()
    await expect(
      page.getByText("Marmara Forwarding çalışma alanına genel bakış.")
    ).toBeVisible()

    // 2. Bağlantı: önce gelen kutusu bağlantı ister
    await goto(page, "/inbox")
    await expect(page.getByText("WhatsApp bağlı değil")).toBeVisible()
    await page.getByRole("link", { name: "WhatsApp'ı bağla" }).click()
    await expect(
      page.getByRole("heading", { name: "WhatsApp", level: 1 })
    ).toBeVisible()
    await page
      .getByRole("textbox", { name: "WhatsApp Business Account ID" })
      .fill("123456789012")
    await page
      .getByRole("textbox", { name: "Phone Number ID" })
      .fill("234567890123")
    await page
      .getByRole("textbox", { name: "Kalıcı erişim token'ı" })
      .fill("EAAGmockE2eAccessToken1234567890")
    await page.getByRole("button", { name: "Bağlantıyı test et" }).click()
    await expect(page.getByText(/Bağlantı başarılı/)).toBeVisible()
    await page.getByRole("button", { name: "Bağla", exact: true }).click()
    await expect(
      page.getByText("WhatsApp Business hesabı bağlandı.")
    ).toBeVisible()
    await expect(
      page.getByText(/••••7890 · .* tarihinde güncellendi/)
    ).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)

    // 3. Şablonlar: inceleme → onay (mock 3 sn)
    await page.getByRole("tab", { name: "Şablonlar" }).click()
    await expect(page.getByText("fwd_shipment_departed_v1")).toBeVisible()
    await expect(page.getByText(/İncelemede/).first()).toBeVisible()
    await expect(page.getByText(/İncelemede/)).toHaveCount(0, {
      timeout: 20_000,
    })
    await expect(page.getByText(/Onaylandı/).first()).toBeVisible()

    // 4. Otomatik bildirim: Yola çıktı
    await page.getByRole("tab", { name: "Otomatik bildirimler" }).click()
    const departed = page.getByRole("switch", {
      name: "Sevkiyat aşaması: Yola çıktı (ATD) bildirimini aç/kapat",
    })
    await departed.click()
    await expect(departed).toBeChecked()
    await expectNoViolations(page, makeAxeBuilder)

    // 5. Sevkiyatta ATD → şablon otomatik gider
    await goto(page, `/o/shipment/${SHIPMENT.id}`)
    await expect(
      page.getByRole("heading", { name: SHIPMENT.number })
    ).toBeVisible()
    await page.getByRole("button", { name: "Sonraki aşamayı kaydet" }).click()
    const milestone = page.getByRole("dialog", { name: "Aşama kaydet" })
    await expect(
      milestone.getByRole("combobox", { name: "Aşama" })
    ).toContainText("Yola çıktı (ATD)")
    await milestone.getByRole("button", { name: "Kaydet" }).click()
    await expect(milestone).toBeHidden()

    await page.getByRole("tab", { name: "WhatsApp" }).click()
    await expect(page.getByText(SHIPMENT.number).last()).toBeVisible()
    await expect(page.getByText("Otomatik bildirim").first()).toBeVisible()

    // 6. Günlükte "Gönderildi"
    await goto(page, "/settings/whatsapp?tab=notifications")
    const log = page.getByRole("table")
    await expect(log.getByRole("row").nth(1)).toContainText(SHIPMENT.number)
    await expect(log.getByRole("row").nth(1)).toContainText("Gönderildi")

    // 7. Gelen kutusu: müşteri henüz yazmadı → serbest metin kilitli
    await goto(page, "/inbox")
    await page
      .getByRole("region", { name: "Konuşmalar" })
      .getByRole("list")
      .getByRole("button", { name: new RegExp(CUSTOMER.name) })
      .click()
    await expect(
      page.getByText(
        "Müşteri henüz yazmadı. İlk mesaj onaylı bir şablon olmalı."
      )
    ).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Mesaj" })).toBeDisabled()
    await expect(
      page.getByRole("button", { name: "Şablon gönder" })
    ).toBeEnabled()

    // 8. Dev toolbar: müşteri cevabı simülasyonu → okunmamış
    await goto(page, "/inbox")
    await page.getByTestId("msw-badge").click()
    await page
      .getByRole("textbox", { name: "Müşteri numarası (E.164)" })
      .fill(CUSTOMER.phone)
    await page
      .getByRole("textbox", { name: "Mesaj", exact: true })
      .last()
      .fill("Teşekkürler, varış limanında kim karşılayacak?")
    await page.getByRole("button", { name: "Mesajı gönder" }).click()
    await expect(
      page.getByText("Gelen WhatsApp mesajı oluşturuldu.")
    ).toBeVisible()
    await page.keyboard.press("Escape")

    const thread = page
      .getByRole("region", { name: "Konuşmalar" })
      .getByRole("list")
      .getByRole("button", { name: new RegExp(CUSTOMER.name) })
    await expect(thread).toContainText("1 okunmamış mesaj")
    await thread.click()

    // 9. Pencere açık → serbest metin cevap
    await expect(page.getByText(/Yanıt penceresi açık/)).toBeVisible()
    const box = page.getByRole("textbox", { name: "Mesaj" })
    await box.fill("Merhaba Leyla Hanım, acentemiz Balcı Group karşılayacak.")
    await page.getByRole("button", { name: "Gönder", exact: true }).click()
    await expect(
      page.getByText("Merhaba Leyla Hanım, acentemiz Balcı Group karşılayacak.")
    ).toBeVisible()
    await expectNoViolations(page, makeAxeBuilder)
    if (isMobile) {
      await page.getByRole("button", { name: "Konuşmalara dön" }).click()
    }
    await expect(thread).not.toContainText("okunmamış")
  })

  test("agent: ayarlara erişemez, gelen kutusunda yalnız kendi + atanmamış konuşmalar", async ({
    page,
    openApp,
    makeAxeBuilder,
  }) => {
    await openApp("/settings/whatsapp", { as: "agent" })
    await expect(page.getByText("Bu sayfaya erişiminiz yok")).toBeVisible()

    await goto(page, "/inbox")
    const list = page
      .getByRole("region", { name: "Konuşmalar" })
      .getByRole("list")
    await expect(list.getByRole("button").first()).toBeVisible()
    const assignees = await list
      .getByRole("button")
      .evaluateAll((items) => items.map((item) => item.textContent ?? ""))
    for (const text of assignees) {
      expect(
        ["Elif Yılmaz", "Mert Demir", "Zeynep Kaya"].some((name) =>
          text.includes(name)
        )
      ).toBe(false)
    }
    await expectNoViolations(page, makeAxeBuilder)
  })
})
