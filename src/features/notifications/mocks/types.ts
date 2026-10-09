import type {
  NotificationLink,
  NotificationType,
} from "../api/notifications.schemas"

export interface NotificationRow {
  id: string
  workspaceId: string
  userId: string
  type: NotificationType
  params: Record<string, string>
  link: NotificationLink | null
  /** Same key = same notification; see `notify`. */
  dedupeKey: string
  readAt: string | null
  createdAt: string
}

export interface NotificationPrefRow {
  /** `${workspaceId}:${userId}` */
  id: string
  workspaceId: string
  userId: string
  types: Partial<Record<NotificationType, boolean>>
}
