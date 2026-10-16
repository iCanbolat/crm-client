import { dispatchMessageEvent } from "@/features/messaging/mocks/dispatch"
import {
  onAttachmentAdded,
  onRecordSaved,
  registerRecordHook,
  registerStageGuard,
} from "@/features/records/mocks/store"
import { registerReportBuilder } from "@/features/reports/mocks/registry"
import { db } from "@/mocks/db"
import { registerScheduledCheck } from "@/mocks/scheduler"

import { checklistHandlers } from "./checklist-handlers"
import { dashboardHandlers } from "./dashboard-handlers"
import { enrollmentHandlers } from "./enrollment-handlers"
import { paymentHandlers } from "./payment-handlers"
import { remindVisaEducation } from "./reminders"
import {
  buildCollections,
  buildCommissionByInstitution,
  buildCounselorPerformance,
  buildEnrollmentFunnel,
  buildVisaOutcomes,
} from "./reports"
import {
  appointmentHook,
  applyChecklistTemplate,
  CHECKLIST_OBJECTS,
  checklistOf,
  checklistTemplateKey,
  enrollmentGuard,
  enrollmentHook,
  programHook,
  syncChecklistSummary,
  syncNextAppointment,
  today,
  visaGuard,
  visaHook,
} from "./store"

// Server-maintained values (B8.3, B8.5, B8.6) ------------------------------

registerRecordHook("program", programHook)
registerRecordHook("enrollment", enrollmentHook)
registerRecordHook("visaApplication", visaHook)
registerRecordHook("appointment", appointmentHook)

// Stage gates beyond the record's own values (B8.6, B8.7) ------------------

registerStageGuard("enrollment", enrollmentGuard)
registerStageGuard("visaApplication", visaGuard)

// Ready-made reports (B8.10) -----------------------------------------------

for (const [key, build] of [
  ["visaOutcomes", buildVisaOutcomes],
  ["enrollmentFunnel", buildEnrollmentFunnel],
  ["commissionByInstitution", buildCommissionByInstitution],
  ["counselorPerformance", buildCounselorPerformance],
  ["collections", buildCollections],
] as const) {
  registerReportBuilder({ key, moduleId: "visa-education", build })
}

// Appointment / instalment / passport reminders (B8.8) ----------------------

registerScheduledCheck(remindVisaEducation)

const isChecklistObject = (objectKey: string) =>
  (CHECKLIST_OBJECTS as readonly string[]).includes(objectKey)

/** New files start with their template's checklist. */
onRecordSaved(({ objectKey, row, previous, actorId }) => {
  if (!isChecklistObject(objectKey)) return
  const templateKey = checklistTemplateKey(row)
  if (!templateKey) return
  const empty = checklistOf(row.workspaceId, objectKey, row.id).length === 0
  if (!previous || empty)
    applyChecklistTemplate(row, templateKey, actorId ?? null)
})

/** Appointments keep the visa file's "next appointment" current. */
onRecordSaved(({ workspaceId, objectKey, row, previous }) => {
  if (objectKey !== "appointment") return
  const visaIds = new Set(
    [row.values.visaApplicationId, previous?.visaApplicationId].filter(
      (value): value is string => typeof value === "string" && value !== ""
    )
  )
  for (const visaId of visaIds) syncNextAppointment(workspaceId, visaId)
})

/** Stage changes of a file may notify the applicant on WhatsApp (B8.9). */
const STAGE_EVENTS: Record<string, string> = {
  visaApplication: "visa.stage",
  enrollment: "enrollment.stage",
}
onRecordSaved(({ workspaceId, objectKey, row, previous }) => {
  const type = STAGE_EVENTS[objectKey]
  const stage = row.values.stage
  if (!type || typeof stage !== "string" || stage === previous?.stage) return
  dispatchMessageEvent(workspaceId, {
    type,
    objectKey,
    recordId: row.id,
    data: { stage },
  })
})

/** An uploaded document of a category fills the matching open item. */
onAttachmentAdded(
  ({ workspaceId, objectKey, recordId, attachmentId, category }) => {
    if (!isChecklistObject(objectKey) || !category) return
    const item = checklistOf(workspaceId, objectKey, recordId).find(
      (entry) =>
        entry.category === category &&
        (entry.status === "missing" ||
          entry.status === "requested" ||
          entry.status === "rejected")
    )
    if (!item) return
    db.checklistItems.update(item.id, {
      status: "received",
      attachmentId,
      documentDate: today(),
      updatedAt: new Date().toISOString(),
    })
    syncChecklistSummary(workspaceId, objectKey, recordId)
  }
)

export const visaEducationHandlers = [
  ...dashboardHandlers,
  ...checklistHandlers,
  ...paymentHandlers,
  ...enrollmentHandlers,
]
