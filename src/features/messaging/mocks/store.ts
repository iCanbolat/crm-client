import {
  advanceStatus,
  getRecipientRule,
  isOptOutMessage,
  isWindowOpen,
  OPT_IN_AT_FIELD,
  OPT_IN_FIELD,
  TEMPLATE_LANGUAGES,
  templateToText,
  validateTemplateDef,
  type MessageStatus,
  type MessageTemplateDef,
  type TemplateLanguage,
  type TemplateStatus,
} from "@/engine/messaging"
import { getRecordTitle } from "@/engine/metadata"
import {
  findRecordRow,
  getObjectDef,
  getRecordRef,
  toCrmRecord,
} from "@/features/records/mocks/store"
import type { Subject } from "@/lib/rbac"
import { db } from "@/mocks/db"
import { getActiveManifests } from "@/mocks/modules"

import type {
  ConnectChannelInput,
  Conversation,
  ConversationQuery,
  Message,
  MessageTemplate,
  PhoneNumberInfo,
  RecordLink,
  WhatsappChannel,
} from "../api/messaging.schemas"
import type {
  ConversationRow,
  MessageRow,
  RecordKey,
  WaSettingsRow,
  WaTemplateRow,
} from "./types"

const newId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`

/** Where Meta posts events for a workspace (configured in the Meta app). */
export const WEBHOOK_BASE_URL = "https://hooks.crm-platform.app/whatsapp"

/* ------------------------------------------------------------------ channel */

export function settingsOf(workspaceId: string): WaSettingsRow {
  const id = `was_${workspaceId}`
  return (
    db.waSettings.findById(id) ??
    db.waSettings.create({
      id,
      workspaceId,
      verifyToken: newId("vt"),
      triggers: {},
    })
  )
}

export function channelOf(workspaceId: string) {
  return db.waChannels.findById(`wa_${workspaceId}`)
}

export function toChannel(workspaceId: string): WhatsappChannel {
  const settings = settingsOf(workspaceId)
  const row = channelOf(workspaceId)
  return {
    connection: row
      ? {
          wabaId: row.wabaId,
          phoneNumberId: row.phoneNumberId,
          displayPhoneNumber: row.displayPhoneNumber,
          verifiedName: row.verifiedName,
          qualityRating: row.qualityRating,
          messagingLimitTier: row.messagingLimitTier,
          tokenLast4: row.accessToken.slice(-4),
          tokenUpdatedAt: row.tokenUpdatedAt,
          connectedAt: row.connectedAt,
        }
      : null,
    webhook: {
      url: `${WEBHOOK_BASE_URL}/${workspaceId}`,
      verifyToken: settings.verifyToken,
    },
    triggers: settings.triggers,
  }
}

export type CredentialError =
  | { code: "WA_INVALID_TOKEN"; field: "accessToken"; metaCode: 190 }
  | { code: "WA_PHONE_NOT_FOUND"; field: "phoneNumberId"; metaCode: 100 }
  | { code: "WA_TOKEN_REQUIRED"; field: "accessToken"; metaCode: null }

/**
 * Mock of `GET /{PHONE_NUMBER_ID}` with the tenant's token. A token
 * containing `invalid` is rejected (Meta error 190); a phone number id
 * starting with `000` does not belong to the WABA (error 100).
 */
export function verifyCredentials(
  workspaceId: string,
  input: ConnectChannelInput
): { ok: true; info: PhoneNumberInfo } | { ok: false; error: CredentialError } {
  const token = input.accessToken ?? channelOf(workspaceId)?.accessToken
  if (!token) {
    return {
      ok: false,
      error: {
        code: "WA_TOKEN_REQUIRED",
        field: "accessToken",
        metaCode: null,
      },
    }
  }
  if (/invalid/i.test(token)) {
    return {
      ok: false,
      error: { code: "WA_INVALID_TOKEN", field: "accessToken", metaCode: 190 },
    }
  }
  if (input.phoneNumberId.startsWith("000")) {
    return {
      ok: false,
      error: {
        code: "WA_PHONE_NOT_FOUND",
        field: "phoneNumberId",
        metaCode: 100,
      },
    }
  }
  const digits = input.phoneNumberId.slice(-7).padStart(7, "0")
  const workspace = db.workspaces.findById(workspaceId)
  return {
    ok: true,
    info: {
      displayPhoneNumber: `+90 850 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`,
      verifiedName: workspace?.name ?? "",
      qualityRating: "GREEN",
      messagingLimitTier: "TIER_1K",
    },
  }
}

export function connectChannel(
  workspaceId: string,
  input: ConnectChannelInput,
  info: PhoneNumberInfo
) {
  const now = new Date().toISOString()
  const existing = channelOf(workspaceId)
  const tokenChanged =
    !!input.accessToken && input.accessToken !== existing?.accessToken
  const values = {
    ...info,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    accessToken: input.accessToken ?? existing!.accessToken,
    appSecret: input.appSecret ?? existing?.appSecret ?? null,
    tokenUpdatedAt: tokenChanged || !existing ? now : existing.tokenUpdatedAt,
  }
  // Another WABA has its own templates: start over.
  if (existing && existing.wabaId !== input.wabaId) {
    for (const row of templateRowsOf(workspaceId)) db.waTemplates.delete(row.id)
  }
  if (existing) db.waChannels.update(existing.id, values)
  else {
    db.waChannels.create({
      id: `wa_${workspaceId}`,
      workspaceId,
      connectedAt: now,
      ...values,
    })
  }
  syncTemplates(workspaceId)
}

/** Conversations stay; the WABA's templates go with it. */
export function disconnectChannel(workspaceId: string) {
  const row = channelOf(workspaceId)
  if (row) db.waChannels.delete(row.id)
  for (const template of templateRowsOf(workspaceId)) {
    db.waTemplates.delete(template.id)
  }
}

/* ---------------------------------------------------------------- templates */

/** Meta's review takes this long in the mock. */
export const TEMPLATE_REVIEW_MS = 3_000

export function moduleTemplatesOf(workspaceId: string) {
  const modules = db.workspaces.findById(workspaceId)?.modules ?? []
  return getActiveManifests(modules).flatMap((manifest) =>
    (manifest.messageTemplates ?? []).map((def) => ({
      moduleId: manifest.id,
      def,
    }))
  )
}

export function findTemplateDef(workspaceId: string, templateId: string) {
  return moduleTemplatesOf(workspaceId).find(
    (item) => item.def.id === templateId
  )?.def
}

function templateRowsOf(workspaceId: string) {
  return db.waTemplates.findMany((row) => row.workspaceId === workspaceId)
}

/**
 * Deterministic review: approved after TEMPLATE_REVIEW_MS. A WABA id ending
 * in `0000` rejects the English versions (to demo a rejection).
 */
export function templateStatusAt(
  row: Pick<WaTemplateRow, "status" | "submittedAt" | "language">,
  wabaId: string,
  now: number
): Pick<WaTemplateRow, "status" | "rejectionReason"> {
  if (row.status !== "pending") {
    return { status: row.status, rejectionReason: null }
  }
  if (now - new Date(row.submittedAt).getTime() < TEMPLATE_REVIEW_MS) {
    return { status: "pending", rejectionReason: null }
  }
  if (wabaId.endsWith("0000") && row.language === "en") {
    return { status: "rejected", rejectionReason: "TAG_CONTENT_MISMATCH" }
  }
  return { status: "approved", rejectionReason: null }
}

function advanceTemplate(row: WaTemplateRow, wabaId: string): WaTemplateRow {
  if (row.status !== "pending") return row
  const next = templateStatusAt(row, wabaId, Date.now())
  if (next.status === row.status) return row
  return db.waTemplates.update(row.id, {
    ...next,
    updatedAt: new Date().toISOString(),
  })!
}

/**
 * Submits every template of the workspace's active modules that the WABA
 * does not have yet (new templates and new `_vN` versions). Versions the
 * modules no longer ship are disabled, never deleted. Idempotent.
 */
export function syncTemplates(workspaceId: string) {
  if (!channelOf(workspaceId)) return
  const now = new Date().toISOString()
  const current = moduleTemplatesOf(workspaceId)
  const rows = templateRowsOf(workspaceId)
  for (const { moduleId, def } of current) {
    const invalid = validateTemplateDef(def).length > 0
    for (const language of TEMPLATE_LANGUAGES) {
      const exists = rows.some(
        (row) => row.name === def.name && row.language === language
      )
      if (exists) continue
      db.waTemplates.create({
        id: newId("wat"),
        workspaceId,
        templateId: def.id,
        moduleId,
        name: def.name,
        language,
        status: invalid ? "rejected" : "pending",
        rejectionReason: invalid ? "INVALID_FORMAT" : null,
        submittedAt: now,
        updatedAt: now,
      })
    }
  }
  for (const row of rows) {
    const shipped = current.some(({ def }) => def.name === row.name)
    if (!shipped && row.status !== "disabled") {
      db.waTemplates.update(row.id, { status: "disabled", updatedAt: now })
    }
  }
}

function submissionsOf(workspaceId: string, def: MessageTemplateDef) {
  const channel = channelOf(workspaceId)
  if (!channel) return []
  return templateRowsOf(workspaceId)
    .filter((row) => row.name === def.name)
    .map((row) => advanceTemplate(row, channel.wabaId))
}

export function listTemplates(workspaceId: string): MessageTemplate[] {
  return moduleTemplatesOf(workspaceId).map(({ moduleId, def }) => ({
    id: def.id,
    name: def.name,
    moduleId,
    category: def.category,
    objectKey: def.objectKey,
    label: def.label,
    variables: def.variables,
    content: def.content,
    submissions: submissionsOf(workspaceId, def)
      .sort(
        (a, b) =>
          TEMPLATE_LANGUAGES.indexOf(a.language) -
          TEMPLATE_LANGUAGES.indexOf(b.language)
      )
      .map((row) => ({
        language: row.language,
        status: row.status,
        rejectionReason: row.rejectionReason,
        updatedAt: row.updatedAt,
      })),
  }))
}

export function templateStatusOf(
  workspaceId: string,
  def: MessageTemplateDef,
  language: TemplateLanguage
): TemplateStatus | null {
  return (
    submissionsOf(workspaceId, def).find((row) => row.language === language)
      ?.status ?? null
  )
}

/* ------------------------------------------------------------ recipients */

export interface Recipient {
  contact: RecordKey & { label: string }
  phone: string | null
  optIn: boolean
}

function personOf(workspaceId: string, key: RecordKey): Recipient | null {
  const row = findRecordRow(workspaceId, key.objectKey, key.recordId)
  const def = getObjectDef(workspaceId, key.objectKey)
  if (!row || !def) return null
  const phoneField = def.fields.find((field) => field.type === "phone")
  const phone = phoneField ? row.values[phoneField.key] : null
  return {
    contact: {
      ...key,
      label: getRecordTitle(def, { id: row.id, values: row.values, refs: {} }),
    },
    phone: typeof phone === "string" && phone ? phone : null,
    optIn: row.values[OPT_IN_FIELD] === true,
  }
}

/** Contact/lead a record's WhatsApp messages go to (engine rule). */
export function resolveRecipient(
  workspaceId: string,
  key: RecordKey
): Recipient | null {
  const def = getObjectDef(workspaceId, key.objectKey)
  const row = findRecordRow(workspaceId, key.objectKey, key.recordId)
  if (!def || !row) return null
  const rule = getRecipientRule(def)
  if (!rule) return null
  if (rule.kind === "self") return personOf(workspaceId, key)
  const contactId = row.values[rule.field]
  if (typeof contactId !== "string" || !contactId) return null
  return personOf(workspaceId, { objectKey: "contact", recordId: contactId })
}

/** Contact (preferred) or newest lead with this number. */
export function findPersonByPhone(
  workspaceId: string,
  phone: string
): RecordKey | null {
  for (const objectKey of ["contact", "lead"]) {
    const match = db.records
      .findMany(
        (row) =>
          row.workspaceId === workspaceId &&
          row.objectKey === objectKey &&
          row.values.phone === phone
      )
      .sort((a, b) =>
        String(b.values.createdAt).localeCompare(String(a.values.createdAt))
      )[0]
    if (match) return { objectKey, recordId: match.id }
  }
  return null
}

function setOptIn(workspaceId: string, key: RecordKey, optIn: boolean) {
  const row = findRecordRow(workspaceId, key.objectKey, key.recordId)
  if (!row) return
  db.records.update(row.id, {
    values: {
      ...row.values,
      [OPT_IN_FIELD]: optIn,
      [OPT_IN_AT_FIELD]: optIn ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
  })
}

/* ------------------------------------------------------------ conversations */

export function findConversation(workspaceId: string, id: string) {
  const row = db.conversations.findById(id)
  return row && row.workspaceId === workspaceId ? row : undefined
}

/** Agents see conversations assigned to them or to nobody. */
export function isVisibleTo(row: ConversationRow, subject: Subject) {
  if (subject.role !== "agent") return true
  return row.assigneeId === null || row.assigneeId === subject.userId
}

function recordLink(
  workspaceId: string,
  key: RecordKey | null
): RecordLink | null {
  if (!key) return null
  const ref = getRecordRef(workspaceId, key.objectKey, key.recordId)
  return ref ? { ...key, label: ref.label } : null
}

export function toConversation(row: ConversationRow): Conversation {
  const contact = recordLink(row.workspaceId, row.contact)
  const person = row.contact ? personOf(row.workspaceId, row.contact) : null
  return {
    id: row.id,
    phone: row.phone,
    profileName: row.profileName,
    contact,
    optIn: person?.optIn ?? false,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeId
      ? (db.users.findById(row.assigneeId)?.name ?? null)
      : null,
    status: row.status,
    unreadCount: row.unreadCount,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    lastMessageDirection: row.lastMessageDirection,
    lastInboundAt: row.lastInboundAt,
    createdAt: row.createdAt,
  }
}

const fold = (value: string) =>
  value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")

export function listConversations(
  workspaceId: string,
  subject: Subject,
  query: ConversationQuery
) {
  const q = fold(query.q.trim())
  return db.conversations
    .findMany((row) => row.workspaceId === workspaceId)
    .filter((row) => isVisibleTo(row, subject))
    .filter((row) => query.status === "all" || row.status === query.status)
    .filter((row) =>
      query.assignee === "me"
        ? row.assigneeId === subject.userId
        : query.assignee === "unassigned"
          ? row.assigneeId === null
          : true
    )
    .filter((row) => !query.unread || row.unreadCount > 0)
    .map(toConversation)
    .filter(
      (item) =>
        !q ||
        [
          item.contact?.label,
          item.profileName,
          item.phone,
          item.lastMessagePreview,
        ]
          .filter(Boolean)
          .some((text) => fold(String(text)).includes(q))
    )
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

export function unreadCountOf(workspaceId: string, subject: Subject) {
  return db.conversations
    .findMany((row) => row.workspaceId === workspaceId)
    .filter((row) => isVisibleTo(row, subject) && row.unreadCount > 0).length
}

/** Conversation with a number; created (and linked to a person) on demand. */
export function ensureConversation(
  workspaceId: string,
  phone: string,
  {
    contact,
    profileName = null,
  }: {
    contact?: RecordKey | null
    profileName?: string | null
  } = {}
): ConversationRow {
  const existing = db.conversations.findFirst(
    (row) => row.workspaceId === workspaceId && row.phone === phone
  )
  if (existing) {
    if (!existing.contact && contact) {
      return db.conversations.update(existing.id, { contact })!
    }
    return existing
  }
  const now = new Date().toISOString()
  return db.conversations.create({
    id: newId("cnv"),
    workspaceId,
    phone,
    profileName,
    contact: contact ?? findPersonByPhone(workspaceId, phone),
    assigneeId: null,
    status: "open",
    unreadCount: 0,
    lastMessageAt: now,
    lastMessagePreview: "",
    lastMessageDirection: "outbound",
    lastInboundAt: null,
    createdAt: now,
  })
}

/* ----------------------------------------------------------------- messages */

/** Delivery steps of an outbound message in the mock. */
export const DELIVERY_STEPS_MS = { sent: 800, delivered: 1_600, read: 4_000 }

/**
 * Deterministic delivery from the time it was queued: a number ending in
 * `0000` is undeliverable (Meta 131026), one ending in `1111` never reads.
 */
export function messageStatusAt(
  row: Pick<MessageRow, "queuedAt" | "direction" | "status">,
  phone: string,
  now: number
): Pick<MessageRow, "status" | "error"> {
  if (row.direction === "inbound" || row.status === "failed") {
    return { status: row.status, error: null }
  }
  const elapsed = now - new Date(row.queuedAt).getTime()
  let next: MessageStatus = "queued"
  if (elapsed >= DELIVERY_STEPS_MS.sent) next = "sent"
  if (phone.endsWith("0000") && next === "sent") {
    return {
      status: "failed",
      error: { code: 131026, message: "Message undeliverable" },
    }
  }
  if (elapsed >= DELIVERY_STEPS_MS.delivered) next = "delivered"
  if (elapsed >= DELIVERY_STEPS_MS.read && !phone.endsWith("1111")) {
    next = "read"
  }
  return { status: advanceStatus(row.status, next), error: null }
}

function advanceMessage(row: MessageRow, phone: string): MessageRow {
  if (row.direction === "inbound") return row
  if (row.status === "read" || row.status === "failed") return row
  const next = messageStatusAt(row, phone, Date.now())
  if (next.status === row.status) return row
  return db.messages.update(row.id, next)!
}

export function messagesOf(conversation: ConversationRow) {
  return db.messages
    .findMany((row) => row.conversationId === conversation.id)
    .map((row) => advanceMessage(row, conversation.phone))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function findMessage(workspaceId: string, id: string) {
  const row = db.messages.findById(id)
  return row && row.workspaceId === workspaceId ? row : undefined
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction,
    type: row.type,
    body: row.body,
    template: row.template,
    status: row.status,
    error: row.error,
    record: recordLink(row.workspaceId, row.record),
    sentBy: row.sentBy,
    sentByName: row.sentBy
      ? (db.users.findById(row.sentBy)?.name ?? null)
      : null,
    createdAt: row.createdAt,
  }
}

const preview = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 120)

function appendMessage(
  conversation: ConversationRow,
  message: Omit<MessageRow, "id" | "workspaceId" | "conversationId" | "wamid">
) {
  const row = db.messages.create({
    id: newId("msg"),
    workspaceId: conversation.workspaceId,
    conversationId: conversation.id,
    wamid: `wamid.${crypto.randomUUID().replace(/-/g, "")}`,
    ...message,
  })
  const inbound = message.direction === "inbound"
  db.conversations.update(conversation.id, {
    lastMessageAt: message.createdAt,
    lastMessagePreview: preview(message.body),
    lastMessageDirection: message.direction,
    ...(inbound
      ? {
          lastInboundAt: message.createdAt,
          unreadCount: conversation.unreadCount + 1,
          status: "open" as const,
        }
      : {}),
  })
  return row
}

export function sendText(
  conversation: ConversationRow,
  body: string,
  userId: string
) {
  const now = new Date().toISOString()
  return appendMessage(conversation, {
    direction: "outbound",
    type: "text",
    body,
    template: null,
    status: "queued",
    error: null,
    record: null,
    sentBy: userId,
    queuedAt: now,
    createdAt: now,
  })
}

export function canSendText(conversation: ConversationRow) {
  return isWindowOpen(conversation.lastInboundAt)
}

/**
 * Sends an approved template and logs a `whatsapp` activity on the record
 * it is about (or the linked person) — B6.4.
 */
export function sendTemplate({
  conversation,
  def,
  language,
  params,
  record,
  sentBy,
}: {
  conversation: ConversationRow
  def: MessageTemplateDef
  language: TemplateLanguage
  params: string[]
  record: RecordKey | null
  sentBy: string | null
}) {
  const now = new Date().toISOString()
  const content = def.content[language]
  const body = templateToText({ body: content.body }, params)
  const message = appendMessage(conversation, {
    direction: "outbound",
    type: "template",
    body,
    template: {
      id: def.id,
      name: def.name,
      language,
      header: content.header ?? null,
      footer: content.footer ?? null,
    },
    status: "queued",
    error: null,
    record,
    sentBy,
    queuedAt: now,
    createdAt: now,
  })
  const target = record ?? conversation.contact
  if (target) {
    db.activities.create({
      id: newId("act"),
      workspaceId: conversation.workspaceId,
      type: "whatsapp",
      subject: def.label[language],
      body: `→ ${conversation.phone}\n${body}`,
      occurredAt: now,
      durationMinutes: null,
      direction: "outbound",
      objectKey: target.objectKey,
      recordId: target.recordId,
      createdBy: sentBy ?? "system",
      createdAt: now,
    })
  }
  return message
}

export function retryMessage(row: MessageRow) {
  const now = new Date().toISOString()
  return db.messages.update(row.id, {
    status: "queued",
    error: null,
    queuedAt: now,
  })!
}

const OPT_OUT_SUBJECT = {
  tr: "WhatsApp bildirim izni geri çekildi",
  en: "WhatsApp opt-out",
}

/** Mock of an inbound webhook message (B6.3), incl. "DUR"/"STOP". */
export function receiveInbound(
  workspaceId: string,
  {
    phone,
    text,
    profileName = null,
    at = new Date().toISOString(),
  }: { phone: string; text: string; profileName?: string | null; at?: string }
) {
  const conversation = ensureConversation(workspaceId, phone, { profileName })
  const message = appendMessage(conversation, {
    direction: "inbound",
    type: "text",
    body: text,
    template: null,
    status: "delivered",
    error: null,
    record: null,
    sentBy: null,
    queuedAt: at,
    createdAt: at,
  })
  if (isOptOutMessage(text) && conversation.contact) {
    setOptIn(workspaceId, conversation.contact, false)
    const language = db.workspaces.findById(workspaceId)?.language ?? "tr"
    db.activities.create({
      id: newId("act"),
      workspaceId,
      type: "whatsapp",
      subject: OPT_OUT_SUBJECT[language === "en" ? "en" : "tr"],
      body: text,
      occurredAt: at,
      durationMinutes: null,
      direction: "inbound",
      objectKey: conversation.contact.objectKey,
      recordId: conversation.contact.recordId,
      createdBy: "system",
      createdAt: at,
    })
  }
  return { conversation: db.conversations.findById(conversation.id)!, message }
}

/** Values of the record a template is about, for `resolveTemplateParams`. */
export function templateContext(workspaceId: string, key: RecordKey) {
  const objectDef = getObjectDef(workspaceId, key.objectKey)
  const row = findRecordRow(workspaceId, key.objectKey, key.recordId)
  if (!objectDef || !row) return null
  return {
    objectDef,
    record: toCrmRecord(objectDef, row),
    recipientName: resolveRecipient(workspaceId, key)?.contact.label ?? null,
    workspaceName: db.workspaces.findById(workspaceId)?.name ?? null,
  }
}
