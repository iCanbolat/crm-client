import { z } from "zod"

import { apiClient } from "@/lib/api"

import {
  channelStatusSchema,
  conversationListSchema,
  conversationSchema,
  dispatchListSchema,
  inboxSummarySchema,
  messageListSchema,
  messageSchema,
  messageTemplateListSchema,
  phoneNumberInfoSchema,
  recordLinkSchema,
  recordConversationSchema,
  whatsappChannelSchema,
  type ConnectChannelInput,
  type ConversationPatch,
  type ConversationQuery,
  type SendMessageInput,
} from "./messaging.schemas"

/* ------------------------------------------------------------------ channel */

export function fetchChannel(signal?: AbortSignal) {
  return apiClient.get("/channels/whatsapp", {
    signal,
    schema: whatsappChannelSchema,
  })
}

export function fetchChannelStatus(signal?: AbortSignal) {
  return apiClient.get("/channels/whatsapp/status", {
    signal,
    schema: channelStatusSchema,
  })
}

export function verifyChannel(input: ConnectChannelInput) {
  return apiClient.post("/channels/whatsapp/verify", {
    body: input,
    schema: phoneNumberInfoSchema,
  })
}

export function connectChannel(input: ConnectChannelInput) {
  return apiClient.put("/channels/whatsapp", {
    body: input,
    schema: whatsappChannelSchema,
  })
}

export function disconnectChannel() {
  return apiClient.delete("/channels/whatsapp")
}

export function updateTriggers(triggers: Record<string, boolean>) {
  return apiClient.patch("/channels/whatsapp/triggers", {
    body: { triggers },
    schema: whatsappChannelSchema,
  })
}

export function fetchDispatches(signal?: AbortSignal) {
  return apiClient
    .get("/channels/whatsapp/dispatches", {
      signal,
      schema: dispatchListSchema,
    })
    .then((response) => response.data)
}

/* ---------------------------------------------------------------- templates */

export function fetchTemplates(signal?: AbortSignal) {
  return apiClient
    .get("/channels/whatsapp/templates", {
      signal,
      schema: messageTemplateListSchema,
    })
    .then((response) => response.data)
}

export function syncTemplates() {
  return apiClient
    .post("/channels/whatsapp/templates/sync", {
      schema: messageTemplateListSchema,
    })
    .then((response) => response.data)
}

const resolvedParamsSchema = z.object({
  params: z.array(z.string()),
  missing: z.array(z.number().int()),
})

export function fetchTemplateParams(
  templateId: string,
  language: string,
  record: { objectKey: string; recordId: string } | null,
  conversationId: string | null,
  signal?: AbortSignal
) {
  return apiClient.get(`/channels/whatsapp/templates/${templateId}/params`, {
    signal,
    query: {
      language,
      ...(record ?? {}),
      ...(conversationId ? { conversationId } : {}),
    },
    schema: resolvedParamsSchema,
  })
}

export function fetchConversationRecords(
  conversationId: string,
  objectKey: string,
  signal?: AbortSignal
) {
  return apiClient
    .get(`/conversations/${conversationId}/records`, {
      signal,
      query: { objectKey },
      schema: z.object({ data: z.array(recordLinkSchema) }),
    })
    .then((response) => response.data)
}

/* ------------------------------------------------------------ conversations */

export function fetchConversations(
  query: ConversationQuery,
  signal?: AbortSignal
) {
  return apiClient.get("/conversations", {
    signal,
    query: {
      status: query.status,
      assignee: query.assignee,
      ...(query.unread ? { unread: "true" } : {}),
      ...(query.q ? { q: query.q } : {}),
      pageSize: 100,
    },
    schema: conversationListSchema,
  })
}

export function fetchInboxSummary(signal?: AbortSignal) {
  return apiClient.get("/conversations/summary", {
    signal,
    schema: inboxSummarySchema,
  })
}

export function fetchConversation(id: string, signal?: AbortSignal) {
  return apiClient.get(`/conversations/${id}`, {
    signal,
    schema: conversationSchema,
  })
}

export function startConversation(record: {
  objectKey: string
  recordId: string
}) {
  return apiClient.post("/conversations", {
    body: record,
    schema: conversationSchema,
  })
}

export function updateConversation(id: string, patch: ConversationPatch) {
  return apiClient.patch(`/conversations/${id}`, {
    body: patch,
    schema: conversationSchema,
  })
}

export function fetchMessages(id: string, signal?: AbortSignal) {
  return apiClient
    .get(`/conversations/${id}/messages`, { signal, schema: messageListSchema })
    .then((response) => response.data)
}

export function sendMessage(id: string, input: SendMessageInput) {
  return apiClient.post(`/conversations/${id}/messages`, {
    body: input,
    schema: messageSchema,
  })
}

export function retryMessage(id: string) {
  return apiClient.post(`/messages/${id}/retry`, { schema: messageSchema })
}

export function fetchRecordConversation(
  objectKey: string,
  recordId: string,
  signal?: AbortSignal
) {
  return apiClient.get(`/records/${objectKey}/${recordId}/conversation`, {
    signal,
    schema: recordConversationSchema,
  })
}
