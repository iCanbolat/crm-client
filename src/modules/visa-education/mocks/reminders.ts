import { dispatchMessageEvent } from "@/features/messaging/mocks/dispatch"
import { notify } from "@/features/notifications/mocks/store"
import { recordsOf } from "@/features/records/mocks/store"
import { formatMoney } from "@/lib/currencies"
import { formatDate } from "@/lib/format"
import { db } from "@/mocks/db"

import { addDays, addMonths, type PassportValue } from "../lib/passport"
import { isInstallmentPaid } from "../lib/payments"
import { CHECKLIST_OBJECTS } from "./store"

/** Local calendar day (`yyyy-MM-dd`). */
function isoDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const APPOINTMENT_NOTICE_DAYS = 2
const INSTALLMENT_NOTICE_DAYS = 3
const OPEN_STAGES = new Set([
  "counselling",
  "documents",
  "applied",
  "conditional_offer",
  "unconditional_offer",
  "confirmation",
  "consultation",
  "appointment_booked",
  "submitted",
  "processing",
])

const language = (workspaceId: string) =>
  db.workspaces.findById(workspaceId)?.language === "en" ? "en" : "tr"

/**
 * Time based reminders of the module (B8.8): appointments within two days,
 * overdue / soon due instalments and expiring passports. Idempotent via
 * `dedupeKey` (notifications) and `dispatchKey` (WhatsApp).
 */
export function remindVisaEducation(workspaceId: string, now: Date) {
  const modules = db.workspaces.findById(workspaceId)?.modules ?? []
  if (!modules.includes("visa-education")) return
  const today = isoDay(now)
  const lng = language(workspaceId)

  // Appointments ---------------------------------------------------------
  const until = new Date(
    now.getTime() + APPOINTMENT_NOTICE_DAYS * 86_400_000
  ).toISOString()
  for (const row of recordsOf(workspaceId, "appointment")) {
    const at = String(row.values.scheduledAt ?? "")
    if (row.values.status !== "scheduled" || !at) continue
    if (at < now.toISOString() || at > until) continue
    notify(
      workspaceId,
      [String(row.values.ownerId ?? "")],
      {
        type: "appointment.upcoming",
        params: { title: String(row.values.title ?? ""), at },
        link: { objectKey: "appointment", recordId: row.id },
        dedupeKey: `appointment:${row.id}:${at}`,
      },
      now
    )
    dispatchMessageEvent(workspaceId, {
      type: "appointment.reminder",
      objectKey: "appointment",
      recordId: row.id,
      data: { at },
    })
  }

  // Instalments ----------------------------------------------------------
  const soon = addDays(today, INSTALLMENT_NOTICE_DAYS)
  for (const plan of db.paymentPlans.findMany(
    (row) => row.workspaceId === workspaceId
  )) {
    const record = db.records.findById(plan.recordId)
    if (!record) continue
    const title = String(
      record.values.enrollmentNumber ?? record.values.applicationNumber ?? ""
    )
    for (const item of plan.installments) {
      if (isInstallmentPaid(item)) continue
      if (item.dueDate < today) {
        notify(
          workspaceId,
          [String(record.values.ownerId ?? "")],
          {
            type: "installment.overdue",
            params: { title, date: item.dueDate },
            link: { objectKey: plan.objectKey, recordId: plan.recordId },
            dedupeKey: `installment:${plan.id}:${item.id}:${item.dueDate}`,
          },
          now
        )
      } else if (item.dueDate <= soon) {
        dispatchMessageEvent(workspaceId, {
          type: "installment.due",
          objectKey: plan.objectKey,
          recordId: plan.recordId,
          data: {
            object: plan.objectKey,
            installment: item.id,
            amount: formatMoney(
              item.amount - item.paidAmount,
              plan.serviceFee.currency,
              lng
            ),
            dueDate: formatDate(`${item.dueDate}T00:00:00`, lng),
          },
        })
      }
    }
  }

  // Passports of applicants with an open file ---------------------------
  const horizon = addMonths(today, 6)
  const openFiles = CHECKLIST_OBJECTS.flatMap((objectKey) =>
    recordsOf(workspaceId, objectKey).filter((row) =>
      OPEN_STAGES.has(String(row.values.stage))
    )
  )
  const ownerOf = new Map<string, string>()
  for (const row of openFiles) {
    const applicantId = row.values.applicantId
    if (typeof applicantId === "string" && !ownerOf.has(applicantId)) {
      ownerOf.set(applicantId, String(row.values.ownerId ?? ""))
    }
  }
  for (const [applicantId, ownerId] of ownerOf) {
    const applicant = db.records.findById(applicantId)
    const passport = applicant?.values.passport as PassportValue | undefined
    if (!applicant || !passport?.expiresAt) continue
    if (passport.expiresAt > horizon) continue
    notify(
      workspaceId,
      [ownerId],
      {
        type: "document.expiring",
        params: {
          title: String(applicant.values.name ?? ""),
          date: passport.expiresAt,
        },
        link: { objectKey: "contact", recordId: applicantId },
        dedupeKey: `passport:${applicantId}:${passport.expiresAt}`,
      },
      now
    )
  }
}
