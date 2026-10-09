import { seedRecords } from "@/features/records/mocks/factory"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"

import type { NotificationRow } from "./types"

const ago = (now: number, minutes: number) =>
  new Date(now - minutes * 60_000).toISOString()

/**
 * A few notifications per Acme member so the bell is not empty: two unread
 * (an assigned lead, a new form submission) and one read. Times are relative
 * to the real "now".
 */
export function seedNotifications(
  now = Math.floor(Date.now() / 60_000) * 60_000
): NotificationRow[] {
  const leads = seedRecords().filter(
    (row) => row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === "lead"
  )
  const members = [
    SEED_USERS.owner,
    SEED_USERS.admin,
    SEED_USERS.manager,
    SEED_USERS.agent,
  ]
  return members.flatMap((user, index) => {
    const assigned = leads[index]!
    const submitted = leads[index + members.length]!
    const base = { workspaceId: WORKSPACE_IDS.acme, userId: user.id }
    const rows: NotificationRow[] = [
      {
        ...base,
        id: `ntf_${user.id}_1`,
        type: "record.assigned",
        params: {
          title: String(assigned.values.name),
          actor: SEED_USERS.manager.name,
        },
        link: { objectKey: "lead", recordId: assigned.id },
        dedupeKey: `seed:assigned:${assigned.id}`,
        readAt: null,
        createdAt: ago(now, 25 + index * 7),
      },
      {
        ...base,
        id: `ntf_${user.id}_2`,
        type: "submission.new",
        params: {
          form: "Navlun Teklif Formu",
          title: String(submitted.values.name),
        },
        link: { objectKey: "lead", recordId: submitted.id },
        dedupeKey: `seed:submission:${submitted.id}`,
        readAt: null,
        createdAt: ago(now, 180 + index * 11),
      },
      {
        ...base,
        id: `ntf_${user.id}_3`,
        type: "task.due",
        params: { title: "Haftalık navlun fiyatlarını güncelle" },
        link: { to: "/tasks" },
        dedupeKey: `seed:task:${user.id}`,
        readAt: ago(now, 60 * 20),
        createdAt: ago(now, 60 * 26),
      },
    ]
    return rows
  })
}
