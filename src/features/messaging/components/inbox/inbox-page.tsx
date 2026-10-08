import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { MessagesSquareIcon, PlugZapIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import { buttonVariants } from "@/components/ui/button"
import { usePermission } from "@/features/auth"
import { cn } from "@/lib/utils"

import { messagingQueries } from "../../api/messaging.queries"
import type { InboxSearch } from "../../api/messaging.schemas"
import { ConversationList } from "./conversation-list"
import { ConversationPane } from "./conversation-pane"

interface InboxPageProps {
  search: InboxSearch
  onSearchChange: (patch: Partial<InboxSearch>) => void
}

/** WhatsApp inbox (B6.3): list | conversation | person. */
export function InboxPage({ search, onSearchChange }: InboxPageProps) {
  const { t } = useTranslation("messaging")
  const { data: status } = useSuspenseQuery(messagingQueries.status())
  const canManageChannel = usePermission("manage", "channel")
  const activeId = search.c

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("inbox.title")}
        description={
          status.displayPhoneNumber
            ? `${t("inbox.description")} ${status.displayPhoneNumber}`
            : t("inbox.description")
        }
      />

      {!status.connected ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-dashed p-4 sm:flex-row sm:items-center"
        >
          <PlugZapIcon aria-hidden className="size-5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="font-medium">{t("inbox.notConnectedTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("inbox.notConnectedDescription")}{" "}
              {canManageChannel ? null : t("inbox.askAdmin")}
            </p>
          </div>
          {canManageChannel ? (
            <Link
              to="/settings/whatsapp"
              className={buttonVariants({ size: "sm" })}
            >
              {t("inbox.connect")}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid h-[calc(100dvh-13rem)] min-h-[30rem] overflow-hidden rounded-2xl border bg-card md:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_17rem]">
        <ConversationList
          search={search}
          onSearchChange={onSearchChange}
          className={cn(activeId ? "hidden md:flex" : "flex")}
        />
        {activeId ? (
          <ConversationPane
            conversationId={activeId}
            onBack={() => onSearchChange({ c: undefined })}
          />
        ) : (
          <div className="hidden flex-col items-center justify-center gap-2 p-6 text-center md:flex xl:col-span-2">
            <MessagesSquareIcon aria-hidden className="size-8" />
            <p className="font-medium">{t("inbox.selectTitle")}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("inbox.selectDescription")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
