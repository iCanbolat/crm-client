import { act, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { getSessionState } from "@/features/auth"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { renderRoute, screen } from "@/test/render"

import { UI_PREFERENCES_STORAGE_KEY } from "../lib/ui-preferences"

const DESKTOP_WIDTH = 1280
const mainNav = () => screen.getByRole("navigation", { name: "Ana menü" })

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  })
  window.dispatchEvent(new Event("resize"))
}

async function renderShell(path = "/dashboard") {
  const utils = await renderRoute(path, { as: "owner" })
  await screen.findByRole("navigation", { name: "Ana menü" })
  return utils
}

describe("app shell (B1.3)", () => {
  afterEach(() => setViewportWidth(DESKTOP_WIDTH))

  it("TC-1.3-01 shows the navigation of active modules only", async () => {
    await renderShell()

    const nav = within(mainNav())
    expect(nav.getByText("Forwarding (Lojistik)")).toBeInTheDocument()
    for (const name of [
      "Panel",
      "Lead'ler",
      "Teklifler",
      "Sevkiyatlar",
      "Ekip",
    ]) {
      expect(nav.getByRole("link", { name })).toBeInTheDocument()
    }
    // Coming-soon modules never show up.
    expect(
      nav.queryByRole("link", { name: "Başvurular" })
    ).not.toBeInTheDocument()
  })

  it("TC-1.3-01 hides module navigation when the module is not active", async () => {
    db.workspaces.update(WORKSPACE_IDS.acme, {
      // A coming-soon id must be ignored even if it was stored.
      modules: ["visa-education"],
    })

    await renderShell()

    const nav = within(mainNav())
    expect(nav.getByRole("link", { name: "Lead'ler" })).toBeInTheDocument()
    expect(
      nav.queryByRole("link", { name: "Teklifler" })
    ).not.toBeInTheDocument()
    expect(
      nav.queryByRole("link", { name: "Başvurular" })
    ).not.toBeInTheDocument()
  })

  it("marks the current page and shows breadcrumbs", async () => {
    await renderShell("/settings/members")

    expect(
      within(mainNav()).getByRole("link", { name: "Ekip" })
    ).toHaveAttribute("data-active")
    const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(
      within(breadcrumb).getByRole("link", { name: "Ayarlar" })
    ).toBeInTheDocument()
    expect(within(breadcrumb).getByText("Ekip")).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("names object pages after their navigation entry", async () => {
    await renderShell("/o/shipment")

    expect(
      await screen.findByRole("heading", { name: "Sevkiyatlar", level: 1 })
    ).toBeInTheDocument()
    const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(within(breadcrumb).getByText("Sevkiyatlar")).toBeInTheDocument()
  })

  it("TC-1.3-02 opens the command palette with ⌘K and navigates to a page", async () => {
    const { user, router } = await renderShell()

    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", { name: "Komut paleti" })

    await user.type(within(dialog).getByRole("combobox"), "ekip")
    await user.click(
      await within(dialog).findByRole("option", { name: "Ekip" })
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/settings/members")
    )
    expect(
      screen.queryByRole("dialog", { name: "Komut paleti" })
    ).not.toBeInTheDocument()
  })

  it("TC-1.3-02 searches records from the command palette", async () => {
    const target = db.examples.findMany(
      (item) => item.workspaceId === WORKSPACE_IDS.acme
    )[2]!
    const { user, router } = await renderShell()

    await user.click(screen.getByRole("button", { name: "Komut paletini aç" }))
    const dialog = await screen.findByRole("dialog", { name: "Komut paleti" })
    await user.type(within(dialog).getByRole("combobox"), target.name)

    await user.click(
      await within(dialog).findByRole("option", {
        name: new RegExp(target.name),
      })
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/examples")
    )
    expect(router.state.location.search).toMatchObject({ q: target.name })
  })

  it("TC-1.3-02 finds CRM records from the command palette and opens them", async () => {
    const deal = db.records.findFirst(
      (row) =>
        row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === "deal"
    )!
    const { user, router } = await renderShell()

    await user.click(screen.getByRole("button", { name: "Komut paletini aç" }))
    const dialog = await screen.findByRole("dialog", { name: "Komut paleti" })
    await user.type(
      within(dialog).getByRole("combobox"),
      String(deal.values.name)
    )

    const hit = await within(dialog).findByRole("option", {
      name: new RegExp(String(deal.values.name)),
    })
    expect(hit).toHaveTextContent("Fırsat")
    await user.click(hit)

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/o/deal/${deal.id}`)
    )
  })

  it("TC-1.3-03 opens the sidebar as a drawer on mobile", async () => {
    setViewportWidth(390)
    const { user, router } = await renderRoute("/dashboard", { as: "owner" })

    await screen.findByRole("heading", { name: /Hoş geldiniz/ })
    expect(
      screen.queryByRole("navigation", { name: "Ana menü" })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Kenar çubuğunu aç/kapat" })
    )
    const drawer = await screen.findByRole("dialog")
    await user.click(within(drawer).getByRole("link", { name: "Sevkiyatlar" }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/o/shipment")
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("remembers the collapsed sidebar across sessions", async () => {
    const first = await renderShell()

    await first.user.click(
      screen.getByRole("button", { name: "Kenar çubuğunu aç/kapat" })
    )
    await waitFor(() =>
      expect(document.querySelector("[data-slot=sidebar]")).toHaveAttribute(
        "data-state",
        "collapsed"
      )
    )
    expect(localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)).toContain(
      '"sidebarOpen":false'
    )
    first.unmount()

    await renderShell()
    expect(document.querySelector("[data-slot=sidebar]")).toHaveAttribute(
      "data-state",
      "collapsed"
    )
  })

  it("switches the workspace and reloads tenant data", async () => {
    const { user, router } = await renderShell("/examples")
    await screen.findByText("Toplam 24 kayıt")

    await user.click(
      screen.getByRole("button", { name: "Çalışma alanı: Acme Lojistik" })
    )
    await user.click(
      await screen.findByRole("menuitemradio", { name: /Marmara Forwarding/ })
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/dashboard")
    )
    expect(
      await screen.findByRole("button", {
        name: "Çalışma alanı: Marmara Forwarding",
      })
    ).toBeInTheDocument()
    expect(getSessionState().activeWorkspaceId).toBe(WORKSPACE_IDS.marmara)

    await act(() => router.navigate({ to: "/examples" }))
    expect(await screen.findByText("Toplam 6 kayıt")).toBeInTheDocument()
  })

  it("shows the notifications placeholder", async () => {
    const { user } = await renderShell()

    await user.click(screen.getByRole("button", { name: "Bildirimler" }))

    expect(
      await screen.findByText("Henüz bildiriminiz yok.")
    ).toBeInTheDocument()
  })
})
