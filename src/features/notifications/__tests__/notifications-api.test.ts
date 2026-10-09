import { afterEach, describe, expect, it } from "vitest"

import { submitPublicForm } from "@/features/public-site/api/public.api"
import { updateRecord } from "@/features/records/api/records.api"
import { configureApiClient } from "@/lib/api"
import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { emitMockEvent } from "@/mocks/events"
import { signInAs } from "@/test/auth"

import {
  fetchNotificationPreferences,
  fetchNotifications,
  markNotifications,
  updateNotificationPreferences,
} from "../api/notifications.api"
import { isoDay, remindDueItems } from "../mocks/producers"

const { acme } = WORKSPACE_IDS
const ACME_HOST = "acme-lojistik.forms.localhost"

async function submitContactForm(email = "ayse@demirtekstil.test") {
  configureApiClient({ publicHost: ACME_HOST })
  try {
    await submitPublicForm("iletisim", {
      answers: {
        name: "Ayşe Demir",
        companyName: "Demir Tekstil",
        email,
        phone: null,
        message: "Konteyner fiyatı rica ederim.",
        consent: true,
      },
      meta: {
        pageUrl: `http://${ACME_HOST}/f/iletisim`,
        referrer: "",
        embedded: false,
        language: "tr",
      },
    })
  } finally {
    configureApiClient({ publicHost: undefined })
  }
}

const notificationsOf = (userId: string, type?: string) =>
  db.notifications.findMany(
    (row) =>
      row.workspaceId === acme &&
      row.userId === userId &&
      (!type || row.type === type)
  )

afterEach(() => configureApiClient({ publicHost: undefined }))

describe("notifications API (B7.2)", () => {
  it("TC-7.2-01 counts unread notifications and marks them read", async () => {
    signInAs("owner")
    const first = await fetchNotifications()
    expect(first.unreadCount).toBe(
      first.data.filter((item) => !item.readAt).length
    )
    const before = first.unreadCount

    await submitContactForm()
    const after = await fetchNotifications()
    expect(after.unreadCount).toBe(before + 1)
    const fresh = after.data[0]!
    expect(fresh).toMatchObject({
      type: "submission.new",
      params: { form: "İletişim Formu", title: "Ayşe Demir" },
      link: { objectKey: "lead" },
      readAt: null,
    })

    const marked = await markNotifications({ ids: [fresh.id], read: true })
    expect(marked.unreadCount).toBe(before)
    expect(
      (await fetchNotifications({ unread: true })).data
    ).not.toContainEqual(expect.objectContaining({ id: fresh.id }))

    await markNotifications({ all: true, read: true })
    expect((await fetchNotifications()).unreadCount).toBe(0)
  })

  it("only lists and marks the signed-in member's own notifications", async () => {
    signInAs("agent")
    const others = notificationsOf(SEED_USERS.owner.id)
    const mine = await fetchNotifications()
    const othersIds = new Set(others.map((row) => row.id))
    expect(mine.data.some((item) => othersIds.has(item.id))).toBe(false)
    const result = await markNotifications({ ids: [others[0]!.id], read: true })
    expect(result.updated).toBe(0)
  })

  it("TC-7.2-03 switched-off types are not produced", async () => {
    signInAs("admin")
    const prefs = await updateNotificationPreferences({
      types: { "submission.new": false },
    })
    expect(prefs.types["submission.new"]).toBe(false)
    expect((await fetchNotificationPreferences()).types["task.due"]).toBe(true)

    const before = notificationsOf(SEED_USERS.admin.id, "submission.new").length
    await submitContactForm("baska@demirtekstil.test")
    expect(notificationsOf(SEED_USERS.admin.id, "submission.new")).toHaveLength(
      before
    )
    // The owner still gets it.
    expect(
      notificationsOf(SEED_USERS.owner.id, "submission.new").length
    ).toBeGreaterThan(0)
  })

  it("tells the new owner about an assignment, not someone who took it", async () => {
    signInAs("manager")
    const lead = db.records.findFirst(
      (row) =>
        row.workspaceId === acme &&
        row.objectKey === "lead" &&
        row.values.ownerId === SEED_USERS.owner.id
    )!
    await updateRecord("lead", lead.id, { ownerId: SEED_USERS.agent.id })
    expect(
      notificationsOf(SEED_USERS.agent.id, "record.assigned")
    ).toContainEqual(
      expect.objectContaining({
        params: { title: lead.values.name, actor: SEED_USERS.manager.name },
        link: { objectKey: "lead", recordId: lead.id },
      })
    )

    const count = notificationsOf(SEED_USERS.manager.id).length
    await updateRecord("lead", lead.id, { ownerId: SEED_USERS.manager.id })
    expect(notificationsOf(SEED_USERS.manager.id)).toHaveLength(count)
  })

  it("notifies the assignee of an inbound WhatsApp message once while unread", () => {
    const conversation = db.conversations.findFirst(
      (row) =>
        row.workspaceId === acme && row.assigneeId === SEED_USERS.agent.id
    )!
    const inbound = () =>
      emitMockEvent({
        workspaceId: acme,
        type: "conversation.inbound",
        objectKey: "conversation",
        recordId: conversation.id,
      })
    inbound()
    inbound()
    const rows = notificationsOf(SEED_USERS.agent.id, "whatsapp.inbound")
    expect(rows).toHaveLength(1)
    expect(rows[0]!.link).toEqual({ to: `/inbox?c=${conversation.id}` })

    db.notifications.update(rows[0]!.id, { readAt: new Date().toISOString() })
    inbound()
    expect(
      notificationsOf(SEED_USERS.agent.id, "whatsapp.inbound")
    ).toHaveLength(2)
  })

  it("TC-7.2-04 reminds due tasks and expiring quotes once", () => {
    const now = new Date(2026, 9, 9, 9)
    const task = db.tasks.create({
      id: "tsk_due_today",
      workspaceId: acme,
      title: "Rotterdam fiyatını teyit et",
      description: null,
      dueDate: isoDay(now),
      priority: "high",
      status: "open",
      assigneeId: SEED_USERS.agent.id,
      completedAt: null,
      related: null,
      createdBy: SEED_USERS.owner.id,
      createdAt: now.toISOString(),
    })
    const quote = (id: string, validUntil: string, status = "sent") =>
      db.records.create({
        id,
        workspaceId: acme,
        objectKey: "quote",
        values: {
          quoteNumber: id.toUpperCase(),
          status,
          validUntil,
          ownerId: SEED_USERS.manager.id,
        },
      })
    quote("q_soon", "2026-10-11")
    quote("q_later", "2026-10-12")
    quote("q_draft", "2026-10-10", "draft")

    remindDueItems(acme, now)
    remindDueItems(acme, now)

    const reminders = notificationsOf(SEED_USERS.agent.id, "task.due").filter(
      (row) => row.dedupeKey.startsWith(`task:${task.id}`)
    )
    expect(reminders).toHaveLength(1)
    expect(reminders[0]!.params).toEqual({ title: task.title })
    const expiring = notificationsOf(SEED_USERS.manager.id, "quote.expiring")
    const ours = expiring.filter((row) => row.params.title?.startsWith("Q_"))
    expect(ours.map((row) => row.params)).toEqual([
      { title: "Q_SOON", date: "2026-10-11" },
    ])
  })
})
