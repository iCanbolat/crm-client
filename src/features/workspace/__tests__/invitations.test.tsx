import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { resetSessionStore } from "@/features/auth"
import { fetchMe } from "@/features/auth/api/auth.api"
import { latestEmail } from "@/mocks/accounts"
import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"
import { renderRoute, screen } from "@/test/render"

import {
  acceptInvite,
  createInvite,
  fetchInvitation,
  fetchInvites,
  fetchMembers,
  removeMember,
  resendInvite,
  revokeInvite,
  updateMemberRole,
} from "../api/workspace.api"

// Registers the module manifests like the app does.
import "@/app/modules"

const linkOf = (email: string) => latestEmail(email, "invite")!.link!
const tokenOf = (email: string) => linkOf(email).split("/").pop()!

async function inviteToAtlas(email: string, role: "agent" | "manager") {
  signInAs("atlasOwner")
  await createInvite({ email, role })
  return tokenOf(email)
}

/** Faz 10 — invitation links and team management (B10.6). */
describe("invitations (B10.6)", () => {
  it("TC-10.6-01 unknown, revoked and expired links are refused", async () => {
    await expect(fetchInvitation("yok-boyle-bir-davet")).rejects.toMatchObject({
      status: 404,
      code: "INVITE_INVALID",
    })

    const token = await inviteToAtlas("iptal@atlas.test", "agent")
    await expect(fetchInvitation(token)).resolves.toMatchObject({
      email: "iptal@atlas.test",
      workspaceName: "Atlas Yurtdışı Eğitim",
      vertical: "visa-education",
      inviterName: SEED_USERS.atlasOwner.name,
    })
    const invite = db.invites.findFirst((item) => item.token === token)!
    await revokeInvite(invite.id)
    await expect(fetchInvitation(token)).rejects.toMatchObject({
      status: 404,
    })

    const expired = await inviteToAtlas("eski@atlas.test", "agent")
    db.invites.update(
      db.invites.findFirst((item) => item.token === expired)!.id,
      { expiresAt: new Date(Date.now() - 1000).toISOString() }
    )
    await expect(fetchInvitation(expired)).rejects.toMatchObject({
      status: 410,
      code: "INVITE_EXPIRED",
    })

    await renderRoute(`/invite/${expired}`)
    expect(
      await screen.findByRole("heading", { name: "Davet geçersiz" })
    ).toBeInTheDocument()
  })

  it("TC-10.6-02 an invited counsellor signs up and lands in the scoped panel", async () => {
    const email = "yeni.danisman@atlas.test"
    const token = await inviteToAtlas(email, "agent")
    // The invited person is not signed in.
    resetSessionStore()
    const { user, router } = await renderRoute(`/invite/${token}`)

    expect(
      await screen.findByText(
        /sizi Atlas Yurtdışı Eğitim çalışma alanına Danışman olarak davet etti/
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Vize & Eğitim Danışmanlığı")).toBeInTheDocument()
    expect(screen.getByText(email)).toBeInTheDocument()

    await user.type(screen.getByLabelText("Ad soyad"), "Selim Er")
    await user.type(screen.getByLabelText("Şifre"), "Guvenli123!")
    await user.type(screen.getByLabelText("Şifre (tekrar)"), "Guvenli123!")
    await user.click(
      screen.getByRole("checkbox", { name: /Kullanım koşullarını/ })
    )
    await user.click(
      screen.getByRole("button", { name: "Hesap oluştur ve katıl" })
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/dashboard")
    )
    const nav = await screen.findByRole("navigation", { name: "Ana menü" })
    expect(within(nav).getByText("Danışmanlık")).toBeInTheDocument()
    const account = db.users.findFirst((item) => item.email === email)!
    expect(account.emailVerified).toBe(true)
    expect(
      db.memberships.findById(`${WORKSPACE_IDS.atlas}:${account.id}`)
    ).toMatchObject({ role: "agent" })
    expect(db.invites.findFirst((item) => item.token === token)?.status).toBe(
      "accepted"
    )
  })

  it("TC-10.6-03 an existing user accepts and gets a second workspace", async () => {
    const token = await inviteToAtlas(SEED_USERS.agent.email, "manager")

    // Someone else's session: the page asks to switch accounts.
    const other = await renderRoute(`/invite/${token}`, { as: "viewer" })
    expect(
      await screen.findByText("Bu davet başka bir hesap için")
    ).toBeInTheDocument()
    other.unmount()

    signInAs("viewer")
    await expect(acceptInvite(token)).rejects.toMatchObject({
      status: 403,
      code: "INVITE_EMAIL_MISMATCH",
    })

    const { user, router } = await renderRoute(`/invite/${token}`, {
      as: "agent",
    })
    await user.click(
      await screen.findByRole("button", { name: "Daveti kabul et" })
    )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/dashboard")
    )
    expect(
      await screen.findByRole("button", {
        name: /Çalışma alanı: Atlas Yurtdışı Eğitim/,
      })
    ).toBeInTheDocument()

    const me = await fetchMe()
    expect(
      me.memberships.map((item) => [item.workspaceName, item.role])
    ).toEqual(
      expect.arrayContaining([
        ["Acme Lojistik", "agent"],
        ["Atlas Yurtdışı Eğitim", "manager"],
      ])
    )
  })

  it("TC-10.6-04 roles change, members leave, invitations are managed", async () => {
    signInAs("atlasOwner")
    const ece = SEED_USERS.atlasEducation.id

    await updateMemberRole(ece, { role: "manager" })
    expect(
      (await fetchMembers()).data.find((member) => member.userId === ece)?.role
    ).toBe("manager")

    await expect(
      updateMemberRole(SEED_USERS.atlasOwner.id, { role: "admin" })
    ).rejects.toMatchObject({ status: 409 })

    signInAs("atlasManager")
    await expect(
      updateMemberRole(ece, { role: "agent" })
    ).rejects.toMatchObject({ status: 403 })

    signInAs("atlasOwner")
    const owned = db.records.findMany(
      (row) =>
        row.workspaceId === WORKSPACE_IDS.atlas && row.values.ownerId === ece
    ).length
    expect(owned).toBeGreaterThan(0)
    await removeMember(ece)
    expect(
      (await fetchMembers()).data.some((member) => member.userId === ece)
    ).toBe(false)
    // Their records return to the unassigned pool.
    expect(
      db.records.findMany(
        (row) =>
          row.workspaceId === WORKSPACE_IDS.atlas && row.values.ownerId === ece
      )
    ).toHaveLength(0)

    await createInvite({ email: "tekrar@atlas.test", role: "viewer" })
    const invite = (await fetchInvites()).data.find(
      (item) => item.email === "tekrar@atlas.test"
    )!
    expect(invite.link).toMatch(/^\/invite\//)
    const before = db.outbox.count()
    await resendInvite(invite.id)
    expect(db.outbox.count()).toBe(before + 1)
  })

  it("TC-10.6-04 the team page offers changes on others only", async () => {
    await renderRoute("/settings/members", { as: "atlasOwner" })
    const list = await screen.findByRole("list", { name: "Ekip üyeleri" })

    expect(
      within(list).getByRole("combobox", { name: "Ece Yıldız için rol" })
    ).toBeInTheDocument()
    expect(
      within(list).queryByRole("combobox", { name: "Ayşe Korkmaz için rol" })
    ).not.toBeInTheDocument()
    expect(
      within(list).getByRole("button", { name: "Onur Aksoy kişisini çıkar" })
    ).toBeInTheDocument()
  })
})
