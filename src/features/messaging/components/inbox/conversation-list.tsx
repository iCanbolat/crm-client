import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { SearchInput } from "@/components/common/search-input"
import { UserAvatar } from "@/components/common/user-avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Toggle } from "@/components/ui/toggle"
import { formatRelativeTime } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { messagingQueries } from "../../api/messaging.queries"
import {
  ASSIGNEE_FILTERS,
  CONVERSATION_FILTERS,
  INBOX_SEARCH_DEFAULTS,
  type Conversation,
  type InboxSearch,
} from "../../api/messaging.schemas"
import { conversationTitle } from "../../lib/conversation"

interface ConversationListProps {
  search: InboxSearch
  onSearchChange: (patch: Partial<InboxSearch>) => void
  className?: string
}

function ConversationItem({
  conversation,
  active,
  onOpen,
}: {
  conversation: Conversation
  active: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation("messaging")
  const language = getCurrentLanguage()
  const title = conversationTitle(conversation)
  const unread = conversation.unreadCount > 0
  return (
    <li>
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={onOpen}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
          active && "bg-muted [&_.text-muted-foreground]:text-foreground/75"
        )}
      >
        <UserAvatar name={title} className="mt-0.5 size-9" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                unread ? "font-semibold" : "font-medium"
              )}
            >
              {title}
            </span>
            <time
              dateTime={conversation.lastMessageAt}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {formatRelativeTime(conversation.lastMessageAt, language)}
            </time>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-xs",
                unread ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {conversation.lastMessageDirection === "outbound"
                ? t("inbox.you")
                : null}
              {conversation.lastMessagePreview}
            </span>
            {unread ? (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                <span aria-hidden>{conversation.unreadCount}</span>
                <span className="sr-only">
                  {t("inbox.unreadCount", { count: conversation.unreadCount })}
                </span>
              </span>
            ) : null}
          </span>
          {conversation.assigneeName ? (
            <span className="truncate text-xs text-muted-foreground">
              {conversation.assigneeName}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

/** Left pane of the inbox (B6.3): filters in the URL, polling list. */
export function ConversationList({
  search,
  onSearchChange,
  className,
}: ConversationListProps) {
  const { t } = useTranslation("messaging")
  const { c: activeId, ...query } = search
  const list = useQuery(messagingQueries.conversations(query))
  const filtered =
    query.status !== INBOX_SEARCH_DEFAULTS.status ||
    query.assignee !== INBOX_SEARCH_DEFAULTS.assignee ||
    query.unread ||
    !!query.q

  const statusItems = CONVERSATION_FILTERS.map((value) => ({
    value,
    label: t(`inbox.filters.${value}`),
  }))
  const assigneeItems = ASSIGNEE_FILTERS.map((value) => ({
    value,
    label: t(
      value === "all" ? "inbox.filters.assigneeAll" : `inbox.filters.${value}`
    ),
  }))

  return (
    <section
      aria-label={t("inbox.listLabel")}
      className={cn("min-h-0 flex-col border-e", className)}
    >
      <div className="flex flex-col gap-2 border-b p-3">
        <SearchInput
          value={query.q}
          placeholder={t("inbox.search")}
          onChange={(q) => onSearchChange({ q: q ?? "" })}
        />
        <div className="flex flex-wrap gap-2">
          <Select
            items={statusItems}
            value={query.status}
            onValueChange={(value) =>
              onSearchChange({ status: value as InboxSearch["status"] })
            }
          >
            <SelectTrigger size="sm" aria-label={t("inbox.filters.status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={assigneeItems}
            value={query.assignee}
            onValueChange={(value) =>
              onSearchChange({ assignee: value as InboxSearch["assignee"] })
            }
          >
            <SelectTrigger size="sm" aria-label={t("inbox.filters.assignee")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assigneeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Toggle
            size="sm"
            variant="outline"
            pressed={query.unread}
            onPressedChange={(pressed) => onSearchChange({ unread: pressed })}
          >
            {t("inbox.filters.unread")}
          </Toggle>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.isPending ? (
          <div className="flex flex-col gap-3 p-4" aria-busy>
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState
            error={list.error}
            onRetry={() => void list.refetch()}
            className="m-3"
          />
        ) : list.data.data.length === 0 ? (
          <EmptyState
            className="m-3"
            title={filtered ? t("inbox.noMatchTitle") : t("inbox.emptyTitle")}
            description={
              filtered
                ? t("inbox.noMatchDescription")
                : t("inbox.emptyDescription")
            }
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {list.data.data.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeId}
                onOpen={() => onSearchChange({ c: conversation.id })}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
