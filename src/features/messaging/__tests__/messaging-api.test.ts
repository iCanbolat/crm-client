import { beforeEach, describe, expect, it } from "vitest"

import {
  createRecord,
  updateRecord,
  uploadAttachments,
} from "@/features/records/api/records.api"
import { apiClient, isApiError } from "@/lib/api"
import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { apiPath } from "@/mocks/utils/http"
import { changeQuoteStatus } from "@/modules/forwarding/api/quotes.api"
import { recordMilestone } from "@/modules/forwarding/api/shipments.api"
import { location } from "@/modules/forwarding/mocks/reference/locations"
import { signInAs } from "@/test/auth"

import {
  connectChannel,
  disconnectChannel,
  fetchChannel,
  fetchChannelStatus,
  fetchConversation,
  fetchConversationRecords,
  fetchConversations,
  fetchDispatches,
  fetchInboxSummary,
  fetchMessages,
  fetchRecordConversation,
  fetchTemplateParams,
  fetchTemplates,
  retryMessage,
  sendMessage,
  startConversation,
  syncTemplates,
  updateConversation,
  updateTriggers,
  verifyChannel,
} from "../api/messaging.api"
import {
  INBOX_SEARCH_DEFAULTS,
  type ConversationQuery,
} from "../api/messaging.schemas"
import { dispatchMessageEvent } from "../mocks/dispatch"
import { DELIVERY_STEPS_MS, TEMPLATE_REVIEW_MS } from "../mocks/store"

const { acme, marmara } = WORKSPACE_IDS

async function apiError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error
    throw error
  }
  throw new Error("expected an API error")
}

const CREDENTIALS = {
  wabaId: "123456789012",
  phoneNumberId: "234567890123",
  accessToken: "EAAGtestTokenForMarmaraWhatsApp7890",
  appSecret: "0123456789abcdef0123456789abcdef",
}

const query = (patch: Partial<ConversationQuery> = {}): ConversationQuery => ({
  ...INBOX_SEARCH_DEFAULTS,
  ...patch,
})

/** Moves Meta's review / delivery runs into the past (mock clock). */
function ageTemplates(workspaceId: string) {
  for (const row of db.waTemplates.findMany(
    (item) => item.workspaceId === workspaceId
  )) {
    db.waTemplates.update(row.id, {
      submittedAt: new Date(Date.now() - TEMPLATE_REVIEW_MS).toISOString(),
    })
  }
}

function ageMessages(conversationId: string, ms: number) {
  for (const row of db.messages.findMany(
    (item) => item.conversationId === conversationId
  )) {
    db.messages.update(row.id, {
      queuedAt: new Date(Date.now() - ms).toISOString(),
    })
  }
}

/** Customer message in Meta's webhook shape. */
async function inbound(workspaceId: string, phone: string, text: string) {
  const from = phone.replace(/^\+/, "")
  const response = await fetch(
    new URL(apiPath(`/webhooks/whatsapp/${workspaceId}`), location_origin()),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba",
            changes: [
              {
                field: "messages",
                value: {
                  contacts: [{ wa_id: from, profile: { name: "Müşteri" } }],
                  messages: [
                    {
                      from,
                      id: `wamid.${Math.random()}`,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: "text",
                      text: { body: text },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    }
  )
  expect(response.status).toBe(200)
}

const location_origin = () => window.location.origin

const acmeRecords = (objectKey: string) =>
  db.records.findMany(
    (row) => row.workspaceId === acme && row.objectKey === objectKey
  )

/** An Acme shipment whose contact may receive WhatsApp updates. */
function reachableShipment() {
  const shipment = acmeRecords("shipment").find((row) => row.values.contactId)!
  const contact = db.records.findById(String(shipment.values.contactId))!
  db.records.update(contact.id, {
    values: { ...contact.values, phone: "+905551112233", whatsappOptIn: true },
  })
  db.records.update(shipment.id, {
    values: {
      ...shipment.values,
      atd: "2026-10-05",
      eta: "2026-10-20",
      ata: null,
    },
  })
  return { shipment: db.records.findById(shipment.id)!, contact }
}

describe("WhatsApp connection (B6.1)", () => {
  beforeEach(() => {
    signInAs("owner", { workspaceId: marmara })
  })

  it("starts disconnected with webhook details", async () => {
    const channel = await fetchChannel()
    expect(channel.connection).toBeNull()
    expect(channel.webhook.url).toBe(
      `https://hooks.crm-platform.app/whatsapp/${marmara}`
    )
    expect(channel.webhook.verifyToken).toMatch(/^vt_/)
    expect(await fetchChannelStatus()).toEqual({
      connected: false,
      displayPhoneNumber: null,
    })
  })

  it("TC-6.1-02 explains Meta's credential errors", async () => {
    const token = await apiError(
      verifyChannel({
        ...CREDENTIALS,
        accessToken: "EAAG-invalid-token-000000",
      })
    )
    expect(token).toMatchObject({ status: 422, code: "WA_INVALID_TOKEN" })
    expect(token.fieldErrors?.accessToken?.[0]).toContain("190")
    expect(token.details).toEqual({ metaCode: 190 })

    const phone = await apiError(
      connectChannel({ ...CREDENTIALS, phoneNumberId: "000123456789" })
    )
    expect(phone).toMatchObject({ code: "WA_PHONE_NOT_FOUND" })
    expect(phone.fieldErrors?.phoneNumberId).toHaveLength(1)

    const missing = await apiError(
      verifyChannel({ wabaId: "123456", phoneNumberId: "234567" })
    )
    expect(missing).toMatchObject({ code: "WA_TOKEN_REQUIRED" })

    const format = await apiError(
      connectChannel({ ...CREDENTIALS, wabaId: "abc" })
    )
    expect(format.fieldErrors?.wabaId).toBeDefined()
    expect(db.waChannels.findById(`wa_${marmara}`)).toBeUndefined()

    expect(await verifyChannel(CREDENTIALS)).toEqual({
      displayPhoneNumber: "+90 850 789 01 23",
      verifiedName: "Marmara Forwarding",
      qualityRating: "GREEN",
      messagingLimitTier: "TIER_1K",
    })
  })

  it("TC-6.1-03 never returns the access token or the app secret", async () => {
    const channel = await connectChannel(CREDENTIALS)
    expect(channel.connection).toMatchObject({
      wabaId: CREDENTIALS.wabaId,
      phoneNumberId: CREDENTIALS.phoneNumberId,
      tokenLast4: "7890",
    })
    for (const response of [channel, await fetchChannel()]) {
      const json = JSON.stringify(response)
      expect(json).not.toContain(CREDENTIALS.accessToken)
      expect(json).not.toContain(CREDENTIALS.appSecret)
    }
    expect(await fetchChannelStatus()).toEqual({
      connected: true,
      displayPhoneNumber: "+90 850 789 01 23",
    })

    // Updating the ids keeps the stored token.
    const updatedAt = channel.connection!.tokenUpdatedAt
    const updated = await connectChannel({
      wabaId: CREDENTIALS.wabaId,
      phoneNumberId: "234567890999",
    })
    expect(updated.connection).toMatchObject({
      phoneNumberId: "234567890999",
      tokenLast4: "7890",
      tokenUpdatedAt: updatedAt,
    })
    expect(db.waChannels.findById(`wa_${marmara}`)!.accessToken).toBe(
      CREDENTIALS.accessToken
    )
  })

  it("TC-6.1-04 managers read, agents and viewers are kept out", async () => {
    signInAs("manager")
    expect((await fetchChannel()).connection?.wabaId).toBe("104857600012345")
    expect(await apiError(connectChannel(CREDENTIALS))).toMatchObject({
      status: 403,
    })
    expect(await apiError(updateTriggers({ x: true }))).toMatchObject({
      status: 403,
    })
    signInAs("agent")
    expect(await apiError(fetchChannel())).toMatchObject({ status: 403 })
    expect(await apiError(fetchDispatches())).toMatchObject({ status: 403 })
    // …but may use the inbox.
    expect((await fetchChannelStatus()).connected).toBe(true)
    signInAs("viewer")
    expect(await apiError(disconnectChannel())).toMatchObject({ status: 403 })
  })

  it("disconnecting keeps conversations and drops the templates", async () => {
    signInAs("owner")
    await disconnectChannel()
    expect((await fetchChannel()).connection).toBeNull()
    expect(
      db.waTemplates.findMany((row) => row.workspaceId === acme)
    ).toHaveLength(0)
    expect((await fetchConversations(query())).meta.total).toBeGreaterThan(0)
    const [first] = (await fetchConversations(query())).data
    expect(
      await apiError(sendMessage(first!.id, { type: "text", body: "Selam" }))
    ).toMatchObject({ status: 409, code: "WA_NOT_CONNECTED" })
  })
})

describe("sector templates (B6.2)", () => {
  beforeEach(() => {
    signInAs("owner", { workspaceId: marmara })
  })

  it("TC-6.2-03 submits only the active modules' templates on connect", async () => {
    const before = await fetchTemplates()
    expect(before).toHaveLength(10)
    expect(before.every((item) => item.submissions.length === 0)).toBe(true)

    await connectChannel(CREDENTIALS)
    const templates = await fetchTemplates()
    expect(templates.map((item) => item.name)).toContain(
      "fwd_shipment_departed_v1"
    )
    for (const template of templates) {
      expect(template.moduleId).toBe("forwarding")
      expect(template.submissions.map((item) => item.language)).toEqual([
        "tr",
        "en",
      ])
      expect(
        template.submissions.every((item) => item.status === "pending")
      ).toBe(true)
    }

    // A workspace without sector modules has no templates at all.
    db.workspaces.update(marmara, { modules: [] })
    expect(await fetchTemplates()).toEqual([])
  })

  it("TC-6.2-04 Meta's review approves (or rejects) after a while", async () => {
    await connectChannel(CREDENTIALS)
    ageTemplates(marmara)
    const approved = await fetchTemplates()
    expect(
      approved.flatMap((item) => item.submissions.map((entry) => entry.status))
    ).toEqual(Array(20).fill("approved"))

    // A WABA id ending in 0000 rejects the English versions (mock rule).
    await connectChannel({ ...CREDENTIALS, wabaId: "123456780000" })
    ageTemplates(marmara)
    const [first] = await fetchTemplates()
    expect(first!.submissions).toEqual([
      expect.objectContaining({ language: "tr", status: "approved" }),
      expect.objectContaining({
        language: "en",
        status: "rejected",
        rejectionReason: "TAG_CONTENT_MISMATCH",
      }),
    ])
  })

  it("TC-6.2-05 templates cannot be edited or deleted", async () => {
    for (const method of ["patch", "put", "delete"] as const) {
      const error = await apiError(
        apiClient[method]("/channels/whatsapp/templates/forwarding.quoteSent", {
          body: { content: {} },
        })
      )
      expect(error).toMatchObject({ status: 405, code: "TEMPLATE_MANAGED" })
    }
  })

  it("syncs new versions and disables the old ones", async () => {
    signInAs("owner")
    const old = db.waTemplates.findFirst(
      (row) => row.workspaceId === acme && row.name === "fwd_quote_sent_v1"
    )!
    db.waTemplates.update(old.id, { name: "fwd_quote_sent_v0" })
    const templates = await syncTemplates()
    expect(db.waTemplates.findById(old.id)!.status).toBe("disabled")
    const quote = templates.find((item) => item.id === "forwarding.quoteSent")!
    // The renamed Turkish version is submitted again; English stays.
    expect(quote.submissions).toEqual([
      expect.objectContaining({ language: "tr", status: "pending" }),
      expect.objectContaining({ language: "en", status: "approved" }),
    ])
    signInAs("manager")
    expect(await apiError(syncTemplates())).toMatchObject({ status: 403 })
  })
})

describe("inbox (B6.3)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  it("lists open conversations newest first with filters", async () => {
    const open = await fetchConversations(query())
    expect(open.data.length).toBeGreaterThan(10)
    const times = open.data.map((item) => item.lastMessageAt)
    expect([...times].sort().reverse()).toEqual(times)
    expect(open.data.every((item) => item.status === "open")).toBe(true)

    const closed = await fetchConversations(query({ status: "closed" }))
    expect(closed.data.length).toBe(4)
    const unread = await fetchConversations(query({ unread: true }))
    expect(unread.data.every((item) => item.unreadCount > 0)).toBe(true)
    expect((await fetchInboxSummary()).unread).toBe(unread.data.length)
    const unassigned = await fetchConversations(
      query({ assignee: "unassigned" })
    )
    expect(unassigned.data.every((item) => item.assigneeId === null)).toBe(true)
    const search = await fetchConversations(query({ q: "jonas" }))
    expect(search.data.map((item) => item.profileName)).toEqual(["Jonas Weber"])
  })

  it("TC-6.3-02 free text needs an open 24 h window", async () => {
    const stale = db.conversations.findById("cnv_acme_07")!
    expect(
      stale.lastInboundAt! < new Date(Date.now() - 86_400_000).toISOString()
    ).toBe(true)
    const error = await apiError(
      sendMessage(stale.id, { type: "text", body: "Merhaba" })
    )
    expect(error).toMatchObject({ status: 422, code: "WINDOW_CLOSED" })
    expect(error.details).toEqual({ metaCode: 131047 })

    const message = await sendMessage("cnv_acme_01", {
      type: "text",
      body: "Merhaba, hemen bakıyorum.",
    })
    expect(message).toMatchObject({
      direction: "outbound",
      status: "queued",
      sentBy: SEED_USERS.owner.id,
    })
  })

  it("TC-6.3-03 an incoming message lands in the inbox as unread", async () => {
    const before = (await fetchInboxSummary()).unread
    const contact = acmeRecords("contact").find(
      (row) =>
        !db.conversations.findFirst((item) => item.phone === row.values.phone)
    )!
    await inbound(
      acme,
      String(contact.values.phone),
      "Merhaba, teklif alabilir miyim?"
    )
    const byPhone = async (phone: string) =>
      (await fetchConversations(query())).data.find(
        (item) => item.phone === phone
      )
    const latest = await byPhone(String(contact.values.phone))
    expect(latest).toMatchObject({
      phone: contact.values.phone,
      unreadCount: 1,
      lastMessagePreview: "Merhaba, teklif alabilir miyim?",
      lastMessageDirection: "inbound",
      contact: { objectKey: "contact", recordId: contact.id },
    })
    expect((await fetchInboxSummary()).unread).toBe(before + 1)

    const read = await updateConversation(latest!.id, { read: true })
    expect(read.unreadCount).toBe(0)
    expect((await fetchInboxSummary()).unread).toBe(before)

    // Unknown numbers open a conversation without a record.
    await inbound(acme, "+447700900123", "Hi there")
    const unknown = await byPhone("+447700900123")
    expect(unknown).toMatchObject({ contact: null, profileName: "Müşteri" })

    // A closed conversation reopens when the customer writes.
    await updateConversation(unknown!.id, { status: "closed" })
    await inbound(acme, "+447700900123", "Hello again")
    expect((await fetchConversation(unknown!.id)).status).toBe("open")
  })

  it("links an unknown number to a lead", async () => {
    await inbound(acme, "+447700900124", "Hi")
    const conversation = (await fetchConversations(query())).data.find(
      (item) => item.phone === "+447700900124"
    )
    const lead = await createRecord("lead", {
      name: "Hi Ltd",
      phone: "+447700900124",
    })
    const linked = await updateConversation(conversation!.id, {
      contact: { objectKey: "lead", recordId: lead.id },
    })
    expect(linked.contact).toMatchObject({ objectKey: "lead", label: "Hi Ltd" })
    expect(
      await apiError(
        updateConversation(conversation!.id, {
          contact: { objectKey: "lead", recordId: "nope" },
        })
      )
    ).toMatchObject({ status: 422 })
  })

  it("TC-6.3-04 delivery statuses advance; failures can be retried", async () => {
    const sent = await sendMessage("cnv_acme_01", {
      type: "text",
      body: "Test",
    })
    ageMessages("cnv_acme_01", DELIVERY_STEPS_MS.read)
    const messages = await fetchMessages("cnv_acme_01")
    expect(messages.find((item) => item.id === sent.id)?.status).toBe("read")

    await inbound(acme, "+905550000000", "Merhaba")
    const conversation = db.conversations.findFirst(
      (row) => row.phone === "+905550000000"
    )!
    const failing = await sendMessage(conversation.id, {
      type: "text",
      body: "Yanıt",
    })
    ageMessages(conversation.id, DELIVERY_STEPS_MS.sent)
    const [, failed] = await fetchMessages(conversation.id)
    expect(failed).toMatchObject({
      id: failing.id,
      status: "failed",
      error: { code: 131026 },
    })
    const retried = await retryMessage(failing.id)
    expect(retried).toMatchObject({ status: "queued", error: null })
    expect(await apiError(retryMessage(failing.id))).toMatchObject({
      status: 409,
    })
  })

  it("TC-6.3-05 agents see their own and unassigned conversations", async () => {
    signInAs("agent")
    const list = await fetchConversations(query({ status: "all" }))
    expect(list.data.length).toBeGreaterThan(0)
    expect(
      list.data.every(
        (item) =>
          item.assigneeId === null || item.assigneeId === SEED_USERS.agent.id
      )
    ).toBe(true)
    const others = db.conversations.findFirst(
      (row) => row.assigneeId === SEED_USERS.owner.id
    )!
    expect(await apiError(fetchConversation(others.id))).toMatchObject({
      status: 404,
    })

    const unassigned = list.data.find((item) => item.assigneeId === null)!
    expect(
      await apiError(
        updateConversation(unassigned.id, { assigneeId: SEED_USERS.manager.id })
      )
    ).toMatchObject({ status: 403 })
    const taken = await updateConversation(unassigned.id, {
      assigneeId: SEED_USERS.agent.id,
    })
    expect(taken.assigneeName).toBe(SEED_USERS.agent.name)

    signInAs("manager")
    const assigned = await updateConversation(unassigned.id, {
      assigneeId: SEED_USERS.owner.id,
    })
    expect(assigned.assigneeId).toBe(SEED_USERS.owner.id)
    expect(
      await apiError(
        updateConversation(unassigned.id, { assigneeId: SEED_USERS.viewer.id })
      )
    ).toMatchObject({ status: 422 })

    signInAs("viewer")
    expect((await fetchConversations(query())).data.length).toBeGreaterThan(0)
    expect(
      await apiError(sendMessage("cnv_acme_01", { type: "text", body: "x" }))
    ).toMatchObject({ status: 403 })
    expect(
      await apiError(updateConversation("cnv_acme_01", { status: "closed" }))
    ).toMatchObject({ status: 403 })
  })

  it("TC-6.3-07 'DUR' withdraws the WhatsApp consent", async () => {
    const conversation = db.conversations.findById("cnv_acme_01")!
    const contactId = conversation.contact!.recordId
    expect(db.records.findById(contactId)!.values.whatsappOptIn).toBe(true)
    await inbound(acme, conversation.phone, "DUR")
    const contact = db.records.findById(contactId)!
    expect(contact.values).toMatchObject({
      whatsappOptIn: false,
      whatsappOptInAt: null,
    })
    expect((await fetchConversation(conversation.id)).optIn).toBe(false)
    expect(
      db.activities.findFirst(
        (row) => row.recordId === contactId && row.type === "whatsapp"
      )
    ).toMatchObject({ direction: "inbound", body: "DUR" })
  })

  it("keeps the opt-in date in step with the flag", async () => {
    const contact = acmeRecords("contact").find(
      (row) => row.values.whatsappOptIn === false
    )!
    const on = await updateRecord("contact", contact.id, {
      whatsappOptIn: true,
    })
    expect(on.values.whatsappOptInAt).toEqual(expect.any(String))
    const off = await updateRecord("contact", contact.id, {
      whatsappOptIn: false,
    })
    expect(off.values.whatsappOptInAt).toBeNull()
  })

  it("verifies Meta's webhook subscription", async () => {
    const url = new URL(
      apiPath(`/webhooks/whatsapp/${acme}`),
      location_origin()
    )
    url.searchParams.set("hub.mode", "subscribe")
    url.searchParams.set("hub.challenge", "1158201444")
    url.searchParams.set("hub.verify_token", "vt_acme_9c41e2")
    const ok = await fetch(url)
    expect(await ok.text()).toBe("1158201444")
    url.searchParams.set("hub.verify_token", "wrong")
    expect((await fetch(url)).status).toBe(403)
  })
})

describe("template sends and the record tab (B6.4)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  it("TC-6.4-01 sends 'shipment departed' with the shipment's values", async () => {
    const { shipment, contact } = reachableShipment()
    const record = { objectKey: "shipment", recordId: shipment.id }

    const tab = await fetchRecordConversation("shipment", shipment.id)
    expect(tab.recipient).toMatchObject({
      contact: { objectKey: "contact", recordId: contact.id },
      phone: "+905551112233",
      optIn: true,
    })

    const { params, missing } = await fetchTemplateParams(
      "forwarding.shipmentDeparted",
      "tr",
      record,
      null
    )
    expect(missing).toEqual([])
    expect(params[0]).toBe(String(contact.values.name).split(" ")[0])
    expect(params[1]).toBe(shipment.values.shipmentNumber)

    const conversation = await startConversation(record)
    expect(conversation.contact?.recordId).toBe(contact.id)
    expect(
      await fetchConversationRecords(conversation.id, "shipment")
    ).toContainEqual(expect.objectContaining({ recordId: shipment.id }))
    const message = await sendMessage(conversation.id, {
      type: "template",
      templateId: "forwarding.shipmentDeparted",
      language: "tr",
      record,
      params,
    })
    expect(message).toMatchObject({
      type: "template",
      template: {
        name: "fwd_shipment_departed_v1",
        header: "Sevkiyat yola çıktı",
      },
      record: { recordId: shipment.id },
    })
    expect(message.body).toContain(String(shipment.values.shipmentNumber))
    expect(message.body).not.toContain("{{")

    // TC-6.4-03 the record's timeline shows the message.
    expect(
      db.activities.findFirst(
        (row) => row.recordId === shipment.id && row.type === "whatsapp"
      )
    ).toMatchObject({
      subject: "Sevkiyat yola çıktı",
      direction: "outbound",
      createdBy: SEED_USERS.owner.id,
    })
    const tabAfter = await fetchRecordConversation("shipment", shipment.id)
    expect(tabAfter.conversation?.id).toBe(conversation.id)
  })

  it("TC-6.4-02 templates need consent, approval and valid values", async () => {
    const { shipment, contact } = reachableShipment()
    const record = { objectKey: "shipment", recordId: shipment.id }
    const conversation = await startConversation(record)
    const send = (patch: Record<string, unknown> = {}) =>
      sendMessage(conversation.id, {
        type: "template",
        templateId: "forwarding.customsCleared",
        language: "tr",
        record,
        params: ["Ayşe", "SHP-1"],
        ...patch,
      })

    expect(await apiError(send({ params: ["Ayşe"] }))).toMatchObject({
      status: 422,
    })
    expect(await apiError(send({ params: ["Ayşe", "a\nb"] }))).toMatchObject({
      status: 422,
      fieldErrors: { "params.1": [expect.any(String)] },
    })
    expect(
      await apiError(send({ record: { objectKey: "quote", recordId: "x" } }))
    ).toMatchObject({ status: 422 })

    const row = db.waTemplates.findFirst(
      (item) => item.name === "fwd_customs_cleared_v1" && item.language === "tr"
    )!
    db.waTemplates.update(row.id, {
      status: "pending",
      submittedAt: new Date().toISOString(),
    })
    expect(await apiError(send())).toMatchObject({
      code: "TEMPLATE_NOT_APPROVED",
    })
    db.waTemplates.update(row.id, { status: "approved" })

    db.records.update(contact.id, {
      values: {
        ...db.records.findById(contact.id)!.values,
        whatsappOptIn: false,
      },
    })
    expect(await apiError(send())).toMatchObject({
      status: 422,
      code: "NO_OPT_IN",
    })
  })

  it("explains records without a reachable recipient", async () => {
    const shipment = acmeRecords("shipment").find(
      (row) => !row.values.contactId
    )
    if (shipment) {
      expect(await fetchRecordConversation("shipment", shipment.id)).toEqual({
        recipient: null,
        conversation: null,
      })
      expect(
        await apiError(
          startConversation({ objectKey: "shipment", recordId: shipment.id })
        )
      ).toMatchObject({ code: "NO_RECIPIENT" })
    }
    const lead = await createRecord("lead", { name: "Telefonsuz" })
    const tab = await fetchRecordConversation("lead", lead.id)
    expect(tab.recipient).toMatchObject({ phone: null, optIn: false })
    expect(
      await apiError(
        startConversation({ objectKey: "lead", recordId: lead.id })
      )
    ).toMatchObject({ code: "NO_PHONE" })
  })
})

describe("automatic notifications (B6.5)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  const departedMessages = (phone: string) => {
    const conversation = db.conversations.findFirst(
      (row) => row.phone === phone
    )
    return conversation
      ? db.messages.findMany(
          (row) =>
            row.conversationId === conversation.id &&
            row.template?.name === "fwd_shipment_departed_v1"
        )
      : []
  }

  async function departedShipment() {
    const customer = acmeRecords("company")[0]!
    const contact = acmeRecords("contact")[0]!
    db.records.update(contact.id, {
      values: {
        ...contact.values,
        phone: "+905559998877",
        whatsappOptIn: true,
      },
    })
    const shipment = await createRecord("shipment", {
      mode: "AIR",
      origin: location("IST"),
      destination: location("FRA"),
      etd: "2026-09-20",
      eta: "2026-09-25",
      customerId: customer.id,
      contactId: contact.id,
      awbNumber: "235-12345678",
    })
    const at = (day: string) => `2026-09-${day}T10:00:00.000Z`
    await recordMilestone(shipment.id, { milestone: "BOOKED", at: at("10") })
    await recordMilestone(shipment.id, {
      milestone: "CARGO_READY",
      at: at("11"),
    })
    await recordMilestone(shipment.id, { milestone: "PICKED_UP", at: at("12") })
    return {
      shipment,
      contact,
      depart: () =>
        recordMilestone(shipment.id, { milestone: "DEPARTED", at: at("13") }),
    }
  }

  it("TC-6.5-01 a switched-on milestone sends its template", async () => {
    const off = await departedShipment()
    await off.depart()
    expect(departedMessages("+905559998877")).toHaveLength(0)
    expect(await fetchDispatches()).toEqual([])

    const channel = await updateTriggers({
      "forwarding.milestone.DEPARTED": true,
    })
    expect(channel.triggers["forwarding.milestone.DEPARTED"]).toBe(true)
    const on = await departedShipment()
    await on.depart()
    const [message] = departedMessages("+905559998877")
    expect(message).toMatchObject({
      sentBy: null,
      record: { recordId: on.shipment.id },
    })
    expect(message!.body).toContain(String(on.shipment.values.shipmentNumber))
    const [dispatch] = await fetchDispatches()
    expect(dispatch).toMatchObject({
      triggerId: "forwarding.milestone.DEPARTED",
      status: "sent",
      reason: null,
      record: { recordId: on.shipment.id },
    })
    expect(
      db.activities.findFirst(
        (row) => row.recordId === on.shipment.id && row.type === "whatsapp"
      )
    ).toMatchObject({ createdBy: "system" })
  })

  it("TC-6.5-02 logs why a notification was skipped", async () => {
    await updateTriggers({ "forwarding.milestone.DEPARTED": true })
    const reasons: (string | null)[] = []
    const run = async (
      prepare: (ids: { contact: string; shipment: string }) => void
    ) => {
      const { shipment, contact, depart } = await departedShipment()
      prepare({ contact: contact.id, shipment: shipment.id })
      await depart()
      reasons.push((await fetchDispatches())[0]!.reason)
    }
    const patch = (id: string, values: Record<string, unknown>) =>
      db.records.update(id, {
        values: { ...db.records.findById(id)!.values, ...values },
      })

    await run(({ contact }) => patch(contact, { whatsappOptIn: false }))
    await run(({ contact }) => patch(contact, { phone: null }))
    await run(({ shipment }) => patch(shipment, { contactId: null }))
    await run(({ shipment }) => patch(shipment, { eta: null }))
    await run(() => {
      const row = db.waTemplates.findFirst(
        (item) =>
          item.name === "fwd_shipment_departed_v1" && item.language === "tr"
      )!
      db.waTemplates.update(row.id, { status: "paused" })
    })
    await run(() => db.waChannels.delete(`wa_${acme}`))
    expect(reasons).toEqual([
      "noOptIn",
      "noPhone",
      "noRecipient",
      "missingParams",
      "templateNotApproved",
      "notConnected",
    ])
  })

  it("TC-6.5-03 quote sends and web form leads notify too", async () => {
    await updateTriggers({
      "forwarding.quoteSent": true,
      "forwarding.webFormLead": true,
    })
    const quote = acmeRecords("quote").find(
      (row) => row.values.status === "draft" && row.values.contactId
    )!
    const contact = db.records.findById(String(quote.values.contactId))!
    db.records.update(contact.id, {
      values: {
        ...contact.values,
        phone: "+905554443322",
        whatsappOptIn: true,
      },
    })
    await changeQuoteStatus(quote.id, {
      action: "send",
      email: { to: "musteri@example.com" },
    })
    const lead = await createRecord("lead", {
      name: "Form Müşterisi",
      phone: "+905553332211",
      source: "webForm",
      whatsappOptIn: true,
    })
    await createRecord("lead", {
      name: "E-posta Müşterisi",
      phone: "+905553332200",
      source: "email",
      whatsappOptIn: true,
    })
    const dispatches = await fetchDispatches()
    expect(dispatches.map((item) => [item.triggerId, item.status])).toEqual([
      ["forwarding.webFormLead", "sent"],
      ["forwarding.quoteSent", "sent"],
    ])
    expect(dispatches[0]!.record.recordId).toBe(lead.id)
    const messages = db.messages.findMany(
      (row) =>
        row.template !== null &&
        row.sentBy === null &&
        !row.id.startsWith("msg_acme_")
    )
    expect(messages.map((row) => row.template!.name).sort()).toEqual([
      "fwd_quote_sent_v1",
      "fwd_request_received_v1",
    ])
  })

  it("TC-6.5-04 the same event never sends twice", async () => {
    await updateTriggers({ "forwarding.milestone.DEPARTED": true })
    const { shipment, depart } = await departedShipment()
    await depart()
    const event = {
      type: "shipment.milestone",
      objectKey: "shipment",
      recordId: shipment.id,
      data: { milestone: "DEPARTED" },
    }
    expect(dispatchMessageEvent(acme, event)).toEqual([])
    expect(await fetchDispatches()).toHaveLength(1)
  })

  it("notifies a pushed-back ETA and uploaded B/L or AWB", async () => {
    await updateTriggers({
      "forwarding.etaDelayed": true,
      "forwarding.documentReady": true,
    })
    const { shipment } = reachableShipment()
    await updateRecord("shipment", shipment.id, { eta: "2026-10-18" })
    expect(await fetchDispatches()).toEqual([])
    await updateRecord("shipment", shipment.id, { eta: "2026-10-27" })
    const file = new File(["%PDF"], "bl.pdf", { type: "application/pdf" })
    await uploadAttachments("shipment", shipment.id, [file], "invoice")
    await uploadAttachments("shipment", shipment.id, [file], "awb")
    const dispatches = await fetchDispatches()
    expect(dispatches.map((item) => item.triggerId)).toEqual([
      "forwarding.documentReady",
      "forwarding.etaDelayed",
    ])
    const document = db.messages.findFirst(
      (row) => row.template?.name === "fwd_document_ready_v1"
    )!
    expect(document.body).toContain("Hava yolu senedi (AWB)")
  })
})
