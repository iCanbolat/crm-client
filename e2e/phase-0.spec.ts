import { expect, test } from "./fixtures"

/**
 * Faz 0 simülasyonu: uygulama açılır → tema/dil değişir → 404 →
 * dev toolbar'dan "error" senaryosu ile hata ekranı → kurtarma.
 * Faz 1'den itibaren ekranlar oturum gerektirir: `openApp` önce giriş yapar,
 * feature şablonu `/examples` altındadır.
 */
test.describe("Faz 0 — temel iskelet", () => {
  test("TC-0.5-02 uygulama açılır, MSW rozeti ve seed veri görünür", async ({
    page,
    openApp,
  }) => {
    await openApp("/examples")

    await expect(page).toHaveTitle("CRM Platformu")
    await expect(page.getByTestId("msw-badge")).toContainText(
      "MSW · Varsayılan"
    )
    await expect(
      page.getByRole("heading", { name: "Feature şablonu" })
    ).toBeVisible()
    await expect(
      page.getByRole("list", { name: "Örnek kayıtlar" }).getByRole("listitem")
    ).toHaveCount(5)
  })

  test("TC-0.1-02 butonlar pointer imleci kullanır", async ({
    page,
    openApp,
  }) => {
    await openApp("/examples")

    const cursor = await page
      .getByRole("button", { name: "Ekle" })
      .evaluate((element) => getComputedStyle(element).cursor)

    expect(cursor).toBe("pointer")
  })

  test("TC-0.2-02 tema koyu moda geçer ve yenilemede korunur", async ({
    page,
    openApp,
  }) => {
    await openApp()

    await page.getByRole("button", { name: "Tema" }).click()
    await page.getByRole("menuitemradio", { name: "Koyu" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)

    await page.reload()
    await expect(page.locator("html")).toHaveClass(/dark/)
  })

  test("TC-0.2-03 dil İngilizceye geçer ve yenilemede korunur", async ({
    page,
    openApp,
  }) => {
    await openApp()

    await page.getByRole("button", { name: "Dil" }).click()
    await page.getByRole("menuitemradio", { name: "English" }).click()

    const heading = page.getByRole("heading", { name: "Welcome, Elif" })
    await expect(heading).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("lang", "en")

    // The session survives the reload (refresh token), so does the language.
    await page.reload()
    await expect(heading).toBeVisible()
  })

  test("TC-0.2-01 bilinmeyen route 404 gösterir ve ana sayfaya döner", async ({
    page,
    openApp,
  }) => {
    await openApp("/olmayan-sayfa")

    await expect(
      page.getByRole("heading", { name: "Sayfa bulunamadı" })
    ).toBeVisible()
    await page.getByRole("link", { name: "Ana sayfaya dön" }).click()

    await expect(page).toHaveURL("/dashboard")
    await expect(
      page.getByRole("heading", { name: "Hoş geldiniz, Elif" })
    ).toBeVisible()
  })

  test("TC-0.4-03 dev toolbar'dan hata senaryosu seçilince hata ekranı görünür ve kurtarılır", async ({
    page,
    openApp,
  }) => {
    await openApp("/examples")
    await expect(
      page.getByRole("list", { name: "Örnek kayıtlar" })
    ).toBeVisible()

    await page.getByTestId("msw-badge").click()
    await page.getByRole("combobox", { name: "Senaryo" }).click()
    await page.getByRole("option", { name: "Sunucu hatası" }).click()

    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Bir şeyler ters gitti" })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText("Sunucuda bir hata oluştu")
    await expect(page.getByTestId("msw-badge")).toContainText("Sunucu hatası")

    await page.getByRole("combobox", { name: "Senaryo" }).click()
    await page.getByRole("option", { name: "Varsayılan" }).click()
    await page.keyboard.press("Escape")
    await alert.getByRole("button", { name: "Tekrar dene" }).click()

    await expect(
      page.getByRole("list", { name: "Örnek kayıtlar" })
    ).toBeVisible()
  })

  test("TC-0.4-06 ?msw-scenario=empty ile boş durum simüle edilir", async ({
    page,
    openApp,
  }) => {
    await openApp("/examples")
    // Reload with the scenario param; the session is restored on boot.
    await page.goto("/examples?msw-scenario=empty")

    await expect(page.getByText("Henüz kayıt yok")).toBeVisible()
  })

  test("TC-0.3-08 kayıt eklenir, sayfalar arasında gezilir ve silinir", async ({
    page,
    openApp,
  }) => {
    await openApp("/examples")

    await page.getByRole("textbox", { name: "Kayıt adı" }).fill("Acme Lojistik")
    await page.getByRole("button", { name: "Ekle" }).click()
    await expect(page.getByText("Kayıt eklendi.")).toBeVisible()
    await expect(page.getByText("Toplam 25 kayıt")).toBeVisible()

    await page.getByRole("button", { name: "Sonraki" }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText("Sayfa 2 / 5")).toBeVisible()

    await page.getByRole("button", { name: "Önceki" }).click()
    await page
      .getByRole("button", { name: "Acme Lojistik kaydını sil" })
      .click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Sil" })
      .click()

    await expect(page.getByText("Kayıt silindi.")).toBeVisible()
    await expect(page.getByText("Toplam 24 kayıt")).toBeVisible()
  })

  test("a11y: şablon ekranı ve 404'te WCAG AA ihlali yok", async ({
    page,
    openApp,
    makeAxeBuilder,
  }) => {
    await openApp("/examples")
    await expect(
      page.getByRole("list", { name: "Örnek kayıtlar" })
    ).toBeVisible()
    expect((await makeAxeBuilder().analyze()).violations).toEqual([])

    await openApp("/olmayan-sayfa", { as: null })
    await expect(
      page.getByRole("heading", { name: "Sayfa bulunamadı" })
    ).toBeVisible()
    expect((await makeAxeBuilder().analyze()).violations).toEqual([])
  })
})
