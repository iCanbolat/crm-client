import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { MessageCircleIcon, PhoneOffIcon, UserXIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { ColorBadge, formatPhone } from "@/engine/field-types"
import { getRecipientRule } from "@/engine/messaging"
import { getRecordTitle, type ObjectDef } from "@/engine/metadata"
import { usePermission } from "@/features/auth"
import { recordQueries } from "@/features/records"

import { messagingQueries } from "../api/messaging.queries"
import { Composer } from "./shared/composer"
import { MessageThread } from "./shared/message-thread"
import { TemplateSendDialog } from "./shared/template-send-dialog"

interface RecordWhatsappTabProps {
  objectDef: ObjectDef
  recordId: string
}

/** WhatsApp tab of a record page (B6.4). */
export function RecordWhatsappTab({
  objectDef,
  recordId,
}: RecordWhatsappTabProps) {
  const { t } = useTranslation("messaging")
  const canSend = usePermission("create", "conversation")
  const { data: record } = useSuspenseQuery(
    recordQueries.detail(objectDef.key, recordId)
  )
  const query = useQuery(
    messagingQueries.recordConversation(objectDef.key, recordId)
  )
  const [starting, setStarting] = useState(false)
  const recordLink = {
    objectKey: objectDef.key,
    recordId,
    label: getRecordTitle(objectDef, record),
  }

  if (query.isPending) return <LoadingSkeleton />
  if (query.isError) {
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    )
  }
  const { recipient, conversation } = query.data

  if (!recipient) {
    return (
      <EmptyState
        icon={UserXIcon}
        title={t("recordTab.noRecipientTitle")}
        description={t("recordTab.noRecipientDescription")}
      />
    )
  }
  if (!recipient.phone) {
    return (
      <EmptyState
        icon={PhoneOffIcon}
        title={t("recordTab.noPhoneTitle")}
        description={t("recordTab.noPhoneDescription", {
          name: recipient.contact.label,
        })}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {t("recordTab.recipient")}
        </span>
        <Link
          to="/o/$objectKey/$recordId"
          params={{
            objectKey: recipient.contact.objectKey,
            recordId: recipient.contact.recordId,
          }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {recipient.contact.label}
        </Link>
        <span>{formatPhone(recipient.phone)}</span>
        <ColorBadge color={recipient.optIn ? "green" : "gray"}>
          {recipient.optIn ? t("context.optedIn") : t("context.optedOut")}
        </ColorBadge>
        {conversation ? (
          <Link
            to="/inbox"
            search={{ c: conversation.id }}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "ms-auto",
            })}
          >
            {t("conversation.openInInbox")}
          </Link>
        ) : null}
      </div>

      {conversation ? (
        <div className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border bg-card">
          <MessageThread
            conversation={conversation}
            className="min-h-0 flex-1"
          />
          <Composer
            conversation={{ ...conversation, optIn: recipient.optIn }}
            record={recordLink}
          />
        </div>
      ) : (
        <EmptyState
          icon={MessageCircleIcon}
          title={t("recordTab.emptyTitle")}
          description={t("recordTab.emptyDescription", {
            name: recipient.contact.label,
          })}
          action={
            canSend ? (
              <Button onClick={() => setStarting(true)}>
                {t("recordTab.start")}
              </Button>
            ) : undefined
          }
        />
      )}

      <TemplateSendDialog
        open={starting}
        onOpenChange={setStarting}
        conversation={null}
        record={recordLink}
        optIn={recipient.optIn}
      />
    </div>
  )
}

/**
 * Whether a record page shows the WhatsApp tab: the channel is connected,
 * the member may read conversations and the object has a recipient rule.
 */
export function useHasWhatsappTab(objectDef: ObjectDef | undefined) {
  const canRead = usePermission("read", "conversation")
  const status = useQuery({ ...messagingQueries.status(), enabled: canRead })
  return (
    canRead &&
    !!status.data?.connected &&
    !!objectDef &&
    getRecipientRule(objectDef) !== null
  )
}
