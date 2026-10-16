import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Faz 10 simülasyonu (niş bazlı panel, kayıt & davet): kayıt → e-posta
 * kodu (dev toolbar → E-postalar) → sektör seçimi (vize) → ekip daveti →
 * davet linkiyle danışman kaydı → kapsamlı panel; Atlas ve Acme menü
 * karşılaştırması; danışman komisyon görmez. Her adımda axe.
 *
 * Tam sayfa geçişleri için mock DB localStorage'da kalıcıdır.
 */

const OWNER = {
  name: "Deniz Kaya",
  email: "deniz@vizeplus.test",
  password: "Guvenli123!",
  company: "Vize Plus Danışmanlık",
}
const COUNSELLOR = { name: "Selim Er", email: "selim@vizeplus.test" }

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

/** Opens the dev toolbar and returns the latest e-mail list's text. */
async function outbox(page: Page) {
  await page.getByTestId("msw-badge").click()
  const list = page.getByRole("list", { name: "E-postalar" })
  await expect(list).toBeVisible()
  return list
}

async function signUpForm(page: Page, fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label, { exact: true }).fill(value)
  }
  await page.getByText(/Kullanım koşullarını/).click()
}

test.describe("Faz 10 — Niş bazlı panel, kayıt & davet", () => {
  test("kayıt → doğrulama → vize sektörü → davet → danışman kaydı", async ({
    page,
    openApp,
    openNav,
    expectNoViolations,
  }) => {
    test.setTimeout(150_000)

    // 1. Kayıt
    await openApp("/register", { as: null })
    await expect(
      page.getByRole("heading", { name: "Hesap oluştur" })
    ).toBeVisible()
    await expectNoViolations()
    await signUpForm(page, {
      "Ad soyad": OWNER.name,
      "E-posta": OWNER.email,
      "Şirket adı": OWNER.company,
      Şifre: OWNER.password,
      "Şifre (tekrar)": OWNER.password,
    })
    await page.getByRole("button", { name: "Hesap oluştur" }).click()

    // 2. E-posta doğrulama: kod mock e-posta kutusunda
    await expect(page).toHaveURL("/verify-email")
    await expectNoViolations()
    const mails = await outbox(page)
    const code = (await mails
      .getByText(/^\d{6}$/)
      .first()
      .textContent())!
    await page.keyboard.press("Escape")
    await page.getByLabel("Doğrulama kodu").fill(code.trim())
    await page.getByRole("button", { name: "Doğrula" }).click()

    // 3. Onboarding: sektör (tek, kilitli) → şirket → ekip daveti → özet
    await expect(page).toHaveURL("/onboarding")
    await expect(
      page.getByRole("heading", { name: "Sektörünüz" })
    ).toBeVisible()
    await page
      .getByRole("radio", { name: "Vize & Eğitim Danışmanlığı" })
      .click()
    await expectNoViolations()
    await page.getByRole("button", { name: "Devam et" }).click()
    await expect(page.getByLabel("Şirket adı")).toHaveValue(OWNER.company)
    await page.getByRole("button", { name: "Devam et" }).click()
    await page.getByRole("button", { name: "Davet ekle" }).click()
    await page.getByLabel("1. davet e-postası").fill(COUNSELLOR.email)
    // Rol adları sektörün dilinde
    await expect(
      page.getByRole("combobox", { name: "1. davet rolü" })
    ).toHaveText(/Danışman/)
    await page.getByRole("button", { name: "Devam et" }).click()
    await page.getByRole("button", { name: "Kurulumu tamamla" }).click()

    // 4. Panel: CRM grubu yok, sektörün grupları var
    await expect(page).toHaveURL("/dashboard")
    await openNav()
    const nav = page.getByRole("navigation", { name: "Ana menü" })
    await expect(nav.getByText("Danışmanlık")).toBeVisible()
    await expect(nav.getByRole("link", { name: "Başvuranlar" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Fırsatlar" })).toHaveCount(0)
    await expect(nav.getByRole("link", { name: "Şirketler" })).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expectNoViolations()

    // 5. Davet linki (dev toolbar) → çıkış → danışman kaydı
    const inviteMails = await outbox(page)
    const link = await inviteMails
      .getByRole("link", { name: "Davet bağlantısını aç" })
      .first()
      .getAttribute("href")
    await page.keyboard.press("Escape")
    await page
      .getByRole("button", { name: `Kullanıcı menüsü: ${OWNER.name}` })
      .click()
    await page.getByRole("menuitem", { name: "Çıkış yap" }).click()
    await expect(page).toHaveURL(/\/login/)

    await openApp(link!, { as: null })
    await expect(page.getByText(/Danışman olarak davet etti/)).toBeVisible()
    await expectNoViolations()
    await signUpForm(page, {
      "Ad soyad": COUNSELLOR.name,
      Şifre: OWNER.password,
      "Şifre (tekrar)": OWNER.password,
    })
    await page.getByRole("button", { name: "Hesap oluştur ve katıl" }).click()

    // Onboarding yok; danışman yalnız atanan/atanmamış kayıtları görür
    await expect(page).toHaveURL("/dashboard")
    await openNav()
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Okul başvuruları" })
      .click()
    await expect(
      page.getByText("Yalnız size atanan ve atanmamış kayıtlar listeleniyor.")
    ).toBeVisible()
  })

  test("Atlas ve Acme menüleri; danışman komisyon görmez", async ({
    page,
    openApp,
    openNav,
    expectNoViolations,
  }) => {
    await openApp("/dashboard", { as: "owner" })
    await openNav()
    let nav = page.getByRole("navigation", { name: "Ana menü" })
    await expect(nav.getByText("Satış")).toBeVisible()
    await expect(nav.getByText("Operasyon")).toBeVisible()
    await expect(
      nav.getByRole("link", { name: "Navlun talepleri" })
    ).toBeVisible()

    await openApp("/reports", { as: "atlasEducation" })
    await expect(
      page.getByRole("link", { name: /Kurum bazlı komisyon/ })
    ).toHaveCount(0)
    await openNav()
    nav = page.getByRole("navigation", { name: "Ana menü" })
    await expect(nav.getByRole("link", { name: "Talepler" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Fırsatlar" })).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expectNoViolations()

    // Atlas'ta fırsat nesnesi yok
    await page.goto("/o/deal")
    await expect(page.getByText(/bulunamadı|404/i).first()).toBeVisible()
  })
})
