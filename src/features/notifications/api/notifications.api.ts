import { z } from "zod"

import { apiClient } from "@/lib/api"

import {
  notificationListSchema,
  notificationPreferencesSchema,
  type MarkNotificationsInput,
  type NotificationListParams,
  type NotificationPreferencesInput,
} from "./notifications.schemas"

const markResultSchema = z.object({
  updated: z.number().int(),
  unreadCount: z.number().int(),
})

export function fetchNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal
) {
  return apiClient.get("/notifications", {
    signal,
    query: { ...params },
    schema: notificationListSchema,
  })
}

export function markNotifications(input: MarkNotificationsInput) {
  return apiClient.patch("/notifications", {
    body: input,
    schema: markResultSchema,
  })
}

export function fetchNotificationPreferences(signal?: AbortSignal) {
  return apiClient.get("/notifications/preferences", {
    signal,
    schema: notificationPreferencesSchema,
  })
}

export function updateNotificationPreferences(
  input: NotificationPreferencesInput
) {
  return apiClient.patch("/notifications/preferences", {
    body: input,
    schema: notificationPreferencesSchema,
  })
}
