import { describe, expect, it } from "vitest"

import { renderRoute, screen } from "@/test/render"

describe("App router", () => {
  it("TC-0.5-01 renders the example route with seeded data", async () => {
    await renderRoute("/examples", { as: "owner" })

    expect(
      await screen.findByRole("heading", { name: "Feature şablonu" })
    ).toBeInTheDocument()
    const list = await screen.findByRole("list", { name: "Örnek kayıtlar" })
    expect(list.querySelectorAll("li")).toHaveLength(5)
  })

  it("TC-0.2-01 shows the 404 page for unknown routes and links back home", async () => {
    const { user, router } = await renderRoute("/olmayan-sayfa", {
      as: "owner",
    })

    expect(
      await screen.findByRole("heading", { name: "Sayfa bulunamadı" })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Ana sayfaya dön" }))

    expect(
      await screen.findByRole("heading", { name: /Hoş geldiniz, Elif/ })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/dashboard")
  })

  it("TC-0.5-01 validates search params and falls back to defaults", async () => {
    await renderRoute("/examples?page=abc&pageSize=999", { as: "owner" })

    const list = await screen.findByRole("list", { name: "Örnek kayıtlar" })
    expect(list.querySelectorAll("li")).toHaveLength(5)
    expect(screen.getByText("Sayfa 1 / 5")).toBeInTheDocument()
  })

  it("TC-0.5-01 keeps default search params out of the URL", async () => {
    const { user, router } = await renderRoute("/examples?page=2", {
      as: "owner",
    })

    await screen.findByText("Sayfa 2 / 5")
    await user.click(screen.getByRole("button", { name: "Önceki" }))

    await screen.findByText("Sayfa 1 / 5")
    expect(router.state.location.searchStr).toBe("")
  })

  it("redirects / to the dashboard when signed in", async () => {
    const { router } = await renderRoute("/", { as: "owner" })

    expect(
      await screen.findByRole("heading", { name: /Hoş geldiniz/ })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/dashboard")
  })

  it("redirects / to the login page when signed out", async () => {
    const { router } = await renderRoute("/")

    expect(
      await screen.findByRole("heading", { name: "Giriş yap" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/login")
  })

  it("redirects /settings to the team page", async () => {
    const { router } = await renderRoute("/settings", { as: "owner" })

    expect(
      await screen.findByRole("list", { name: "Ekip üyeleri" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/settings/members")
  })
})
