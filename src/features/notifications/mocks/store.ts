import { db } from "@/mocks/db"

import {
  NOTIFICATION_TYPES,
  type NotificationLink,
  type NotificationType,
} from "../api/notifications.schemas"
import type { NotificationRow } from "./types"

export function preferencesOf(workspaceId: string, userId: string) {
  const row = db.notificationPrefs.findById(`${workspaceId}:${userId}`)
  return Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => [type, row?.types[type] ?? true])
  ) as Record<NotificationType, boolean>
}

export function savePreferences(
  workspaceId: string,
  userId: string,
  types: Partial<Record<NotificationType, boolean>>
) {
  const id = `${workspaceId}:${userId}`
  const current = db.notificationPrefs.findById(id)
  if (current) {
    db.notificationPrefs.update(id, { types: { ...current.types, ...types } })
  } else {
    db.notificationPrefs.create({ id, workspaceId, userId, types })
  }
  return preferencesOf(workspaceId, userId)
}

/** Members of a workspace with one of the roles (recipient lists). */
export function membersWithRole(workspaceId: string, roles: readonly string[]) {
  return db.memberships
    .findMany(
      (item) => item.workspaceId === workspaceId && roles.includes(item.role)
    )
    .map((item) => item.userId)
}

export interface NotifyInput {
  type: NotificationType
  params: Record<string, string>
  link: NotificationLink | null
  dedupeKey: string
  /**
   * `once` (default): the key never notifies twice (a reminder).
   * `whileUnread`: a new event refreshes the unread notification of the same
   * key instead of adding another (e.g. more messages in one conversation);
   * once read, the next event notifies again.
   */
  repeat?: "once" | "whileUnread"
}

/**
 * Creates the notification for every recipient who has not switched the
 * type off (B7.2). Duplicates of the same key are skipped (see `repeat`).
 */
export function notify(
  workspaceId: string,
  userIds: readonly (string | null | undefined)[],
  { repeat = "once", ...input }: NotifyInput,
  now = new Date()
) {
  const created: NotificationRow[] = []
  for (const userId of new Set(userIds)) {
    if (!userId || !preferencesOf(workspaceId, userId)[input.type]) continue
    const existing = db.notifications.findFirst(
      (row) =>
        row.workspaceId === workspaceId &&
        row.userId === userId &&
        row.dedupeKey === input.dedupeKey &&
        (repeat === "once" || row.readAt === null)
    )
    if (existing) {
      if (repeat === "whileUnread") {
        db.notifications.update(existing.id, {
          params: input.params,
          createdAt: now.toISOString(),
        })
      }
      continue
    }
    created.push(
      db.notifications.create({
        id: `ntf_${crypto.randomUUID().slice(0, 12)}`,
        workspaceId,
        userId,
        ...input,
        readAt: null,
        createdAt: now.toISOString(),
      })
    )
  }
  return created
}
