import type { ConversationQuery } from "./messaging.schemas"

export const messagingKeys = {
  all: ["messaging"] as const,
  channel: () => [...messagingKeys.all, "channel"] as const,
  status: () => [...messagingKeys.all, "status"] as const,
  templates: () => [...messagingKeys.all, "templates"] as const,
  templateParams: (
    templateId: string,
    language: string,
    record: { objectKey: string; recordId: string } | null,
    conversationId: string | null
  ) =>
    [
      ...messagingKeys.templates(),
      "params",
      templateId,
      language,
      record?.objectKey ?? null,
      record?.recordId ?? null,
      conversationId,
    ] as const,
  dispatches: () => [...messagingKeys.all, "dispatches"] as const,
  conversations: () => [...messagingKeys.all, "conversations"] as const,
  conversationList: (query: ConversationQuery) =>
    [...messagingKeys.conversations(), "list", query] as const,
  summary: () => [...messagingKeys.conversations(), "summary"] as const,
  conversation: (id: string) =>
    [...messagingKeys.conversations(), "detail", id] as const,
  messages: (id: string) =>
    [...messagingKeys.conversations(), "messages", id] as const,
  conversationRecords: (id: string, objectKey: string) =>
    [...messagingKeys.conversations(), "records", id, objectKey] as const,
  recordConversation: (objectKey: string, recordId: string) =>
    [...messagingKeys.conversations(), "record", objectKey, recordId] as const,
}
