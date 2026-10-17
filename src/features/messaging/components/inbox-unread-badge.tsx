import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { SidebarMenuBadge } from "@/components/ui/sidebar"

import { useInboxUnread } from "../hooks/use-inbox-unread"

/** Unread conversations next to "Gelen kutusu" in the sidebar (B6.3). */
export function InboxUnreadBadge() {
  const { t } = useTranslation("messaging")
  const unread = useInboxUnread()
  if (!unread) return null
  return (
    <SidebarMenuBadge>
      <Badge className="min-w-5 px-1.5 tabular-nums" aria-hidden>
        {unread > 99 ? "99+" : unread}
      </Badge>
      <span className="sr-only">
        {t("inbox.unreadBadge", { count: unread })}
      </span>
    </SidebarMenuBadge>
  )
}
