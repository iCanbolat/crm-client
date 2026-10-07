import AxeBuilder from "@axe-core/playwright"
import { test as base, expect, type Page } from "@playwright/test"

/**
 * Seed accounts of the mock backend — keep in sync with
 * src/mocks/db/seed.ts (SEED_USERS / DEMO_PASSWORD).
 */
export const ACCOUNTS = {
  owner: { email: "owner@acme.test", name: "Elif Yılmaz" },
  admin: { email: "admin@acme.test", name: "Mert Demir" },
  manager: { email: "manager@acme.test", name: "Zeynep Kaya" },
  agent: { email: "agent@acme.test", name: "Can Öztürk" },
  viewer: { email: "viewer@acme.test", name: "Deniz Arslan" },
  newcomer: { email: "selin@kuzey.test", name: "Selin Aydın" },
} as const
export type Account = keyof typeof ACCOUNTS
export const DEMO_PASSWORD = "Demo123!"

interface OpenAppOptions {
  /** Signs in through the login form first; `null` stays signed out. */
  as?: Account | null
}

interface Fixtures {
  /** Opens a path (signed in by default) once MSW is active. */
  openApp: (path?: string, options?: OpenAppOptions) => Promise<void>
  /** Fills and submits the login form on the current page. */
  submitLogin: (account: Account, password?: string) => Promise<void>
  /** Opens the sidebar drawer on mobile; no-op on desktop. */
  openNav: () => Promise<void>
  /** WCAG 2.1 AA scan scoped to the app (excludes dev-only tooling). */
  makeAxeBuilder: () => AxeBuilder
}

async function waitForApp(page: Page) {
  await expect(page.getByTestId("msw-badge")).toBeVisible()
}

/**
 * Lazy route chunks and dev-mode effects settle a moment after the first
 * paint; acting earlier can hit a menu/shortcut that is not wired up yet.
 */
async function waitUntilSettled(page: Page) {
  await page.waitForLoadState("networkidle")
}

// `isMobile` is Playwright's built-in option (true for the Pixel 7 project).
export const test = base.extend<Fixtures>({
  submitLogin: async ({ page }, use) => {
    await use(async (account, password = DEMO_PASSWORD) => {
      await page.getByLabel("E-posta").fill(ACCOUNTS[account].email)
      await page.getByLabel("Şifre").fill(password)
      await page.getByRole("button", { name: "Giriş yap" }).click()
    })
  },
  openApp: async ({ page, submitLogin }, use) => {
    await use(async (path = "/dashboard", { as = "owner" } = {}) => {
      if (as === null) {
        await page.goto(path)
        await waitForApp(page)
        await waitUntilSettled(page)
        return
      }

      await page.goto(`/login?redirect=${encodeURIComponent(path)}`)
      await waitForApp(page)
      await submitLogin(as)
      await expect(page).not.toHaveURL(/\/login/)
      await expect(page.getByRole("main")).toBeVisible()
      await waitUntilSettled(page)
    })
  },
  openNav: async ({ page, isMobile }, use) => {
    await use(async () => {
      if (!isMobile) return
      await page
        .getByRole("button", { name: "Kenar çubuğunu aç/kapat" })
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()
    })
  },
  makeAxeBuilder: async ({ page }, use) => {
    await use(() =>
      new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("[data-testid='msw-badge']")
    )
  },
})

export { expect }
