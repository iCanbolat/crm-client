import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import {
  connectChannel,
  disconnectChannel,
  retryMessage,
  sendMessage,
  startConversation,
  syncTemplates,
  updateConversation,
  updateTriggers,
  verifyChannel,
} from "./messaging.api"
import { messagingKeys } from "./messaging.keys"
import type {
  ConversationPatch,
  Message,
  SendMessageInput,
  WhatsappChannel,
} from "./messaging.schemas"

export function useVerifyChannel() {
  return useMutation({
    mutationFn: verifyChannel,
    // The form shows Meta's answer next to the fields.
    meta: { suppressErrorToast: true },
  })
}

export function useConnectChannel() {
  const { t } = useTranslation("messaging")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: connectChannel,
    meta: { successMessage: t("toast.connected") },
    onSuccess: (channel) => {
      queryClient.setQueryData(messagingKeys.channel(), channel)
      void queryClient.invalidateQueries({ queryKey: messagingKeys.status() })
      void queryClient.invalidateQueries({
        queryKey: messagingKeys.templates(),
      })
    },
  })
}

export function useDisconnectChannel() {
  const { t } = useTranslation("messaging")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: disconnectChannel,
    meta: { successMessage: t("toast.disconnected") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: messagingKeys.all }),
  })
}

export function useUpdateTriggers() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTriggers,
    onMutate: async (triggers) => {
      await queryClient.cancelQueries({ queryKey: messagingKeys.channel() })
      const previous = queryClient.getQueryData<WhatsappChannel>(
        messagingKeys.channel()
      )
      if (previous) {
        queryClient.setQueryData(messagingKeys.channel(), {
          ...previous,
          triggers: { ...previous.triggers, ...triggers },
        })
      }
      return { previous }
    },
    onError: (_error, _triggers, context) => {
      if (context?.previous) {
        queryClient.setQueryData(messagingKeys.channel(), context.previous)
      }
    },
    onSuccess: (channel) =>
      queryClient.setQueryData(messagingKeys.channel(), channel),
  })
}

export function useSyncTemplates() {
  const { t } = useTranslation("messaging")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: syncTemplates,
    meta: { successMessage: t("toast.synced") },
    onSuccess: (templates) =>
      queryClient.setQueryData(messagingKeys.templates(), templates),
  })
}

/** Conversation lists, badge and record tabs follow every change. */
function useInvalidateConversations() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: messagingKeys.conversations() })
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateConversations()

  return useMutation({
    mutationFn: (input: SendMessageInput) => sendMessage(conversationId, input),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(
        messagingKeys.messages(conversationId),
        (messages) => (messages ? [...messages, message] : [message])
      )
      void invalidate()
    },
  })
}

export function useRetryMessage(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: retryMessage,
    onSuccess: (message) =>
      queryClient.setQueryData<Message[]>(
        messagingKeys.messages(conversationId),
        (messages) =>
          messages?.map((item) => (item.id === message.id ? message : item))
      ),
  })
}

export function useUpdateConversation(conversationId: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateConversations()

  return useMutation({
    mutationFn: (patch: ConversationPatch) =>
      updateConversation(conversationId, patch),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        messagingKeys.conversation(conversationId),
        conversation
      )
      void invalidate()
    },
  })
}

export function useStartConversation() {
  const invalidate = useInvalidateConversations()

  return useMutation({
    mutationFn: startConversation,
    onSuccess: () => void invalidate(),
  })
}
