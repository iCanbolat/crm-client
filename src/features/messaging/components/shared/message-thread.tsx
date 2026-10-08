import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { BotIcon, RotateCcwIcon } from "lucide-react"
import { Fragment, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/common/error-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import {
  useRetryMessage,
  useUpdateConversation,
} from "../../api/messaging.mutations"
import { messagingQueries } from "../../api/messaging.queries"
import type { Conversation, Message } from "../../api/messaging.schemas"
import { dayKey } from "../../lib/conversation"
import { MessageStatusIcon } from "./message-status"
import { TemplateBubble } from "./template-bubble"

function dayLabel(
  iso: string,
  language: string,
  t: (key: "conversation.today" | "conversation.yesterday") => string
) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (dayKey(iso) === dayKey(today.toISOString()))
    return t("conversation.today")
  if (dayKey(iso) === dayKey(yesterday.toISOString())) {
    return t("conversation.yesterday")
  }
  return formatDate(date, language, { dateStyle: "long" })
}

function MessageItem({
  message,
  conversationId,
}: {
  message: Message
  conversationId: string
}) {
  const { t } = useTranslation("messaging")
  const language = getCurrentLanguage()
  const retry = useRetryMessage(conversationId)
  const outbound = message.direction === "outbound"
  const time = formatDate(message.createdAt, language, { timeStyle: "short" })

  return (
    <li
      className={cn(
        "flex flex-col gap-1",
        outbound ? "items-end" : "items-start"
      )}
    >
      {message.template ? (
        <TemplateBubble
          header={message.template.header}
          body={message.body}
          footer={message.template.footer}
        />
      ) : (
        <p
          className={cn(
            "max-w-md rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
            outbound
              ? "rounded-tr-sm bg-emerald-50 ring-1 ring-emerald-900/10 dark:bg-emerald-950 dark:ring-emerald-100/10"
              : "rounded-tl-sm bg-muted"
          )}
        >
          {message.body}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs text-muted-foreground">
        {outbound && !message.sentBy ? (
          <span className="inline-flex items-center gap-1">
            <BotIcon aria-hidden className="size-3.5" />
            {t("conversation.automatic")} ·
          </span>
        ) : null}
        {outbound && message.sentByName ? (
          <span>{message.sentByName} ·</span>
        ) : null}
        {message.record ? (
          <Link
            to="/o/$objectKey/$recordId"
            params={{
              objectKey: message.record.objectKey,
              recordId: message.record.recordId,
            }}
            className="underline-offset-4 hover:underline"
          >
            {message.record.label} ·
          </Link>
        ) : null}
        <time dateTime={message.createdAt}>{time}</time>
        {outbound ? <MessageStatusIcon status={message.status} /> : null}
      </div>
      {message.status === "failed" ? (
        <div className="flex items-center gap-2 px-1 text-xs text-destructive">
          <span>
            {t("status.failed")}
            {message.error
              ? ` · ${t("status.errorCode", { code: message.error.code })}`
              : null}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => retry.mutate(message.id)}
            disabled={retry.isPending}
          >
            <RotateCcwIcon data-icon="inline-start" aria-hidden />
            {t("status.retry")}
          </Button>
        </div>
      ) : null}
    </li>
  )
}

/** Messages of a conversation, newest at the bottom (B6.3). */
export function MessageThread({
  conversation,
  className,
}: {
  conversation: Conversation
  className?: string
}) {
  const { t } = useTranslation("messaging")
  const language = getCurrentLanguage()
  const messages = useQuery(messagingQueries.messages(conversation.id))
  const markRead = useUpdateConversation(conversation.id)
  const endRef = useRef<HTMLLIElement>(null)
  const count = messages.data?.length ?? 0

  // Opening a conversation reads it.
  const unread = conversation.unreadCount > 0
  const { mutate: markAsRead } = markRead
  useEffect(() => {
    if (unread) markAsRead({ read: true })
  }, [unread, conversation.id, markAsRead])

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" })
  }, [count])

  if (messages.isPending) {
    return (
      <div className={cn("flex flex-col gap-3 p-4", className)} aria-busy>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={index}
            className={cn("h-10 w-2/3", index % 2 ? "self-end" : "")}
          />
        ))}
      </div>
    )
  }
  if (messages.isError) {
    return (
      <ErrorState
        className={cn("m-4", className)}
        error={messages.error}
        onRetry={() => void messages.refetch()}
      />
    )
  }

  return (
    <ol
      aria-label={t("conversation.messages")}
      className={cn("flex flex-col gap-3 overflow-y-auto p-4", className)}
    >
      {messages.data.map((message, index) => {
        const previous = messages.data[index - 1]
        const newDay =
          !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
        return (
          <Fragment key={message.id}>
            {newDay ? (
              <li
                aria-hidden
                className="self-center rounded-full bg-muted px-3 py-0.5 text-xs text-foreground"
              >
                {dayLabel(message.createdAt, language, t)}
              </li>
            ) : null}
            <MessageItem message={message} conversationId={conversation.id} />
          </Fragment>
        )
      })}
      <li ref={endRef} aria-hidden />
    </ol>
  )
}
