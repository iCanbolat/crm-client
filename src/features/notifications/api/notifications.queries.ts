import { queryOptions } from "@tanstack/react-query"

import {
  fetchNotificationPreferences,
  fetchNotifications,
} from "./notifications.api"
import { notificationKeys } from "./notifications.keys"
import type { NotificationListParams } from "./notifications.schemas"

/** Polling interval of the bell (a WebSocket push later). */
export const NOTIFICATION_POLL_MS = 30_000

export const notificationQueries = {
  list: (params: NotificationListParams = {}) =>
    queryOptions({
      queryKey: notificationKeys.list(params),
      queryFn: ({ signal }) => fetchNotifications(params, signal),
      // Paused while the tab is hidden (TanStack Query default).
      refetchInterval: NOTIFICATION_POLL_MS,
    }),
  preferences: () =>
    queryOptions({
      queryKey: notificationKeys.preferences(),
      queryFn: ({ signal }) => fetchNotificationPreferences(signal),
    }),
}
