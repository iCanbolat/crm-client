import { queryOptions } from "@tanstack/react-query"

import {
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
} from "./messaging.api"
import { messagingKeys } from "./messaging.keys"
import type { ConversationQuery } from "./messaging.schemas"

/**
 * Polling until the backend pushes events (WebSocket later): the open
 * conversation refreshes fastest, lists and the unread badge slower.
 */
export const MESSAGING_POLL_MS = {
  messages: 3_000,
  conversations: 8_000,
  summary: 15_000,
  /** While a template waits for Meta's review. */
  templates: 1_000,
} as const

export const messagingQueries = {
  channel: () =>
    queryOptions({
      queryKey: messagingKeys.channel(),
      queryFn: ({ signal }) => fetchChannel(signal),
    }),
  status: () =>
    queryOptions({
      queryKey: messagingKeys.status(),
      // Shell, inbox and record tabs share it: no abort on unmount.
      queryFn: () => fetchChannelStatus(),
      staleTime: 30_000,
    }),
  templates: () =>
    queryOptions({
      queryKey: messagingKeys.templates(),
      queryFn: ({ signal }) => fetchTemplates(signal),
      refetchInterval: (query) =>
        query.state.data?.some((template) =>
          template.submissions.some((item) => item.status === "pending")
        )
          ? MESSAGING_POLL_MS.templates
          : false,
    }),
  templateParams: (
    templateId: string,
    language: string,
    record: { objectKey: string; recordId: string } | null,
    conversationId: string | null
  ) =>
    queryOptions({
      queryKey: messagingKeys.templateParams(
        templateId,
        language,
        record,
        conversationId
      ),
      queryFn: ({ signal }) =>
        fetchTemplateParams(
          templateId,
          language,
          record,
          conversationId,
          signal
        ),
    }),
  conversationRecords: (conversationId: string, objectKey: string) =>
    queryOptions({
      queryKey: messagingKeys.conversationRecords(conversationId, objectKey),
      queryFn: ({ signal }) =>
        fetchConversationRecords(conversationId, objectKey, signal),
    }),
  dispatches: () =>
    queryOptions({
      queryKey: messagingKeys.dispatches(),
      queryFn: ({ signal }) => fetchDispatches(signal),
    }),
  conversations: (query: ConversationQuery) =>
    queryOptions({
      queryKey: messagingKeys.conversationList(query),
      queryFn: ({ signal }) => fetchConversations(query, signal),
      refetchInterval: MESSAGING_POLL_MS.conversations,
    }),
  summary: () =>
    queryOptions({
      queryKey: messagingKeys.summary(),
      queryFn: () => fetchInboxSummary(),
      refetchInterval: MESSAGING_POLL_MS.summary,
    }),
  conversation: (id: string) =>
    queryOptions({
      queryKey: messagingKeys.conversation(id),
      queryFn: ({ signal }) => fetchConversation(id, signal),
      refetchInterval: MESSAGING_POLL_MS.messages,
    }),
  messages: (id: string) =>
    queryOptions({
      queryKey: messagingKeys.messages(id),
      queryFn: ({ signal }) => fetchMessages(id, signal),
      refetchInterval: MESSAGING_POLL_MS.messages,
    }),
  recordConversation: (objectKey: string, recordId: string) =>
    queryOptions({
      queryKey: messagingKeys.recordConversation(objectKey, recordId),
      queryFn: ({ signal }) =>
        fetchRecordConversation(objectKey, recordId, signal),
    }),
}
