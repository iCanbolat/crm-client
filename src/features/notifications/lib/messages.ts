import type { TFunction, TOptions } from "i18next"

import { formatDate } from "@/lib/format"

import type {
  AppNotification,
  NotificationLink,
} from "../api/notifications.schemas"

/** Localized title and body of a notification. */
export function notificationText(
  notification: Pick<AppNotification, "type" | "params">,
  t: TFunction<"notifications">,
  locale: string
) {
  const { type } = notification
  const params = notification.params as TOptions
  const key = `types.${type}` as "types.task.due"
  let body: string
  if (type === "submission.new" && !notification.params.title) {
    body = t("types.submission.new.bodyNoRecord", params)
  } else if (type === "record.assigned" && notification.params.actor) {
    body = t("types.record.assigned.bodyByActor", params)
  } else if (type === "quote.expiring" && notification.params.date) {
    body = t("types.quote.expiring.body", {
      ...notification.params,
      date: formatDate(notification.params.date, locale),
    })
  } else {
    body = t(`${key}.body`, params)
  }
  return { title: t(`${key}.title`, params), body }
}

/** Where a click on the notification goes. */
export function notificationHref(link: NotificationLink | null) {
  if (!link) return null
  if ("to" in link) return link.to
  return `/o/${encodeURIComponent(link.objectKey)}/${encodeURIComponent(link.recordId)}`
}
