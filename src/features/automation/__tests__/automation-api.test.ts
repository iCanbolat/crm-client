import { afterEach, describe, expect, it } from "vitest"

import { submitPublicForm } from "@/features/public-site/api/public.api"
import { updateRecord } from "@/features/records/api/records.api"
import { configureApiClient, isApiError } from "@/lib/api"
import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"

import {
  createAutomation,
  deleteAutomation,
  fetchAutomation,
  fetchAutomationRuns,
  fetchAutomations,
  updateAutomation,
} from "../api/automation.api"
import { runAutomations, runTimedRules } from "../mocks/runner"

const { acme } = WORKSPACE_IDS
const ACME_HOST = "acme-lojistik.forms.localhost"
const DAY = 86_400_000

async function apiError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error
    throw error
  }
  throw new Error("expected an API error")
}

async function submitContactForm(email: string, name = "Ayşe Demir") {
  configureApiClient({ publicHost: ACME_HOST })
  try {
    await submitPublicForm("iletisim", {
      answers: {
        name,
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
  return db.records.findFirst(
    (row) => row.objectKey === "lead" && row.values.email === email
  )!
}

afterEach(() => configureApiClient({ publicHost: undefined }))

describe("automation API (B7.3)", () => {
  it("TC-7.3-02 a form submission assigns round-robin and creates a task", async () => {
    signInAs("admin")
    const rule = await updateAutomation("aut_acme_webform", {
      enabled: true,
      trigger: { type: "submission.created", formId: "form_contact" },
    })
    expect(rule.enabledAt).not.toBeNull()

    const first = await submitContactForm("ilk@demir.test")
    expect(first.values.ownerId).toBe(SEED_USERS.manager.id)
    const task = db.tasks.findFirst(
      (row) => row.related?.recordId === first.id
    )!
    expect(task).toMatchObject({
      title: "Navlun talebini 24 saat içinde ara",
      assigneeId: SEED_USERS.manager.id,
      status: "open",
    })
    // → the new owner hears about it (B7.2).
    expect(
      db.notifications.findFirst(
        (row) =>
          row.userId === SEED_USERS.manager.id &&
          row.type === "record.assigned" &&
          row.link !== null &&
          "recordId" in row.link &&
          row.link.recordId === first.id
      )
    ).toBeDefined()

    const second = await submitContactForm("ikinci@demir.test", "Mehmet Kaya")
    expect(second.values.ownerId).toBe(SEED_USERS.agent.id)

    const runs = await fetchAutomationRuns("aut_acme_webform")
    expect(runs.data).toHaveLength(2)
    expect(runs.data[0]).toMatchObject({
      event: "submission.created",
      status: "success",
      record: { objectKey: "lead", recordId: second.id, title: "Mehmet Kaya" },
      actions: [
        { type: "assignRoundRobin", status: "done", detail: "Can Öztürk" },
        { type: "createTask", status: "done" },
      ],
    })
    const listed = (await fetchAutomations()).data.find(
      (item) => item.id === "aut_acme_webform"
    )!
    expect(listed).toMatchObject({
      runCount: 2,
      lastRun: { status: "success" },
    })
  })

  it("TC-7.3-04 disabled rules never run and a rule runs once per event", async () => {
    signInAs("owner")
    const before = db.automationRuns.findMany(() => true).length
    await submitContactForm("kapali@demir.test")
    expect(db.automationRuns.findMany(() => true)).toHaveLength(before)

    const created = await createAutomation({
      name: "Yeni lead bildirimi",
      enabled: true,
      trigger: { type: "record.created", objectKey: "lead" },
      conditions: [{ field: "source", op: "eq", value: "webForm" }],
      actions: [{ type: "notify", to: SEED_USERS.manager.id }],
    })
    const lead = await submitContactForm("bir@demir.test")
    const event = {
      workspaceId: acme,
      type: "record.created",
      objectKey: "lead",
      recordId: lead.id,
    }
    expect(runAutomations(event)).toEqual([])
    const runs = await fetchAutomationRuns(created.id)
    expect(runs.data).toHaveLength(1)
    expect(
      db.notifications.findFirst(
        (row) =>
          row.userId === SEED_USERS.manager.id &&
          row.type === "automation.notify"
      )!.params
    ).toEqual({ rule: "Yeni lead bildirimi", title: "Ayşe Demir" })

    // Conditions not met → logged as skipped.
    const other = db.records.findFirst(
      (row) =>
        row.workspaceId === acme &&
        row.objectKey === "lead" &&
        row.values.source !== "webForm"
    )!
    const [skipped] = runAutomations({ ...event, recordId: other.id })
    expect(skipped).toMatchObject({ status: "skipped", reason: "conditions" })
  })

  it("runs on stage changes and reports skipped WhatsApp sends", async () => {
    signInAs("owner")
    const rule = await createAutomation({
      name: "Nitelikli lead",
      enabled: true,
      trigger: {
        type: "record.stageChanged",
        objectKey: "lead",
        stage: "qualified",
      },
      conditions: [],
      actions: [
        {
          type: "sendWhatsAppTemplate",
          templateId: "forwarding.requestReceived",
        },
        {
          type: "createTask",
          title: "Teklif hazırla",
          dueInDays: 2,
          assignee: "owner",
        },
      ],
    })
    const found = db.records.findFirst(
      (row) =>
        row.workspaceId === acme &&
        row.objectKey === "lead" &&
        row.values.stage === "new"
    )!
    // No phone: the WhatsApp action cannot reach anyone.
    const lead = db.records.update(found.id, {
      values: { ...found.values, phone: null },
    })!
    await updateRecord("lead", lead.id, { stage: "qualified" })
    const [run] = (await fetchAutomationRuns(rule.id)).data
    expect(run).toMatchObject({
      event: "record.stageChanged",
      status: "success",
      actions: [
        { type: "sendWhatsAppTemplate", status: "skipped" },
        { type: "createTask", status: "done" },
      ],
    })
    expect(run!.actions[0]!.code).toMatch(/noPhone|noOptIn|noRecipient/)
  })

  it("TC-7.3-03 follows up quotes unanswered for N days, once", () => {
    const rule = db.automations.findById("aut_acme_quote_followup")!
    const sentAt = new Date(Date.parse(rule.enabledAt!) + 60_000)
    const quote = db.records.create({
      id: "qte_followup",
      workspaceId: acme,
      objectKey: "quote",
      values: {
        quoteNumber: "Q-TEST-1",
        status: "sent",
        sentAt: sentAt.toISOString(),
        ownerId: SEED_USERS.agent.id,
      },
    })
    // A quote sent before the rule was switched on is ignored.
    db.records.create({
      id: "qte_old",
      workspaceId: acme,
      objectKey: "quote",
      values: {
        quoteNumber: "Q-TEST-0",
        status: "sent",
        sentAt: new Date(Date.parse(rule.enabledAt!) - DAY).toISOString(),
        ownerId: SEED_USERS.agent.id,
      },
    })

    runTimedRules(acme, new Date(sentAt.getTime() + DAY))
    expect(
      db.automationRuns.findMany((row) => row.ruleId === rule.id)
    ).toHaveLength(0)

    const later = new Date(sentAt.getTime() + 2 * DAY + 1000)
    runTimedRules(acme, later)
    runTimedRules(acme, later)
    const runs = db.automationRuns.findMany((row) => row.ruleId === rule.id)
    expect(runs).toHaveLength(1)
    expect(runs[0]!.record!.recordId).toBe(quote.id)
    expect(
      db.tasks.findFirst((row) => row.related?.recordId === quote.id)
    ).toMatchObject({
      title: "Teklif takibi: müşteriyi ara",
      assigneeId: SEED_USERS.agent.id,
    })
    expect(
      db.notifications.findFirst(
        (row) =>
          row.userId === SEED_USERS.agent.id && row.type === "automation.notify"
      )
    ).toBeDefined()
  })

  it("TC-7.3-05 managers read, agents are forbidden, references are checked", async () => {
    signInAs("manager")
    expect((await fetchAutomations()).data.length).toBeGreaterThanOrEqual(2)
    expect((await fetchAutomation("aut_acme_webform")).name).toBeTruthy()
    expect(
      (await apiError(updateAutomation("aut_acme_webform", { enabled: true })))
        .status
    ).toBe(403)

    signInAs("agent")
    expect((await apiError(fetchAutomations())).status).toBe(403)

    signInAs("owner")
    const invalid = await apiError(
      createAutomation({
        name: "Hatalı",
        enabled: true,
        trigger: { type: "submission.created", formId: "form_yok" },
        conditions: [],
        actions: [{ type: "assignRoundRobin", userIds: ["usr_yok"] }],
      })
    )
    expect(invalid.status).toBe(422)
    expect(Object.keys(invalid.fieldErrors ?? {})).toEqual([
      "trigger.formId",
      "actions.0",
    ])

    await deleteAutomation("aut_acme_webform")
    expect((await apiError(fetchAutomation("aut_acme_webform"))).status).toBe(
      404
    )
  })
})
