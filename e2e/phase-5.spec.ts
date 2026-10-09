import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Faz 5 simülasyonu (hosted formlar & custom domain): site ayarlarında
 * varsayılan formu seç → `teklif.acmelojistik.com` ekle → doğrulama aktif
 * (birincil) → embed kodu yeni adresi kullanır → `?__host=` ile public sayfa
 * (UTM'li) → form gönder → gönderim kutusunda ve Lead listesinde yeni kayıt.
 *
 * Admin ve public uygulama arasında tam sayfa geçişi olur: mock DB
 * localStorage'da kalıcı tutulur (`persist`); oturum da localStorage'da kalır.
 */

const CUSTOM_DOMAIN = "teklif.acmelojistik.com"

/** Public pages have no dev toolbar: wait for the MSW readiness flag. */
async function openPublic(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(
    () => document.documentElement.dataset.msw === "ready"
  )
  await page.waitForLoadState("networkidle")
}

test.beforeEach(async ({ page }) => {
  // Keep the mock database across the admin ↔ public page loads.
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

test.describe("Faz 5 — Hosted formlar & custom domain", () => {
  test("uçtan uca: varsayılan form → domain → embed → public gönderim → gönderim kutusu → lead", async ({
    page,
    openApp,
    openNav,
    expectNoViolations,
  }) => {
    test.setTimeout(150_000)

    // 1. Site ayarları: varsayılan form
    await openApp("/dashboard")
    await openNav()
    await page.getByRole("link", { name: "Site & Alan Adları" }).click()
    await expect(
      page.getByRole("heading", { name: "Site & Alan Adları", level: 1 })
    ).toBeVisible()
    await expect(page.getByTestId("site-public-url")).toContainText(
      "acme-lojistik.forms.localhost"
    )
    await page.getByRole("combobox", { name: "Form", exact: true }).click()
    await page.getByRole("option", { name: "Navlun Teklif Formu" }).click()
    await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click()
    await expect(page.getByText("Site ayarları kaydedildi")).toBeVisible()

    // 2. Alan adı ekle → DNS talimatları → aktif (ilk alan adı birincil)
    await page.getByRole("button", { name: "Alan adı ekle" }).click()
    const dialog = page.getByRole("dialog", { name: "Alan adı ekle" })
    await dialog
      .getByRole("textbox", { name: "Alan adı" })
      .fill("acmelojistik.com")
    await dialog.getByRole("button", { name: "Alan adı ekle" }).click()
    await expect(dialog.getByText(/Ana alan adı eklenemez/)).toBeVisible()
    await dialog.getByRole("textbox", { name: "Alan adı" }).fill(CUSTOM_DOMAIN)
    await dialog.getByRole("button", { name: "Alan adı ekle" }).click()
    await expect(dialog).toBeHidden()

    const domain = page.getByRole("listitem", { name: CUSTOM_DOMAIN })
    await expect(domain.getByText("cname.forms-platform.com")).toBeVisible()
    await expect(domain.getByText(`_crm-verify.${CUSTOM_DOMAIN}`)).toBeVisible()
    await expectNoViolations()
    await expect(domain.getByText("Aktif", { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(domain.getByText("Birincil")).toBeVisible()
    await expect(page.getByTestId("site-public-url")).toHaveText(
      `https://${CUSTOM_DOMAIN}`
    )

    // 3. Embed kodu yeni adresi kullanır
    await page.goto("/forms/form_freight/edit?tab=publish")
    await expect(page.getByRole("tab", { name: "Yayın" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await page.getByRole("tab", { name: "iframe" }).click()
    await expect(
      page.getByRole("textbox", { name: "iframe kodu" })
    ).toHaveValue(
      new RegExp(`src="https://${CUSTOM_DOMAIN}/embed/navlun-teklif"`)
    )

    // 4. Public sayfa: kök adres varsayılan formu gösterir (UTM'li ziyaret)
    await openPublic(
      page,
      `/?__host=${CUSTOM_DOMAIN}&utm_source=google&utm_campaign=ekim`
    )
    await expect(
      page.getByRole("heading", { name: "İletişim bilgileri" })
    ).toBeVisible()
    await expect(page.getByText("Acme Lojistik", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("link", { name: "KVKK Aydınlatma Metni" })
    ).toBeVisible()
    await expectNoViolations()

    await page.getByRole("textbox", { name: /Ad soyad/ }).fill("Leyla Önal")
    await page.getByRole("textbox", { name: /Firma adı/ }).fill("Önal Mobilya")
    await page
      .getByRole("textbox", { name: /E-posta/ })
      .fill("leyla@onalmobilya.test")
    await page.getByRole("button", { name: "İleri" }).click()

    await expect(
      page.getByRole("heading", { name: "Yük ve rota" })
    ).toBeVisible()
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

    // 5. Gönderim kutusu → yeni gönderim (UTM, oluşan lead); oturum kalıcı
    await page.goto("/submissions")
    await expect(page.getByTestId("msw-badge")).toBeVisible()
    const first = page
      .getByRole("table", { name: "Gönderimler" })
      .getByRole("row")
      .nth(1)
    await expect(first).toContainText("Leyla Önal · leyla@onalmobilya.test")
    await expect(first).toContainText("Navlun Teklif Formu")
    await expect(first).toContainText("google")
    await expect(first).toContainText("Yeni")
    await first
      .getByRole("button", { name: /Leyla Önal .* gönderimini aç/ })
      .click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByText("Hosted form sayfası")).toBeVisible()
    await expect(sheet.getByText("ekim", { exact: true })).toBeVisible()
    await expectNoViolations()
    await sheet.getByRole("link", { name: /Leyla Önal/ }).click()

    // 6. Lead kaydı: kaynak web formu, rota bilgisi
    await expect(
      page.getByRole("heading", { name: "Leyla Önal" })
    ).toBeVisible()
    await expect(page.getByText("Web formu").first()).toBeVisible()
    await page.getByRole("tab", { name: "Zaman çizelgesi" }).click()
    await expect(
      page.getByText("Form gönderimi: Navlun Teklif Formu")
    ).toBeVisible()
  })

  test("bilinmeyen host ve yayında olmayan form marka-nötr 404 döner", async ({
    page,
    expectNoViolations,
  }) => {
    await openPublic(page, "/f/navlun-teklif?__host=yok.forms.localhost")
    await expect(
      page.getByRole("heading", { name: "Sayfa bulunamadı" })
    ).toBeVisible()
    await expect(page.getByText("Acme")).toHaveCount(0)

    await openPublic(
      page,
      "/f/acente-basvuru?__host=acme-lojistik.forms.localhost"
    )
    await expect(
      page.getByRole("heading", { name: "Sayfa bulunamadı" })
    ).toBeVisible()
    await expectNoViolations()
  })

  test("embed görünümü yükseklik bildirir ve başlık/footer göstermez", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Pretend to be inside an iframe of the customer's site.
      const messages: unknown[] = []
      Object.defineProperty(window, "parent", {
        configurable: true,
        get: () => ({ postMessage: (data: unknown) => messages.push(data) }),
      })
      ;(window as unknown as { __messages: unknown[] }).__messages = messages
    })
    await openPublic(
      page,
      "/embed/iletisim?__host=acme-lojistik.forms.localhost"
    )
    await expect(page.getByRole("button", { name: "Gönder" })).toBeVisible()
    await expect(page.getByRole("contentinfo")).toHaveCount(0)
    const messages = await page.evaluate(
      () =>
        (
          window as unknown as {
            __messages: { type: string; height: number }[]
          }
        ).__messages
    )
    expect(messages.at(-1)).toMatchObject({ type: "crm-form:resize" })
    expect(messages.at(-1)!.height).toBeGreaterThan(200)
  })
})
