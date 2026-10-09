import { z } from "zod"

/**
 * In-app notification types (B7.2). `automation.notify` comes from an
 * automation rule's "notify" action (B7.3).
 */
export const NOTIFICATION_TYPES = [
  "submission.new",
  "whatsapp.inbound",
  "record.assigned",
  "task.due",
  "quote.expiring",
  "automation.notify",
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const notificationLinkSchema = z.union([
  z.object({ objectKey: z.string(), recordId: z.string() }),
  z.object({ to: z.string().startsWith("/") }),
])
export type NotificationLink = z.infer<typeof notificationLinkSchema>

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(NOTIFICATION_TYPES),
  /** Interpolation values of the localized title / body. */
  params: z.record(z.string(), z.string()),
  link: notificationLinkSchema.nullable(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
})
export type AppNotification = z.infer<typeof notificationSchema>

export const notificationListSchema = z.object({
  data: z.array(notificationSchema),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }),
  unreadCount: z.number().int(),
})
export type NotificationList = z.infer<typeof notificationListSchema>

export interface NotificationListParams {
  unread?: boolean
  page?: number
  pageSize?: number
}

export const markNotificationsSchema = z.union([
  z.object({ ids: z.array(z.string()).min(1), read: z.boolean() }),
  z.object({ all: z.literal(true), read: z.literal(true) }),
])
export type MarkNotificationsInput = z.infer<typeof markNotificationsSchema>

export const notificationPreferencesSchema = z.object({
  types: z.record(z.enum(NOTIFICATION_TYPES), z.boolean()),
})
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>

/** PATCH body: only the switched types. */
export const notificationPreferencesInputSchema = z.object({
  types: z.partialRecord(z.enum(NOTIFICATION_TYPES), z.boolean()),
})
export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesInputSchema
>
