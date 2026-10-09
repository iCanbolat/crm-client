import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { BellIcon, CheckCheckIcon, SettingsIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useMarkNotificationsMutation } from "../api/notifications.mutations"
import { notificationQueries } from "../api/notifications.queries"
import type { AppNotification } from "../api/notifications.schemas"
import { notificationHref, notificationText } from "../lib/messages"

/**
 * Bell of the top bar (B7.2): unread badge, the latest notifications,
 * "mark all as read". Polls every 30 s while the tab is visible.
 */
export function NotificationsBell() {
  const { t } = useTranslation("notifications")
  const [open, setOpen] = useState(false)
  const query = useQuery(notificationQueries.list())
  const mark = useMarkNotificationsMutation()
  const navigate = useNavigate()
  const unread = query.data?.unreadCount ?? 0
  const items = query.data?.data ?? []

  function openNotification(item: AppNotification) {
    setOpen(false)
    if (!item.readAt) mark.mutate({ ids: [item.id], read: true })
    const href = notificationHref(item.link)
    if (href) void navigate({ href })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unread ? t("labelUnread", { count: unread }) : t("label")
            }
          />
        }
      >
        <BellIcon />
        {unread ? (
          <span
            aria-hidden
            data-testid="notifications-badge"
            className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <PopoverTitle className="font-heading text-base font-semibold">
            {t("title")}
          </PopoverTitle>
          <Button
            variant="ghost"
            size="sm"
            disabled={!unread || mark.isPending}
            onClick={() => mark.mutate({ all: true, read: true })}
          >
            <CheckCheckIcon aria-hidden />
            {t("markAllRead")}
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul
            aria-label={t("title")}
            className="max-h-96 divide-y overflow-y-auto"
          >
            {items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                onOpen={() => openNotification(item)}
              />
            ))}
          </ul>
        )}
        <div className="border-t px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            nativeButton={false}
            render={<Link to="/settings/notifications" />}
            onClick={() => setOpen(false)}
          >
            <SettingsIcon aria-hidden />
            {t("preferencesLink")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationItem({
  item,
  onOpen,
}: {
  item: AppNotification
  onOpen: () => void
}) {
  const { t, i18n } = useTranslation("notifications")
  const { title, body } = notificationText(item, t, i18n.language)
  const unread = !item.readAt
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
          unread && "bg-primary/5"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            unread ? "bg-primary" : "bg-transparent"
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn("text-sm", unread ? "font-semibold" : "font-medium")}
          >
            {unread ? <span className="sr-only">{t("unread")}: </span> : null}
            {title}
          </span>
          <span className="line-clamp-2 text-xs text-foreground/75">
            {body}
          </span>
          <time
            dateTime={item.createdAt}
            className="text-xs text-foreground/70"
          >
            {formatRelativeTime(item.createdAt, i18n.language)}
          </time>
        </span>
      </button>
    </li>
  )
}
