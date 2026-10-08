import { useTranslation } from "react-i18next"

import { SidebarMenuBadge } from "@/components/ui/sidebar"

import { useInboxUnread } from "../hooks/use-inbox-unread"

/** Unread conversations next to "Gelen kutusu" in the sidebar (B6.3). */
export function InboxUnreadBadge() {
  const { t } = useTranslation("messaging")
  const unread = useInboxUnread()
  if (!unread) return null
  return (
    <SidebarMenuBadge>
      <span aria-hidden>{unread > 99 ? "99+" : unread}</span>
      <span className="sr-only">
        {t("inbox.unreadBadge", { count: unread })}
      </span>
    </SidebarMenuBadge>
  )
}
