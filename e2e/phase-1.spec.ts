import { ACCOUNTS, expect, test } from "./fixtures"

/**
 * Faz 1 simülasyonu: yeni kullanıcı giriş yapar → onboarding'de Forwarding
 * seçer → shell'de forwarding menüsü → çıkış/giriş ile oturum korunur →
 * viewer rolüyle kısıtlı arayüz.
 */
test.describe("Faz 1 — auth, onboarding & app shell", () => {
  test("TC-1.1-01/02 hatalı girişte form hatası, doğru girişte panel", async ({
    page,
    openApp,
    submitLogin,
  }) => {
    await openApp("/login", { as: null })

    await submitLogin("owner", "yanlis-sifre")
    await expect(page.getByRole("alert")).toContainText(
      "E-posta veya şifre hatalı."
    )
    await expect(page).toHaveURL(/\/login/)

    await submitLogin("owner")
    await expect(page).toHaveURL("/dashboard")
    await expect(
      page.getByRole("heading", { name: "Hoş geldiniz, Elif" })
    ).toBeVisible()
  })

  test("TC-1.1-03 oturumsuz korumalı sayfa girişe, girişten sonra geri döner", async ({
    page,
    openApp,
    submitLogin,
  }) => {
    await openApp("/o/lead", { as: null })

    await expect(page).toHaveURL("/login?redirect=%2Fo%2Flead")
    await submitLogin("manager")

    await expect(page).toHaveURL("/o/lead")
    await expect(
      page.getByRole("heading", { name: "Lead'ler", level: 1 })
    ).toBeVisible()
  })

  test("TC-1.2-03 yeni kullanıcı onboarding'i tamamlar, forwarding menüsü gelir, oturum korunur", async ({
    page,
    openApp,
    openNav,
    submitLogin,
  }) => {
    await openApp("/dashboard", { as: "newcomer" })

    // Şirket bilgileri
    await expect(page).toHaveURL("/onboarding")
    await expect(
      page.getByRole("heading", { name: "Şirket bilgileri" })
    ).toBeVisible()
    await page.getByLabel("Şirket adı").fill("Kuzey Lojistik A.Ş.")
    await page.getByRole("combobox", { name: "Para birimi" }).click()
    await page.getByRole("option", { name: "EUR — Euro" }).click()
    await page.getByRole("button", { name: "Devam et" }).click()

    // Modül seçimi — "Yakında" modüller seçilemez
    await expect(
      page.getByRole("heading", { name: "Sektör modülü" })
    ).toBeVisible()
    await expect(
      page.getByRole("checkbox", { name: "Sağlık Turizmi" })
    ).toBeDisabled()
    await page.getByRole("checkbox", { name: "Forwarding (Lojistik)" }).click()
    await page.getByRole("button", { name: "Devam et" }).click()

    // Ekip daveti — atlanabilir
    await expect(
      page.getByRole("heading", { name: "Ekibinizi davet edin" })
    ).toBeVisible()
    await page.getByRole("button", { name: "Şimdilik atla" }).click()

    // Özet → tamamla
    await expect(
      page.getByRole("heading", { name: "Her şey hazır" })
    ).toBeVisible()
    await expect(page.getByText("Kuzey Lojistik A.Ş.")).toBeVisible()
    await page.getByRole("button", { name: "Kurulumu tamamla" }).click()

    await expect(page).toHaveURL("/dashboard")
    await expect(
      page.getByRole("heading", { name: "Hoş geldiniz, Selin" })
    ).toBeVisible()

    // Shell: forwarding menüsü
    await openNav()
    const nav = page.getByRole("navigation", { name: "Ana menü" })
    await expect(nav.getByRole("link", { name: "Teklifler" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Sevkiyatlar" })).toBeVisible()
    await page.keyboard.press("Escape")

    // Çıkış → giriş: onboarding tekrar sorulmaz
    await page
      .getByRole("button", {
        name: `Kullanıcı menüsü: ${ACCOUNTS.newcomer.name}`,
      })
      .click()
    await page.getByRole("menuitem", { name: "Çıkış yap" }).click()
    await expect(page).toHaveURL(/\/login/)
    await submitLogin("newcomer")
    await expect(page).toHaveURL("/dashboard")
    await expect(
      page.getByText("Kuzey Lojistik A.Ş. çalışma alanına genel bakış.")
    ).toBeVisible()
  })

  test("TC-1.2-04 yarıda bırakılan onboarding kaldığı adımdan devam eder", async ({
    page,
    openApp,
    submitLogin,
  }) => {
    await openApp("/dashboard", { as: "newcomer" })
    await page.getByRole("button", { name: "Devam et" }).click()
    await expect(
      page.getByRole("heading", { name: "Sektör modülü" })
    ).toBeVisible()

    await page.getByRole("button", { name: "Çıkış yap" }).click()
    await expect(page).toHaveURL(/\/login/)
    await submitLogin("newcomer")

    await expect(page).toHaveURL("/onboarding")
    await expect(
      page.getByRole("heading", { name: "Sektör modülü" })
    ).toBeVisible()
    await expect(page.getByText("Adım 2 / 4")).toBeVisible()
  })

  test("TC-1.1-04 yenilemede oturum refresh token ile geri yüklenir", async ({
    page,
    openApp,
  }) => {
    await openApp("/settings/members")
    await expect(page.getByRole("list", { name: "Ekip üyeleri" })).toBeVisible()

    await page.reload()

    await expect(page).toHaveURL("/settings/members")
    await expect(page.getByRole("list", { name: "Ekip üyeleri" })).toBeVisible()
  })

  test("TC-1.3-02 ⌘K paleti açılır ve sayfaya gider", async ({
    page,
    openApp,
    isMobile,
  }) => {
    await openApp()

    const palette = page.getByRole("dialog", { name: "Komut paleti" })
    if (isMobile) {
      await page.getByRole("button", { name: "Komut paletini aç" }).click()
    } else {
      // The shortcut listener attaches right after the first paint, so a key
      // pressed in the very same frame may be missed: retry until it opens.
      await expect(async () => {
        await page.keyboard.press("ControlOrMeta+k")
        await expect(palette).toBeVisible({ timeout: 500 })
      }).toPass()
    }
    await expect(palette).toBeVisible()

    await palette.getByRole("combobox").fill("ekip")
    await palette.getByRole("option", { name: "Ekip" }).click()

    await expect(page).toHaveURL("/settings/members")
    await expect(palette).toBeHidden()
  })

  test("TC-1.3-03 mobilde menü çekmece olarak açılır, masaüstünde daraltma kalıcıdır", async ({
    page,
    openApp,
    isMobile,
  }) => {
    await openApp()
    const nav = page.getByRole("navigation", { name: "Ana menü" })

    if (isMobile) {
      await expect(nav).toBeHidden()
      await page
        .getByRole("button", { name: "Kenar çubuğunu aç/kapat" })
        .click()
      const drawer = page.getByRole("dialog")
      await expect(drawer).toBeVisible()
      await drawer.getByRole("link", { name: "Sevkiyatlar" }).click()
      await expect(page).toHaveURL("/o/shipment")
      await expect(drawer).toBeHidden()
      return
    }

    const sidebar = page.locator("[data-slot=sidebar]")
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    await page.getByRole("button", { name: "Kenar çubuğunu aç/kapat" }).click()
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")

    await page.reload()
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
  })

  test("TC-1.4-01/03 viewer kısıtlı arayüz görür ve yetkisiz sayfada 403 alır", async ({
    page,
    openApp,
    openNav,
  }) => {
    await openApp("/examples", { as: "viewer" })

    const list = page.getByRole("list", { name: "Örnek kayıtlar" })
    await expect(list).toBeVisible()
    await expect(page.getByRole("button", { name: "Ekle" })).toHaveCount(0)
    await expect(list.getByRole("button")).toHaveCount(0)

    await openNav()
    await expect(
      page
        .getByRole("navigation", { name: "Ana menü" })
        .getByRole("link", { name: "Ekip" })
    ).toHaveCount(0)

    await page.goto("/settings/members")
    await expect(
      page.getByRole("heading", { name: "Bu sayfaya erişiminiz yok" })
    ).toBeVisible()
  })

  test("TC-1.4-02 agent yalnız kendi kayıtlarını silebilir", async ({
    page,
    openApp,
  }) => {
    await openApp("/examples?pageSize=50", { as: "agent" })

    const items = page
      .getByRole("list", { name: "Örnek kayıtlar" })
      .getByRole("listitem")
    await expect(items.first()).toBeVisible()

    const own = items.filter({ hasText: `Sahibi: ${ACCOUNTS.agent.name}` })
    const others = items.filter({
      hasNotText: `Sahibi: ${ACCOUNTS.agent.name}`,
    })
    expect(await own.count()).toBeGreaterThan(0)
    await expect(own.getByRole("button", { name: /sil/ })).toHaveCount(
      await own.count()
    )
    await expect(others.getByRole("button", { name: /sil/ })).toHaveCount(0)
  })

  test("a11y: giriş, onboarding, panel, ekip, komut paleti ve 403'te WCAG AA ihlali yok", async ({
    page,
    openApp,
    submitLogin,
    expectNoViolations,
  }) => {
    await openApp("/login", { as: null })
    await expectNoViolations()

    await submitLogin("newcomer")
    await expect(
      page.getByRole("heading", { name: "Şirket bilgileri" })
    ).toBeVisible()
    await expectNoViolations()

    await page.getByRole("button", { name: "Çıkış yap" }).click()
    await submitLogin("owner")
    await expect(
      page.getByRole("heading", { name: "Hoş geldiniz, Elif" })
    ).toBeVisible()
    await expectNoViolations()

    await page.goto("/settings/members")
    await expect(page.getByRole("list", { name: "Ekip üyeleri" })).toBeVisible()
    await expectNoViolations()

    await page.getByRole("button", { name: "Komut paletini aç" }).click()
    await expect(
      page.getByRole("dialog", { name: "Komut paleti" })
    ).toBeVisible()
    await expectNoViolations()
    await page.keyboard.press("Escape")

    await page
      .getByRole("button", { name: `Kullanıcı menüsü: ${ACCOUNTS.owner.name}` })
      .click()
    await page.getByRole("menuitem", { name: "Çıkış yap" }).click()
    await submitLogin("viewer")
    await expect(page).toHaveURL("/dashboard")
    await page.goto("/settings/members")
    await expect(
      page.getByRole("heading", { name: "Bu sayfaya erişiminiz yok" })
    ).toBeVisible()
    await expectNoViolations()
  })
})
