import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { getSessionState, sessionStore } from "@/features/auth"
import { SESSION_STORAGE_KEY } from "@/features/auth/lib/session-store"
import { db } from "@/mocks/db"
import { DEMO_PASSWORD, SEED_USERS } from "@/mocks/db/seed"
import { server } from "@/mocks/node"
import { signInAs } from "@/test/auth"
import { renderRoute, screen } from "@/test/render"

function readJti(token: string) {
  return (JSON.parse(atob(token.split(".")[1]!)) as { jti: string }).jti
}

/** Counts mock API calls per "METHOD /path" (pathname without the API base). */
function trackRequests() {
  const calls: string[] = []
  const listener = ({ request }: { request: Request }) => {
    const { pathname } = new URL(request.url)
    calls.push(`${request.method} ${pathname.replace(/^\/api/, "")}`)
  }
  server.events.on("request:start", listener)
  return {
    calls,
    count: (call: string) => calls.filter((item) => item === call).length,
  }
}

async function fillLogin(
  user: Awaited<ReturnType<typeof renderRoute>>["user"],
  email: string,
  password: string
) {
  await user.type(await screen.findByLabelText("E-posta"), email)
  await user.type(screen.getByLabelText("Şifre"), password)
  await user.click(screen.getByRole("button", { name: "Giriş yap" }))
}

describe("authentication (B1.1)", () => {
  it("TC-1.1-01 signs in with valid credentials and lands on the dashboard", async () => {
    const { user, router } = await renderRoute("/login")

    await fillLogin(user, SEED_USERS.owner.email, DEMO_PASSWORD)

    expect(
      await screen.findByRole("heading", { name: "Hoş geldiniz, Elif" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/dashboard")

    // Access token lives in memory only; the refresh token is persisted.
    const session = getSessionState()
    expect(session.accessToken).toMatch(/^mock-at\./)
    const persisted = localStorage.getItem(SESSION_STORAGE_KEY)!
    expect(persisted).toContain(session.refreshToken!)
    expect(persisted).not.toContain(session.accessToken!)
  })

  it("TC-1.1-02 shows a form error for wrong credentials", async () => {
    const { user, router } = await renderRoute("/login")

    await fillLogin(user, SEED_USERS.owner.email, "yanlis-sifre")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("E-posta veya şifre hatalı.")
    expect(router.state.location.pathname).toBe("/login")
    expect(getSessionState().accessToken).toBeNull()
  })

  it("TC-1.1-02 validates the form before calling the API", async () => {
    const requests = trackRequests()
    const { user } = await renderRoute("/login")

    await user.click(await screen.findByRole("button", { name: "Giriş yap" }))

    expect(screen.getByLabelText("E-posta")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(screen.getByLabelText("Şifre")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(requests.count("POST /auth/login")).toBe(0)
  })

  it("TC-1.1-03 sends visitors of a protected page to login and back", async () => {
    const { user, router } = await renderRoute("/o/lead")

    await screen.findByRole("heading", { name: "Giriş yap" })
    expect(router.state.location.pathname).toBe("/login")
    expect(router.state.location.search).toEqual({ redirect: "/o/lead" })

    await fillLogin(user, SEED_USERS.manager.email, DEMO_PASSWORD)

    expect(
      await screen.findByRole("heading", { name: "Lead'ler", level: 1 })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/o/lead")
  })

  it("TC-1.1-03 ignores external redirect targets", async () => {
    const { user, router } = await renderRoute(
      "/login?redirect=%2F%2Fevil.example"
    )

    await fillLogin(user, SEED_USERS.owner.email, DEMO_PASSWORD)

    await screen.findByRole("heading", { name: /Hoş geldiniz/ })
    expect(router.state.location.pathname).toBe("/dashboard")
  })

  it("TC-1.1-04 refreshes an expired access token transparently", async () => {
    signInAs("owner", { accessTtlMs: -1_000 })
    const expiredToken = getSessionState().accessToken
    const requests = trackRequests()

    await renderRoute("/examples")

    expect(
      await screen.findByRole("list", { name: "Örnek kayıtlar" })
    ).toBeInTheDocument()
    expect(requests.count("POST /auth/refresh")).toBe(1)
    expect(getSessionState().accessToken).not.toBe(expiredToken)
  })

  it("TC-1.1-04 sends the user to login when the refresh fails", async () => {
    signInAs("owner", { accessTtlMs: -1_000 })
    // A refresh token that was already used (rotation) is rejected.
    const { refreshToken } = getSessionState()
    db.revokedTokens.create({
      id: readJti(refreshToken!),
      revokedAt: new Date().toISOString(),
    })

    const { router } = await renderRoute("/examples?page=2")

    expect(
      await screen.findByRole("heading", { name: "Giriş yap" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/login")
    expect(router.state.location.search).toEqual({
      redirect: "/examples?page=2",
    })
    expect(getSessionState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
    })
  })

  it("TC-1.1-04 restores the session from the refresh token after a reload", async () => {
    // A reload drops the in-memory access token; only the refresh token stays.
    signInAs("owner")
    sessionStore.setState({ accessToken: null })

    const { router } = await renderRoute("/dashboard")

    expect(
      await screen.findByRole("heading", { name: "Hoş geldiniz, Elif" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/dashboard")
    expect(getSessionState().accessToken).toMatch(/^mock-at\./)
  })

  it("redirects signed-in users away from the login page", async () => {
    const { router } = await renderRoute("/login", { as: "owner" })

    await screen.findByRole("heading", { name: /Hoş geldiniz/ })
    expect(router.state.location.pathname).toBe("/dashboard")
  })

  it("signs out from the user menu and revokes the refresh token", async () => {
    const { user, router } = await renderRoute("/dashboard", { as: "owner" })
    const { refreshToken } = getSessionState()
    const requests = trackRequests()

    await user.click(
      await screen.findByRole("button", {
        name: "Kullanıcı menüsü: Elif Yılmaz",
      })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Çıkış yap" }))

    expect(
      await screen.findByRole("heading", { name: "Giriş yap" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/login")
    expect(await screen.findByText("Çıkış yapıldı.")).toBeInTheDocument()
    expect(requests.count("POST /auth/logout")).toBe(1)

    expect(db.revokedTokens.findById(readJti(refreshToken!))).toBeDefined()
  })

  it("requests a password reset link", async () => {
    const { user } = await renderRoute("/forgot-password")

    await user.type(await screen.findByLabelText("E-posta"), "biri@firma.test")
    await user.click(
      screen.getByRole("button", { name: "Sıfırlama bağlantısı gönder" })
    )

    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent("biri@firma.test kayıtlıysa")
    await user.click(screen.getByRole("link", { name: "Girişe dön" }))
    expect(
      await screen.findByRole("heading", { name: "Giriş yap" })
    ).toBeInTheDocument()
  })

  it("links from the login form to the password reset page", async () => {
    const { user, router } = await renderRoute("/login")

    const form = (
      await screen.findByRole("heading", { name: "Giriş yap" })
    ).closest("[data-slot=card]") as HTMLElement
    await user.click(
      within(form).getByRole("link", { name: "Şifremi unuttum" })
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/forgot-password")
    )
  })
})
