import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, UserPlusIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ErrorState } from "@/components/common/error-state"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ColorBadge, formatPhone } from "@/engine/field-types"
import { usePermission, useSession } from "@/features/auth"
import { directoryQueries, useCreateRecord } from "@/features/records"
import { cn } from "@/lib/utils"

import { useUpdateConversation } from "../../api/messaging.mutations"
import { messagingQueries } from "../../api/messaging.queries"
import type { Conversation } from "../../api/messaging.schemas"
import { conversationTitle } from "../../lib/conversation"
import { Composer } from "../shared/composer"
import { MessageThread } from "../shared/message-thread"

const UNASSIGNED = "__none"

function AssigneeControl({ conversation }: { conversation: Conversation }) {
  const { t } = useTranslation("messaging")
  const { user } = useSession()
  const canAssignOthers = usePermission("manage", "conversation")
  const canUpdate = usePermission("update", "conversation")
  const update = useUpdateConversation(conversation.id)
  const users = useQuery({
    ...directoryQueries.users(),
    enabled: canAssignOthers,
  })

  if (!canUpdate) {
    return (
      <span className="text-xs text-muted-foreground">
        {conversation.assigneeName ?? t("conversation.unassigned")}
      </span>
    )
  }
  if (!canAssignOthers) {
    const mine = conversation.assigneeId === user.id
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={update.isPending}
        onClick={() => update.mutate({ assigneeId: mine ? null : user.id })}
      >
        {mine ? t("conversation.release") : t("conversation.take")}
      </Button>
    )
  }
  const items = [
    { value: UNASSIGNED, label: t("conversation.unassigned") },
    ...(users.data?.data ?? [])
      .filter((item) => item.role !== "viewer")
      .map((item) => ({ value: item.id, label: item.name })),
  ]
  return (
    <Select
      items={items}
      value={conversation.assigneeId ?? UNASSIGNED}
      onValueChange={(value) =>
        update.mutate({
          assigneeId: value === UNASSIGNED ? null : (value as string),
        })
      }
    >
      <SelectTrigger size="sm" aria-label={t("conversation.assignee")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Right pane: who the customer is, consent, linking unknown numbers. */
function ContextPanel({ conversation }: { conversation: Conversation }) {
  const { t } = useTranslation("messaging")
  const canCreateLead = usePermission("create", "record")
  const canUpdate = usePermission("update", "conversation")
  const createLead = useCreateRecord("lead")
  const update = useUpdateConversation(conversation.id)

  const linkNewLead = async () => {
    const lead = await createLead.mutateAsync({
      name: conversation.profileName ?? conversation.phone,
      phone: conversation.phone,
      source: "other",
    })
    await update.mutateAsync({
      contact: { objectKey: "lead", recordId: lead.id },
    })
    toast.success(t("context.leadCreated"))
  }

  return (
    <aside
      aria-label={t("context.title")}
      className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-s p-4 xl:flex"
    >
      <h2 className="text-sm font-medium">{t("context.title")}</h2>
      {conversation.contact ? (
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {t(
                conversation.contact.objectKey === "lead"
                  ? "context.lead"
                  : "context.contact"
              )}
            </dt>
            <dd>
              <Link
                to="/o/$objectKey/$recordId"
                params={{
                  objectKey: conversation.contact.objectKey,
                  recordId: conversation.contact.recordId,
                }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {conversation.contact.label}
              </Link>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {t("context.phone")}
            </dt>
            <dd>{formatPhone(conversation.phone)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">
              {t("context.optIn")}
            </dt>
            <dd>
              <ColorBadge color={conversation.optIn ? "green" : "gray"}>
                {conversation.optIn
                  ? t("context.optedIn")
                  : t("context.optedOut")}
              </ColorBadge>
            </dd>
          </div>
        </dl>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">{t("context.unknownTitle")}</p>
          <p className="text-muted-foreground">
            {t("context.unknownDescription")}
          </p>
          {canCreateLead && canUpdate ? (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={createLead.isPending || update.isPending}
              onClick={() => void linkNewLead()}
            >
              <UserPlusIcon data-icon="inline-start" aria-hidden />
              {t("context.createLead")}
            </Button>
          ) : null}
        </div>
      )}
    </aside>
  )
}

function ConversationView({
  conversation,
  onBack,
}: {
  conversation: Conversation
  onBack: () => void
}) {
  const { t } = useTranslation("messaging")
  const canUpdate = usePermission("update", "conversation")
  const update = useUpdateConversation(conversation.id)
  const title = conversationTitle(conversation)
  const closed = conversation.status === "closed"

  return (
    <>
      <section
        aria-label={t("conversation.label", { name: title })}
        className="flex min-h-0 min-w-0 flex-col"
      >
        <header className="flex flex-wrap items-center gap-3 border-b px-3 py-2.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label={t("inbox.back")}
            onClick={onBack}
          >
            <ArrowLeftIcon />
          </Button>
          <UserAvatar name={title} className="size-9" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {formatPhone(conversation.phone)}
              {closed ? ` · ${t("conversation.closed")}` : null}
            </p>
          </div>
          {conversation.contact ? (
            <Link
              to="/o/$objectKey/$recordId"
              params={{
                objectKey: conversation.contact.objectKey,
                recordId: conversation.contact.recordId,
              }}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "xl:hidden"
              )}
            >
              {t("conversation.openRecord")}
            </Link>
          ) : null}
          <AssigneeControl conversation={conversation} />
          {canUpdate ? (
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ status: closed ? "open" : "closed" })
              }
            >
              {closed ? t("conversation.reopen") : t("conversation.close")}
            </Button>
          ) : null}
        </header>
        <MessageThread conversation={conversation} className="min-h-0 flex-1" />
        <Composer conversation={conversation} />
      </section>
      <ContextPanel conversation={conversation} />
    </>
  )
}

/** Middle (+ right) pane of the inbox for the conversation in the URL. */
export function ConversationPane({
  conversationId,
  onBack,
}: {
  conversationId: string
  onBack: () => void
}) {
  const conversation = useQuery(messagingQueries.conversation(conversationId))
  if (conversation.isPending) {
    return (
      <div className="flex flex-col gap-3 p-4" aria-busy>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (conversation.isError) {
    return (
      <ErrorState
        className="m-4"
        error={conversation.error}
        onRetry={() => void conversation.refetch()}
      />
    )
  }
  return (
    <ConversationView
      key={conversation.data.id}
      conversation={conversation.data}
      onBack={onBack}
    />
  )
}
