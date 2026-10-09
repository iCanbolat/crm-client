import { screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { db } from "@/mocks/db"
import { SEED_USERS } from "@/mocks/db/seed"
import { renderRoute } from "@/test/render"

import { notificationHref, notificationText } from "../lib/messages"

const t = i18n.getFixedT("tr", "notifications")

describe("notification bell (B7.2)", () => {
  it("TC-7.2-02 opens the related record and marks it read", async () => {
    const seeded = db.notifications.findFirst(
      (row) =>
        row.userId === SEED_USERS.owner.id && row.type === "record.assigned"
    )!
    const { user, router } = await renderRoute("/dashboard", { as: "owner" })

    // Seeded + today's reminders (scheduled checks run on every poll).
    const bell = await screen.findByRole("button", {
      name: /^Bildirimler, \d+ okunmamış$/,
    })
    const unread = Number(/\d+/.exec(bell.getAttribute("aria-label")!)![0])
    expect(unread).toBeGreaterThanOrEqual(2)
    expect(screen.getByTestId("notifications-badge")).toHaveTextContent(
      String(unread)
    )
    await user.click(bell)

    const list = await screen.findByRole("list", { name: "Bildirimler" })
    const item = within(list).getByRole("button", {
      name: new RegExp(`Size bir kayıt atandı.*${seeded.params.title}`),
    })
    await user.click(item)

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/o/lead/${(seeded.link as { recordId: string }).recordId}`
      )
    )
    expect(db.notifications.findById(seeded.id)!.readAt).not.toBeNull()
    expect(
      await screen.findByRole("button", {
        name: `Bildirimler, ${unread - 1} okunmamış`,
      })
    ).toBeInTheDocument()
  })

  it("marks everything read", async () => {
    const { user } = await renderRoute("/dashboard", { as: "agent" })
    await user.click(
      await screen.findByRole("button", { name: /Bildirimler, \d+ okunmamış/ })
    )
    await user.click(
      await screen.findByRole("button", { name: "Tümünü okundu say" })
    )
    expect(
      await screen.findByRole("button", { name: "Bildirimler" })
    ).toBeInTheDocument()
    expect(screen.queryByTestId("notifications-badge")).not.toBeInTheDocument()
  })

  it("switches a type off in the preferences", async () => {
    const { user } = await renderRoute("/settings/notifications", {
      as: "viewer",
    })
    const toggle = await screen.findByRole("switch", {
      name: "Görevin son günü bugün bildirimlerini aç/kapat",
    })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(
      await screen.findByText("Bildirim tercihleri kaydedildi.")
    ).toBeInTheDocument()
    expect(toggle).not.toBeChecked()
    expect(
      db.notificationPrefs.findById(`ws_acme:${SEED_USERS.viewer.id}`)!.types
    ).toEqual({ "task.due": false })
  })
})

describe("notification texts", () => {
  it("renders every type", () => {
    const text = (type: string, params: Record<string, string>) =>
      notificationText({ type, params } as never, t, "tr")
    expect(text("submission.new", { form: "İletişim", title: "Ayşe" })).toEqual(
      { title: "Yeni form gönderimi", body: "İletişim: Ayşe" }
    )
    expect(text("submission.new", { form: "İletişim", title: "" }).body).toBe(
      "İletişim"
    )
    expect(text("record.assigned", { title: "Lead A", actor: "" }).body).toBe(
      "Lead A"
    )
    expect(
      text("record.assigned", { title: "Lead A", actor: "Zeynep" }).body
    ).toBe("Zeynep size atadı: Lead A")
    expect(
      text("quote.expiring", { title: "Q-1", date: "2026-10-11" }).body
    ).toBe("Q-1 · son geçerlilik 11 Eki 2026")
    expect(
      text("whatsapp.inbound", { name: "Leyla", preview: "Selam" })
    ).toEqual({ title: "Yeni WhatsApp mesajı", body: "Leyla: Selam" })
    expect(
      text("automation.notify", { rule: "Yeni lead", title: "Lead A" })
    ).toEqual({ title: "Yeni lead", body: "Lead A" })
  })

  it("links records and pages", () => {
    expect(notificationHref(null)).toBeNull()
    expect(notificationHref({ to: "/inbox?c=1" })).toBe("/inbox?c=1")
    expect(notificationHref({ objectKey: "lead", recordId: "a b" })).toBe(
      "/o/lead/a%20b"
    )
  })
})
