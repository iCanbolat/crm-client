import { within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { renderRoute, screen } from "@/test/render"

async function openExamples(as: "viewer" | "agent" | "manager") {
  const utils = await renderRoute("/examples?pageSize=50", { as })
  const list = await screen.findByRole("list", { name: "Örnek kayıtlar" })
  return { ...utils, list }
}

describe("role based access (B1.4)", () => {
  it("TC-1.4-01 viewers see no create or delete actions", async () => {
    const { list } = await openExamples("viewer")

    expect(
      screen.queryByRole("button", { name: "Ekle" })
    ).not.toBeInTheDocument()
    expect(within(list).queryAllByRole("button")).toHaveLength(0)
    const nav = screen.getByRole("navigation", { name: "Ana menü" })
    expect(
      within(nav).queryByRole("link", { name: "Ekip" })
    ).not.toBeInTheDocument()
  })

  it("TC-1.4-02 agents may delete only their own records", async () => {
    const { list } = await openExamples("agent")
    const acme = db.examples.findMany(
      (item) => item.workspaceId === WORKSPACE_IDS.acme
    )
    const own = acme.filter((item) => item.ownerId === SEED_USERS.agent.id)
    expect(own.length).toBeGreaterThan(0)
    expect(own.length).toBeLessThan(acme.length)

    const items = within(list).getAllByRole("listitem")
    for (const item of items) {
      const isOwn = item.textContent?.includes(
        `Sahibi: ${SEED_USERS.agent.name}`
      )
      const deleteButtons = within(item).queryAllByRole("button", {
        name: /sil/,
      })
      expect(deleteButtons).toHaveLength(isOwn ? 1 : 0)
    }
    // Agents can still create records.
    expect(screen.getByRole("button", { name: "Ekle" })).toBeInTheDocument()
  })

  it("managers may delete any record", async () => {
    const { list } = await openExamples("manager")

    const items = within(list).getAllByRole("listitem")
    expect(within(list).getAllByRole("button", { name: /sil/ })).toHaveLength(
      items.length
    )
  })

  it("TC-1.4-03 shows the 403 page for a route the role may not open", async () => {
    const { router } = await renderRoute("/settings/members", { as: "viewer" })

    expect(
      await screen.findByRole("heading", { name: "Bu sayfaya erişiminiz yok" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/settings/members")
    // Still inside the shell, so the user can navigate away.
    expect(
      screen.getByRole("navigation", { name: "Ana menü" })
    ).toBeInTheDocument()
  })

  it("lets managers view the team but not invite", async () => {
    await renderRoute("/settings/members", { as: "manager" })

    const members = await screen.findByRole("list", { name: "Ekip üyeleri" })
    expect(within(members).getAllByRole("listitem")).toHaveLength(5)
    expect(
      screen.queryByRole("button", { name: "Üye davet et" })
    ).not.toBeInTheDocument()
  })

  it("lets admins invite a member", async () => {
    const { user } = await renderRoute("/settings/members", { as: "admin" })

    await user.click(
      await screen.findByRole("button", { name: "Üye davet et" })
    )
    const dialog = await screen.findByRole("dialog", { name: "Ekibe davet et" })
    await user.type(within(dialog).getByLabelText("E-posta"), "satis@acme.test")
    await user.click(
      within(dialog).getByRole("button", { name: "Davet gönder" })
    )

    expect(await screen.findByText("Davet gönderildi.")).toBeInTheDocument()
    const invites = await screen.findByRole("list", {
      name: "Bekleyen davetler",
    })
    expect(within(invites).getByText("satis@acme.test")).toBeInTheDocument()
  })
})
