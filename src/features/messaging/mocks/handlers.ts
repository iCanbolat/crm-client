import { http, HttpResponse } from "msw"
import { z } from "zod"

import {
  fromWaId,
  isValidTemplateParam,
  OPT_IN_AT_FIELD,
  OPT_IN_FIELD,
  resolveTemplateParams,
} from "@/engine/messaging"
import type { RecordHook } from "@/features/records/mocks/store"
import {
  findRecordRow,
  onRecordSaved,
  recordsOf,
  registerRecordHook,
} from "@/features/records/mocks/store"
import type { FieldErrors } from "@/lib/api"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { emitMockEvent } from "@/mocks/events"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"
import { paginate } from "@/mocks/utils/list"

import {
  connectChannelInputSchema,
  conversationPatchSchema,
  inboxSearchSchema,
  sendMessageInputSchema,
  updateTriggersInputSchema,
} from "../api/messaging.schemas"
import { dispatchMessageEvent } from "./dispatch"
import {
  canSendText,
  channelOf,
  connectChannel,
  disconnectChannel,
  ensureConversation,
  findConversation,
  findMessage,
  findTemplateDef,
  isVisibleTo,
  listConversations,
  listTemplates,
  messagesOf,
  receiveInbound,
  resolveRecipient,
  retryMessage,
  sendTemplate,
  sendText,
  settingsOf,
  syncTemplates,
  templateContext,
  templateStatusOf,
  toChannel,
  toConversation,
  toMessage,
  unreadCountOf,
  verifyCredentials,
} from "./store"

type RequestT = ReturnType<typeof getRequestT>

const flatten = (error: z.ZodError) =>
  z.flattenError(error).fieldErrors as FieldErrors

const readJson = async (request: Request) => {
  try {
    return (await request.json()) as unknown
  } catch {
    return {}
  }
}

const validation = (t: RequestT, fieldErrors: FieldErrors) =>
  apiError(422, "VALIDATION_ERROR", t("validation"), { fieldErrors })

const notConnected = (t: RequestT) =>
  apiError(409, "WA_NOT_CONNECTED", t("mock.waNotConnected"))

function credentialError(
  t: RequestT,
  error: ReturnType<typeof verifyCredentials> & { ok: false }
) {
  const message = t(
    error.error.code === "WA_INVALID_TOKEN"
      ? "mock.waInvalidToken"
      : error.error.code === "WA_PHONE_NOT_FOUND"
        ? "mock.waPhoneNotFound"
        : "mock.waTokenRequired"
  )
  return apiError(422, error.error.code, message, {
    fieldErrors: { [error.error.field]: [message] },
    details: { metaCode: error.error.metaCode },
  })
}

/** Conversation the caller may see (agents: theirs or unassigned). */
function resolveConversation(
  request: Request,
  workspaceId: string,
  subject: Parameters<typeof isVisibleTo>[1],
  id: string
) {
  const row = findConversation(workspaceId, id)
  if (!row || !isVisibleTo(row, subject)) {
    return {
      response: apiError(
        404,
        "NOT_FOUND",
        getRequestT(request)("mock.notFound")
      ),
    }
  }
  return { row }
}

/** Keeps the consent date in step with the WhatsApp opt-in flag. */
const optInHook: RecordHook = (values, { previous }) => {
  const optIn = values[OPT_IN_FIELD] === true
  if (!optIn) return { ...values, [OPT_IN_AT_FIELD]: null }
  if (previous?.[OPT_IN_FIELD] === true) return values
  return { ...values, [OPT_IN_AT_FIELD]: new Date().toISOString() }
}
registerRecordHook("contact", optInHook)
registerRecordHook("lead", optInHook)

// `<object>.created` events (e.g. a freight request from a web form).
onRecordSaved(({ workspaceId, objectKey, row, previous }) => {
  if (previous) return
  const source = row.values.source
  dispatchMessageEvent(workspaceId, {
    type: `${objectKey}.created`,
    objectKey,
    recordId: row.id,
    data: typeof source === "string" ? { source } : {},
  })
})

/** WhatsApp channel, templates and inbox (Faz 6). */
export const messagingHandlers = [
  /* ------------------------------------------------------------- channel */

  http.get(
    apiPath("/channels/whatsapp"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "channel")
      if (denied) return denied
      return HttpResponse.json(toChannel(auth.context.workspace.id))
    })
  ),

  http.get(
    apiPath("/channels/whatsapp/status"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "conversation")
      if (denied) return denied
      const row = channelOf(auth.context.workspace.id)
      return HttpResponse.json({
        connected: !!row,
        displayPhoneNumber: row?.displayPhoneNumber ?? null,
      })
    })
  ),

  http.post(
    apiPath("/channels/whatsapp/verify"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "channel")
      if (denied) return denied
      const t = getRequestT(request)
      const parsed = connectChannelInputSchema.safeParse(
        await readJson(request)
      )
      if (!parsed.success) return validation(t, flatten(parsed.error))
      const result = verifyCredentials(auth.context.workspace.id, parsed.data)
      if (!result.ok) return credentialError(t, result)
      return HttpResponse.json(result.info)
    })
  ),

  http.put(
    apiPath("/channels/whatsapp"),
    withScenario(
      async ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "manage", "channel")
        if (denied) return denied
        const t = getRequestT(request)
        const workspaceId = auth.context.workspace.id
        const parsed = connectChannelInputSchema.safeParse(
          await readJson(request)
        )
        if (!parsed.success) return validation(t, flatten(parsed.error))
        const result = verifyCredentials(workspaceId, parsed.data)
        if (!result.ok) return credentialError(t, result)
        connectChannel(workspaceId, parsed.data, result.info)
        return HttpResponse.json(toChannel(workspaceId))
      },
      { validationErrors: (t) => ({ accessToken: [t("mock.waInvalidToken")] }) }
    )
  ),

  http.delete(
    apiPath("/channels/whatsapp"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "channel")
      if (denied) return denied
      disconnectChannel(auth.context.workspace.id)
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.patch(
    apiPath("/channels/whatsapp/triggers"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "channel")
      if (denied) return denied
      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const parsed = updateTriggersInputSchema.safeParse(
        await readJson(request)
      )
      if (!parsed.success) return validation(t, flatten(parsed.error))
      const settings = settingsOf(workspaceId)
      db.waSettings.update(settings.id, {
        triggers: { ...settings.triggers, ...parsed.data.triggers },
      })
      return HttpResponse.json(toChannel(workspaceId))
    })
  ),

  http.get(
    apiPath("/channels/whatsapp/dispatches"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "channel")
      if (denied) return denied
      const workspaceId = auth.context.workspace.id
      const data = db.messageDispatches
        .findMany((row) => row.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 100)
        .flatMap((row) => {
          const link = toConversationRecord(workspaceId, row.record)
          return link
            ? [
                {
                  id: row.id,
                  triggerId: row.triggerId,
                  templateId: row.templateId,
                  record: link,
                  status: row.status,
                  reason: row.reason,
                  conversationId: row.conversationId,
                  createdAt: row.createdAt,
                },
              ]
            : []
        })
      return HttpResponse.json({ data })
    })
  ),

  /* ----------------------------------------------------------- templates */

  http.get(
    apiPath("/channels/whatsapp/templates"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "conversation")
      if (denied) return denied
      return HttpResponse.json({
        data: listTemplates(auth.context.workspace.id),
      })
    })
  ),

  http.post(
    apiPath("/channels/whatsapp/templates/sync"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "channel")
      if (denied) return denied
      const workspaceId = auth.context.workspace.id
      if (!channelOf(workspaceId)) return notConnected(getRequestT(request))
      syncTemplates(workspaceId)
      return HttpResponse.json({ data: listTemplates(workspaceId) })
    })
  ),

  // Templates are managed by the platform per sector (TC-6.2-05).
  ...(["post", "put", "patch", "delete"] as const).map((method) =>
    http[method](apiPath("/channels/whatsapp/templates/:id"), ({ request }) =>
      apiError(
        405,
        "TEMPLATE_MANAGED",
        getRequestT(request)("mock.templateManaged")
      )
    )
  ),

  /* -------------------------------------------------------- conversations */

  http.get(
    apiPath("/conversations/summary"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "conversation")
      if (denied) return denied
      return HttpResponse.json({
        unread: unreadCountOf(auth.context.workspace.id, auth.context.subject),
      })
    })
  ),

  http.get(
    apiPath("/conversations"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "read", "conversation")
        if (denied) return denied
        const url = new URL(request.url)
        const params = url.searchParams
        const query = inboxSearchSchema.parse({
          status: params.get("status") ?? undefined,
          assignee: params.get("assignee") ?? undefined,
          unread: params.get("unread") === "true",
          q: params.get("q") ?? undefined,
        })
        const items = listConversations(
          auth.context.workspace.id,
          auth.context.subject,
          query
        )
        const page = Math.max(1, Number(params.get("page")) || 1)
        const pageSize = Math.min(100, Number(params.get("pageSize")) || 50)
        return HttpResponse.json(paginate(items, page, pageSize))
      },
      {
        empty: () =>
          HttpResponse.json({
            data: [],
            meta: { page: 1, pageSize: 50, total: 0 },
          }),
      }
    )
  ),

  // Start (or reopen) the conversation with a record's recipient (B6.4).
  http.post(
    apiPath("/conversations"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "create", "conversation")
      if (denied) return denied
      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const parsed = z
        .object({ objectKey: z.string(), recordId: z.string() })
        .safeParse(await readJson(request))
      if (!parsed.success) return validation(t, flatten(parsed.error))
      if (!channelOf(workspaceId)) return notConnected(t)
      const recipient = resolveRecipient(workspaceId, parsed.data)
      if (!recipient)
        return apiError(422, "NO_RECIPIENT", t("mock.noRecipient"))
      if (!recipient.phone) return apiError(422, "NO_PHONE", t("mock.noPhone"))
      const row = ensureConversation(workspaceId, recipient.phone, {
        contact: {
          objectKey: recipient.contact.objectKey,
          recordId: recipient.contact.recordId,
        },
      })
      return HttpResponse.json(toConversation(row), { status: 201 })
    })
  ),

  http.get(
    apiPath("/conversations/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "conversation")
      if (denied) return denied
      const resolved = resolveConversation(
        request,
        auth.context.workspace.id,
        auth.context.subject,
        String(params.id)
      )
      if ("response" in resolved) return resolved.response
      return HttpResponse.json(toConversation(resolved.row))
    })
  ),

  http.patch(
    apiPath("/conversations/:id"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const { subject, workspace } = auth.context
      const t = getRequestT(request)
      const resolved = resolveConversation(
        request,
        workspace.id,
        subject,
        String(params.id)
      )
      if ("response" in resolved) return resolved.response
      const parsed = conversationPatchSchema.safeParse(await readJson(request))
      if (!parsed.success) return validation(t, flatten(parsed.error))
      const patch = parsed.data
      const needsUpdate =
        patch.assigneeId !== undefined ||
        patch.status !== undefined ||
        patch.contact !== undefined
      const denied = authorize(
        request,
        auth.context,
        needsUpdate ? "update" : "read",
        "conversation"
      )
      if (denied) return denied
      if (patch.assigneeId !== undefined) {
        // Assigning to someone else is a manager's call; agents take or release.
        const self =
          patch.assigneeId === null || patch.assigneeId === subject.userId
        if (!self) {
          const forbidden = authorize(
            request,
            auth.context,
            "manage",
            "conversation"
          )
          if (forbidden) return forbidden
          const member = db.memberships.findFirst(
            (item) =>
              item.workspaceId === workspace.id &&
              item.userId === patch.assigneeId &&
              item.role !== "viewer"
          )
          if (!member)
            return validation(t, { assigneeId: [t("mock.invalidUser")] })
        }
      }
      if (
        patch.contact &&
        !findRecordRow(
          workspace.id,
          patch.contact.objectKey,
          patch.contact.recordId
        )
      ) {
        return validation(t, { contact: [t("mock.invalidRelation")] })
      }
      const updated = db.conversations.update(resolved.row.id, {
        ...(patch.contact ? { contact: patch.contact } : {}),
        ...(patch.assigneeId !== undefined
          ? { assigneeId: patch.assigneeId }
          : {}),
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.read ? { unreadCount: 0 } : {}),
      })!
      return HttpResponse.json(toConversation(updated))
    })
  ),

  http.get(
    apiPath("/conversations/:id/messages"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "conversation")
      if (denied) return denied
      const resolved = resolveConversation(
        request,
        auth.context.workspace.id,
        auth.context.subject,
        String(params.id)
      )
      if ("response" in resolved) return resolved.response
      return HttpResponse.json({
        data: messagesOf(resolved.row).slice(-200).map(toMessage),
      })
    })
  ),

  http.post(
    apiPath("/conversations/:id/messages"),
    withScenario(
      async ({ request, params }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(
          request,
          auth.context,
          "create",
          "conversation"
        )
        if (denied) return denied
        const t = getRequestT(request)
        const workspaceId = auth.context.workspace.id
        const resolved = resolveConversation(
          request,
          workspaceId,
          auth.context.subject,
          String(params.id)
        )
        if ("response" in resolved) return resolved.response
        const conversation = resolved.row
        if (!channelOf(workspaceId)) return notConnected(t)
        const parsed = sendMessageInputSchema.safeParse(await readJson(request))
        if (!parsed.success) return validation(t, flatten(parsed.error))
        const input = parsed.data

        if (input.type === "text") {
          if (!canSendText(conversation)) {
            return apiError(422, "WINDOW_CLOSED", t("mock.windowClosed"), {
              details: { metaCode: 131047 },
            })
          }
          const message = sendText(
            conversation,
            input.body,
            auth.context.user.id
          )
          return HttpResponse.json(toMessage(message), { status: 201 })
        }

        const def = findTemplateDef(workspaceId, input.templateId)
        if (
          !def ||
          templateStatusOf(workspaceId, def, input.language) !== "approved"
        ) {
          return apiError(
            422,
            "TEMPLATE_NOT_APPROVED",
            t("mock.templateNotApproved")
          )
        }
        if (input.record && input.record.objectKey !== def.objectKey) {
          return validation(t, { record: [t("mock.invalidRelation")] })
        }
        // Utility templates need consent of the person they go to.
        const person = input.record
          ? resolveRecipient(workspaceId, input.record)
          : null
        const optIn = person
          ? person.phone === conversation.phone && person.optIn
          : toConversation(conversation).optIn
        if (!optIn) return apiError(422, "NO_OPT_IN", t("mock.noOptIn"))
        if (input.params.length !== def.variables.length) {
          return validation(t, { params: [t("mock.invalidTemplateParams")] })
        }
        const invalid = input.params.flatMap((value, index) =>
          isValidTemplateParam(value) ? [] : [index]
        )
        if (invalid.length) {
          return validation(
            t,
            Object.fromEntries(
              invalid.map((index) => [
                `params.${index}`,
                [t("mock.invalidTemplateParams")],
              ])
            )
          )
        }
        const message = sendTemplate({
          conversation,
          def,
          language: input.language,
          params: input.params,
          record: input.record,
          sentBy: auth.context.user.id,
        })
        return HttpResponse.json(toMessage(message), { status: 201 })
      },
      { validationErrors: (t) => ({ body: [t("mock.windowClosed")] }) }
    )
  ),

  http.post(
    apiPath("/messages/:id/retry"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "create", "conversation")
      if (denied) return denied
      const t = getRequestT(request)
      const row = findMessage(auth.context.workspace.id, String(params.id))
      if (!row) return apiError(404, "NOT_FOUND", t("mock.notFound"))
      if (row.status !== "failed") {
        return apiError(409, "INVALID_TRANSITION", t("mock.invalidTransition"))
      }
      return HttpResponse.json(toMessage(retryMessage(row)))
    })
  ),

  // Records of an object whose messages go to this conversation's number
  // (e.g. the customer's shipments), newest first — template context.
  http.get(
    apiPath("/conversations/:id/records"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "conversation")
      if (denied) return denied
      const workspaceId = auth.context.workspace.id
      const resolved = resolveConversation(
        request,
        workspaceId,
        auth.context.subject,
        String(params.id)
      )
      if ("response" in resolved) return resolved.response
      const objectKey = new URL(request.url).searchParams.get("objectKey") ?? ""
      const data = recordsOf(workspaceId, objectKey)
        .sort((a, b) =>
          String(b.values.createdAt).localeCompare(String(a.values.createdAt))
        )
        .filter(
          (row) =>
            resolveRecipient(workspaceId, { objectKey, recordId: row.id })
              ?.phone === resolved.row.phone
        )
        .slice(0, 20)
        .flatMap((row) => {
          const link = toConversationRecord(workspaceId, {
            objectKey,
            recordId: row.id,
          })
          return link ? [link] : []
        })
      return HttpResponse.json({ data })
    })
  ),

  // Record tab (B6.4): who receives the record's messages + their thread.
  http.get(
    apiPath("/records/:objectKey/:id/conversation"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "conversation")
      if (denied) return denied
      const workspaceId = auth.context.workspace.id
      const recipient = resolveRecipient(workspaceId, {
        objectKey: String(params.objectKey),
        recordId: String(params.id),
      })
      const row = recipient?.phone
        ? db.conversations.findFirst(
            (item) =>
              item.workspaceId === workspaceId && item.phone === recipient.phone
          )
        : undefined
      const visible = row && isVisibleTo(row, auth.context.subject) ? row : null
      return HttpResponse.json({
        recipient: recipient
          ? {
              contact: recipient.contact,
              phone: recipient.phone,
              optIn: recipient.optIn,
            }
          : null,
        conversation: visible ? toConversation(visible) : null,
      })
    })
  ),

  // Template variables of a record, prefilled in the send dialog (B6.4).
  http.get(
    apiPath("/channels/whatsapp/templates/:id/params"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "conversation")
      if (denied) return denied
      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const url = new URL(request.url)
      const def = findTemplateDef(workspaceId, String(params.id))
      if (!def) return apiError(404, "NOT_FOUND", t("mock.notFound"))
      const language = url.searchParams.get("language") === "en" ? "en" : "tr"
      const objectKey = url.searchParams.get("objectKey")
      const recordId = url.searchParams.get("recordId")
      const conversationId = url.searchParams.get("conversationId")
      const conversation = conversationId
        ? findConversation(workspaceId, conversationId)
        : undefined
      // Without a record only the person and the company are known.
      const context =
        objectKey && recordId
          ? templateContext(workspaceId, { objectKey, recordId })
          : null
      const fallback = {
        recipientName: conversation
          ? (toConversation(conversation).contact?.label ??
            conversation.profileName)
          : null,
        workspaceName: auth.context.workspace.name,
      }
      return HttpResponse.json(
        resolveTemplateParams(def, context ?? fallback, language)
      )
    })
  ),

  /* -------------------------------------------------------------- webhook */

  // Meta's subscription check (hub.challenge echo).
  http.get(
    apiPath("/webhooks/whatsapp/:workspaceId"),
    ({ params, request }) => {
      const url = new URL(request.url)
      const settings = db.waSettings.findById(
        `was_${String(params.workspaceId)}`
      )
      if (
        url.searchParams.get("hub.mode") === "subscribe" &&
        settings &&
        url.searchParams.get("hub.verify_token") === settings.verifyToken
      ) {
        return new HttpResponse(url.searchParams.get("hub.challenge") ?? "")
      }
      return new HttpResponse(null, { status: 403 })
    }
  ),

  // Inbound messages and status updates in Meta's payload shape.
  http.post(
    apiPath("/webhooks/whatsapp/:workspaceId"),
    async ({ params, request }) => {
      const workspaceId = String(params.workspaceId)
      const parsed = webhookPayloadSchema.safeParse(await readJson(request))
      if (!parsed.success || !channelOf(workspaceId)) {
        return new HttpResponse(null, { status: 200 })
      }
      for (const entry of parsed.data.entry) {
        for (const change of entry.changes) {
          const { contacts = [], messages = [] } = change.value
          for (const message of messages) {
            const profile = contacts.find((item) => item.wa_id === message.from)
            const { conversation } = receiveInbound(workspaceId, {
              phone: fromWaId(message.from),
              text: message.text?.body ?? `[${message.type}]`,
              profileName: profile?.profile.name ?? null,
              at: new Date(Number(message.timestamp) * 1000).toISOString(),
            })
            emitMockEvent({
              workspaceId,
              type: "conversation.inbound",
              objectKey: "conversation",
              recordId: conversation.id,
              actorId: null,
            })
          }
        }
      }
      // Meta only needs a fast 200.
      return new HttpResponse(null, { status: 200 })
    }
  ),
]

const webhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            contacts: z
              .array(
                z.object({
                  wa_id: z.string(),
                  profile: z.object({ name: z.string() }),
                })
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string(),
                  timestamp: z.string(),
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                })
              )
              .optional(),
          }),
        })
      ),
    })
  ),
})

function toConversationRecord(
  workspaceId: string,
  key: { objectKey: string; recordId: string }
) {
  const context = templateContext(workspaceId, key)
  if (!context) return null
  return {
    ...key,
    label: String(
      context.record.values[context.objectDef.primaryField] ?? key.recordId
    ),
  }
}
