import { getRecordRef } from "@/features/records/mocks/store"
import { db } from "@/mocks/db"
import { onMockEvent, type MockEvent } from "@/mocks/events"
import { registerScheduledCheck } from "@/mocks/scheduler"

import { membersWithRole, notify } from "./store"

const ADMINS = ["owner", "admin"] as const
/** Quotes expiring within this many days are announced to their owner. */
export const QUOTE_EXPIRY_NOTICE_DAYS = 2

const userName = (id: string | null | undefined) =>
  (id && db.users.findById(id)?.name) || ""

function recordLink(event: Pick<MockEvent, "objectKey" | "recordId">) {
  return { objectKey: event.objectKey, recordId: event.recordId }
}

function titleOf(workspaceId: string, objectKey: string, recordId: string) {
  return getRecordRef(workspaceId, objectKey, recordId)?.label ?? recordId
}

/* ---------------------------------------------------------------- events */

function onSubmission(event: MockEvent) {
  const { workspaceId } = event
  const form = db.forms.findById(event.data?.formId ?? "")
  const hasRecord = event.objectKey !== "submission"
  const owner = hasRecord
    ? db.records.findById(event.recordId)?.values.ownerId
    : null
  notify(
    workspaceId,
    [...membersWithRole(workspaceId, ADMINS), String(owner ?? "")],
    {
      type: "submission.new",
      params: {
        form: form?.name ?? "",
        title: hasRecord
          ? titleOf(workspaceId, event.objectKey, event.recordId)
          : "",
      },
      link: hasRecord ? recordLink(event) : { to: "/submissions" },
      dedupeKey: `submission:${event.data?.submissionId ?? event.recordId}`,
    }
  )
}

function onInbound(event: MockEvent) {
  const conversation = db.conversations.findById(event.recordId)
  if (!conversation) return
  const recipients = conversation.assigneeId
    ? [conversation.assigneeId]
    : membersWithRole(event.workspaceId, [...ADMINS, "manager"])
  notify(event.workspaceId, recipients, {
    type: "whatsapp.inbound",
    params: {
      name: conversation.profileName ?? conversation.phone,
      preview: conversation.lastMessagePreview.slice(0, 80),
    },
    link: { to: `/inbox?c=${conversation.id}` },
    dedupeKey: `inbound:${conversation.id}`,
    repeat: "whileUnread",
  })
}

function onAssigned(event: MockEvent) {
  const ownerId = event.data?.ownerId
  // Nobody is told about records they took themselves.
  if (!ownerId || ownerId === event.actorId) return
  notify(event.workspaceId, [ownerId], {
    type: "record.assigned",
    params: {
      title: titleOf(event.workspaceId, event.objectKey, event.recordId),
      actor: userName(event.actorId),
    },
    link: recordLink(event),
    dedupeKey: `assigned:${event.objectKey}:${event.recordId}:${ownerId}`,
    repeat: "whileUnread",
  })
}

onMockEvent((event) => {
  if (event.type === "submission.created") onSubmission(event)
  else if (event.type === "conversation.inbound") onInbound(event)
  else if (event.type === "record.assigned") onAssigned(event)
})

/* ----------------------------------------------------------- scheduled */

/** Local calendar day (`yyyy-MM-dd`) of a date. */
export function isoDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Reminders (TC-7.2-04): open tasks due today, and sent quotes that expire
 * within two days. Idempotent: one reminder per task / quote and date.
 */
export function remindDueItems(workspaceId: string, now: Date) {
  const today = isoDay(now)
  for (const task of db.tasks.findMany(
    (row) =>
      row.workspaceId === workspaceId &&
      row.status === "open" &&
      row.dueDate === today
  )) {
    notify(
      workspaceId,
      [task.assigneeId],
      {
        type: "task.due",
        params: { title: task.title },
        link: task.related ?? { to: "/tasks" },
        dedupeKey: `task:${task.id}:${task.dueDate}`,
      },
      now
    )
  }

  const until = isoDay(addDays(now, QUOTE_EXPIRY_NOTICE_DAYS))
  for (const quote of db.records.findMany(
    (row) =>
      row.workspaceId === workspaceId &&
      row.objectKey === "quote" &&
      row.values.status === "sent" &&
      typeof row.values.validUntil === "string" &&
      row.values.validUntil >= today &&
      row.values.validUntil <= until
  )) {
    const validUntil = String(quote.values.validUntil)
    notify(
      workspaceId,
      [String(quote.values.ownerId ?? "")],
      {
        type: "quote.expiring",
        params: {
          title: String(quote.values.quoteNumber ?? quote.id),
          date: validUntil,
        },
        link: { objectKey: "quote", recordId: quote.id },
        dedupeKey: `quote:${quote.id}:${validUntil}`,
      },
      now
    )
  }
}

registerScheduledCheck(remindDueItems)
