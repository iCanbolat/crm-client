import { waitFor, within } from "@testing-library/react"
import { addDays } from "date-fns"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"
import { renderRoute, screen } from "@/test/render"

import { createActivity, fetchTasks, updateTask } from "../api/activities.api"
import type { Task } from "../api/activities.schemas"
import { classifyTask, compareTasks, toDay } from "../lib/tasks"

const today = "2026-10-05"

const task = (patch: Partial<Task>): Task => ({
  id: "t",
  title: "Görev",
  description: null,
  dueDate: today,
  priority: "medium",
  status: "open",
  assigneeId: "u1",
  assigneeName: null,
  completedAt: null,
  related: null,
  createdBy: "u1",
  createdAt: "2026-10-01T00:00:00.000Z",
  ...patch,
})

const firstDeal = () =>
  db.records.findFirst(
    (row) => row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === "deal"
  )!

describe("task rules (B2.6)", () => {
  it("TC-2.6-03 classifies tasks into today / overdue / upcoming / done", () => {
    expect(classifyTask(task({ dueDate: "2026-10-04" }), today)).toBe("overdue")
    expect(classifyTask(task({ dueDate: today }), today)).toBe("today")
    expect(classifyTask(task({ dueDate: "2026-10-06" }), today)).toBe(
      "upcoming"
    )
    expect(
      classifyTask(task({ dueDate: "2026-10-01", status: "done" }), today)
    ).toBe("done")
  })

  it("orders by due date, then priority", () => {
    const tasks = [
      task({ id: "c", dueDate: "2026-10-06", priority: "high" }),
      task({ id: "b", dueDate: today, priority: "low" }),
      task({ id: "a", dueDate: today, priority: "high" }),
    ]
    expect([...tasks].sort(compareTasks).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ])
    expect(toDay(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05")
  })

  it("TC-2.6-03 the API filters overdue tasks relative to the client's day", async () => {
    signInAs("owner")
    const now = toDay()
    const overdue = await fetchTasks({ scope: "overdue", today: now })

    expect(overdue.data.length).toBe(overdue.counts.overdue)
    expect(
      overdue.data.every((item) => item.dueDate < now && item.status === "open")
    ).toBe(true)
    expect(
      overdue.data.every((item) => item.assigneeId === SEED_USERS.owner.id)
    ).toBe(true)

    // Seen from tomorrow, today's tasks become overdue.
    const tomorrow = await fetchTasks({
      scope: "overdue",
      today: toDay(addDays(new Date(), 1)),
    })
    expect(tomorrow.counts.overdue).toBe(
      overdue.counts.overdue + overdue.counts.today
    )
  })

  it("agents may only complete their own tasks", async () => {
    signInAs("agent")
    const foreign = db.tasks.findFirst(
      (row) =>
        row.workspaceId === WORKSPACE_IDS.acme &&
        row.assigneeId !== SEED_USERS.agent.id
    )!
    await expect(
      updateTask(foreign.id, { status: "done" })
    ).rejects.toMatchObject({
      status: 403,
    })
  })

  it("validates notes and rejects viewers", async () => {
    signInAs("owner")
    const deal = firstDeal()
    await expect(
      createActivity("deal", deal.id, { type: "note", body: " " })
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: { body: ["Bu alan zorunludur."] },
    })
    signInAs("viewer")
    await expect(
      createActivity("deal", deal.id, { type: "note", body: "Merhaba" })
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe("record timeline (B2.6)", () => {
  it("TC-2.6-01 a new note appears at the top of the timeline", async () => {
    const deal = firstDeal()
    const { user } = await renderRoute(`/o/deal/${deal.id}?tab=timeline`, {
      as: "owner",
    })

    const composer = await screen.findByRole("form", { name: "Aktivite ekle" })
    await user.type(
      within(composer).getByRole("textbox", { name: "Not" }),
      "Müşteri yeni fiyat teklifini bekliyor."
    )
    await user.click(
      within(composer).getByRole("button", { name: "Notu kaydet" })
    )

    expect(await screen.findByText("Aktivite kaydedildi.")).toBeInTheDocument()
    const timeline = await screen.findByRole("list", {
      name: "Aktivite geçmişi",
    })
    const [first] = within(timeline).getAllByRole("listitem")
    expect(first).toHaveTextContent("Müşteri yeni fiyat teklifini bekliyor.")
    expect(first).toHaveTextContent(SEED_USERS.owner.name)
    expect(within(composer).getByRole("textbox", { name: "Not" })).toHaveValue(
      ""
    )
  })

  it("logs a call with subject, direction and duration", async () => {
    const deal = firstDeal()
    const { user } = await renderRoute(`/o/deal/${deal.id}?tab=timeline`, {
      as: "owner",
    })

    const composer = await screen.findByRole("form", { name: "Aktivite ekle" })
    await user.click(within(composer).getByRole("button", { name: "Arama" }))
    await user.type(
      within(composer).getByRole("textbox", { name: "Konu" }),
      "Fiyat görüşmesi"
    )
    await user.type(
      within(composer).getByRole("spinbutton", { name: "Süre (dakika)" }),
      "15"
    )
    await user.click(
      within(composer).getByRole("button", { name: "Aramayı kaydet" })
    )

    const timeline = await screen.findByRole("list", {
      name: "Aktivite geçmişi",
    })
    await waitFor(() =>
      expect(within(timeline).getAllByRole("listitem")[0]).toHaveTextContent(
        "Arama: Fiyat görüşmesi"
      )
    )
    expect(within(timeline).getAllByRole("listitem")[0]).toHaveTextContent(
      "Giden · 15 dk"
    )
  })

  it("TC-2.6-02 creates a task for the record and completes it", async () => {
    const deal = firstDeal()
    const { user } = await renderRoute(`/o/deal/${deal.id}?tab=timeline`, {
      as: "owner",
    })

    await user.click(await screen.findByRole("button", { name: "Görev ekle" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni görev" })
    await user.type(
      within(dialog).getByRole("textbox", { name: "Başlık" }),
      "Navlun teyidini al"
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Görevi oluştur" })
    )

    const list = await screen.findByRole("list", { name: "Açık görevler" })
    const item = await within(list).findByText("Navlun teyidini al")
    const created = db.tasks.findFirst(
      (row) => row.title === "Navlun teyidini al"
    )!
    expect(created).toMatchObject({
      related: { objectKey: "deal", recordId: deal.id },
      assigneeId: SEED_USERS.owner.id,
      dueDate: toDay(),
    })

    await user.click(
      within(item.closest("li")!).getByRole("checkbox", {
        name: "Tamamlandı olarak işaretle: Navlun teyidini al",
      })
    )
    await waitFor(() =>
      expect(db.tasks.findById(created.id)!.status).toBe("done")
    )
    await waitFor(() =>
      expect(
        within(list).queryByText("Navlun teyidini al")
      ).not.toBeInTheDocument()
    )
  })
})

describe("my tasks page (B2.6)", () => {
  const mine = (scope: ReturnType<typeof classifyTask>) =>
    db.tasks.findMany(
      (row) =>
        row.workspaceId === WORKSPACE_IDS.acme &&
        row.assigneeId === SEED_USERS.owner.id &&
        classifyTask(row, toDay()) === scope
    )

  it("TC-2.6-03 groups my tasks into today, overdue and upcoming", async () => {
    const { user, router } = await renderRoute("/tasks", { as: "owner" })

    expect(
      await screen.findByRole("heading", { name: "Görevlerim", level: 1 })
    ).toBeInTheDocument()
    const tabs = screen.getByRole("tablist", { name: "Görev grupları" })
    expect(within(tabs).getByRole("tab", { name: /Bugün/ })).toHaveTextContent(
      String(mine("today").length)
    )
    expect(screen.getByRole("list", { name: "Bugün" }).children).toHaveLength(
      mine("today").length
    )

    await user.click(within(tabs).getByRole("tab", { name: /Geciken/ }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ scope: "overdue" })
    )
    const overdue = mine("overdue")
    if (overdue.length) {
      const list = await screen.findByRole("list", { name: "Geciken" })
      expect(within(list).getAllByRole("listitem")).toHaveLength(overdue.length)
      expect(within(list).getAllByText(/gün gecikti/).length).toBe(
        overdue.length
      )
    } else {
      expect(await screen.findByText("Geciken görev yok")).toBeInTheDocument()
    }
  })

  it("TC-2.6-02 completing a task moves it to done", async () => {
    const todays = mine("today")[0]!
    const { user } = await renderRoute("/tasks", { as: "owner" })

    const list = await screen.findByRole("list", { name: "Bugün" })
    await user.click(
      within(list).getAllByRole("checkbox", {
        name: `Tamamlandı olarak işaretle: ${todays.title}`,
      })[0]!
    )

    await waitFor(() =>
      expect(db.tasks.findById(todays.id)!.status).toBe("done")
    )
    await user.click(screen.getByRole("tab", { name: /Tamamlanan/ }))
    const done = await screen.findByRole("list", { name: "Tamamlanan" })
    expect(
      within(done).getAllByRole("checkbox", {
        name: `Yeniden aç: ${todays.title}`,
      }).length
    ).toBeGreaterThan(0)
  })

  it("managers can switch to the whole team's tasks", async () => {
    const { user, router } = await renderRoute("/tasks", { as: "manager" })

    await user.click(await screen.findByRole("button", { name: "Tüm ekip" }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ assignee: "all" })
    )
  })

  it("creates a standalone task from the page", async () => {
    const { user } = await renderRoute("/tasks", { as: "owner" })

    await user.click(await screen.findByRole("button", { name: "Yeni görev" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni görev" })
    await user.click(
      within(dialog).getByRole("button", { name: "Görevi oluştur" })
    )
    expect(
      within(dialog).getByRole("textbox", { name: "Başlık" })
    ).toHaveAttribute("aria-invalid", "true")

    await user.type(
      within(dialog).getByRole("textbox", { name: "Başlık" }),
      "Haftalık rapor"
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Görevi oluştur" })
    )

    expect(await screen.findByText("Görev oluşturuldu.")).toBeInTheDocument()
    expect(await screen.findByText("Haftalık rapor")).toBeInTheDocument()
  })
})
