import type { RecordValues } from "@/engine/metadata"
import type { RecordRow } from "@/features/records/mocks/factory"
import {
  findRecordRow,
  recordsOf,
  type RecordHookContext,
  type StageGuard,
} from "@/features/records/mocks/store"
import i18n from "@/lib/i18n"

/** Keys are built at runtime (error codes), so the typed `t` is widened. */
const translate = i18n.t as unknown as (
  key: string,
  options?: Record<string, unknown>
) => string
import { resolveI18nText } from "@/lib/i18n-text"
import { db } from "@/mocks/db"

import {
  buildChecklist,
  templateKeyFor,
  type ChecklistContext,
} from "../lib/checklist-templates"
import { isItemComplete, summarizeChecklist } from "../lib/checklist"
import { computeCommission, toMoney } from "../lib/commission"
import {
  APPOINTMENT_CITY_LABELS,
  APPOINTMENT_PROVIDER_LABELS,
  defaultConfirmationDoc,
  ENROLLMENT_STAGES,
  VISA_STAGES,
  type AppointmentCity,
  type AppointmentProvider,
  type CommissionBasis,
} from "../lib/constants"
import { nextFileNumber } from "../lib/numbering"
import { passportValidity, type PassportValue } from "../lib/passport"
import { planSummary } from "../lib/payments"
import type { ChecklistItemRow, PaymentPlanRow } from "./types"

/** Local calendar day of "now" (seeded dates follow the real today). */
export const today = () => new Date().toISOString().slice(0, 10)

const str = (value: unknown) =>
  typeof value === "string" && value ? value : null

const workspaceLanguage = (workspaceId: string) =>
  db.workspaces.findById(workspaceId)?.language === "en" ? "en" : "tr"

const tr = (workspaceId: string, key: string, options = {}) =>
  translate(`visaEducation:${key}`, {
    lng: workspaceLanguage(workspaceId),
    ...options,
  })

/* ----------------------------------------------------------------------------
 * Record hooks: numbering and values derived from related records (B8.3, B8.5)
 * ------------------------------------------------------------------------- */

const year = () => new Date().getFullYear()

export function programHook(
  values: RecordValues,
  { workspaceId }: RecordHookContext
): RecordValues {
  const institution = str(values.institutionId)
    ? findRecordRow(workspaceId, "institution", String(values.institutionId))
    : undefined
  return { ...values, country: institution?.values.country ?? null }
}

/** Expected commission of an enrolment from its institution and programme. */
export function enrollmentCommission(
  workspaceId: string,
  values: RecordValues
) {
  const institution = str(values.institutionId)
    ? findRecordRow(workspaceId, "institution", String(values.institutionId))
    : undefined
  const program = str(values.programId)
    ? findRecordRow(workspaceId, "program", String(values.programId))
    : undefined
  return computeCommission({
    tuition: toMoney(values.tuitionFee),
    scholarship: toMoney(values.scholarship),
    rate:
      typeof values.commissionRate === "number" ? values.commissionRate : null,
    basis:
      (institution?.values.commissionBasis as CommissionBasis | undefined) ??
      "first_year_tuition",
    flat: toMoney(institution?.values.flatCommission),
    durationMonths:
      typeof program?.values.durationMonths === "number"
        ? program.values.durationMonths
        : null,
  })
}

export function enrollmentHook(
  values: RecordValues,
  { workspaceId, isNew, previous }: RecordHookContext
): RecordValues {
  const next = { ...values }
  if (isNew) {
    next.enrollmentNumber ??= nextFileNumber(
      "ENR",
      recordsOf(workspaceId, "enrollment").map(
        (row) => row.values.enrollmentNumber
      ),
      year()
    )
    next.commissionStatus ??= "none"
    next.paymentStatus ??= "none"
  }

  const programChanged = isNew || next.programId !== previous?.programId
  const program = str(next.programId)
    ? findRecordRow(workspaceId, "program", String(next.programId))
    : undefined
  if (program) {
    next.institutionId = program.values.institutionId ?? null
    next.country = program.values.country ?? null
    next.studyLevel = program.values.studyLevel ?? null
    if (programChanged || !toMoney(next.tuitionFee)) {
      next.tuitionFee =
        toMoney(next.tuitionFee) ?? program.values.tuitionFee ?? null
    }
  }
  const institution = str(next.institutionId)
    ? findRecordRow(workspaceId, "institution", String(next.institutionId))
    : undefined
  if (
    institution &&
    (next.commissionRate === null || next.commissionRate === undefined)
  ) {
    next.commissionRate = institution.values.commissionRate ?? null
  }
  next.confirmationDocType ??= next.country
    ? defaultConfirmationDoc(next.country)
    : null
  next.commissionExpected = enrollmentCommission(workspaceId, next)

  if (
    next.stage === "enrolled" &&
    (!next.commissionStatus || next.commissionStatus === "none") &&
    next.commissionExpected
  ) {
    next.commissionStatus = "expected"
  }
  return next
}

export function visaHook(
  values: RecordValues,
  { workspaceId, isNew }: RecordHookContext
): RecordValues {
  const next = { ...values }
  if (isNew) {
    next.applicationNumber ??= nextFileNumber(
      "VSA",
      recordsOf(workspaceId, "visaApplication").map(
        (row) => row.values.applicationNumber
      ),
      year()
    )
    next.paymentStatus ??= "none"
  }
  if (
    (next.stage === "approved" || next.stage === "refused") &&
    !next.decisionDate
  ) {
    next.decisionDate = today()
  }
  return next
}

export function appointmentHook(
  values: RecordValues,
  { workspaceId }: RecordHookContext
): RecordValues {
  const next = { ...values }
  const visa = str(next.visaApplicationId)
    ? findRecordRow(
        workspaceId,
        "visaApplication",
        String(next.visaApplicationId)
      )
    : undefined
  if (visa) {
    next.applicantId ??= visa.values.applicantId ?? null
    next.country = visa.values.destinationCountry ?? null
  }
  next.status ??= "scheduled"
  const language = workspaceLanguage(workspaceId)
  const provider =
    APPOINTMENT_PROVIDER_LABELS[next.provider as AppointmentProvider]
  const city = APPOINTMENT_CITY_LABELS[next.city as AppointmentCity]
  next.title = [provider, city]
    .filter(Boolean)
    .map((label) => resolveI18nText(label!, language))
    .join(" · ")
  return next
}

/** Nearest scheduled appointment of a visa file → `nextAppointmentAt`. */
export function syncNextAppointment(workspaceId: string, visaId: string) {
  const visa = findRecordRow(workspaceId, "visaApplication", visaId)
  if (!visa) return
  const now = new Date().toISOString()
  const upcoming = recordsOf(workspaceId, "appointment")
    .filter(
      (row) =>
        row.values.visaApplicationId === visaId &&
        row.values.status === "scheduled" &&
        String(row.values.scheduledAt ?? "") >= now
    )
    .map((row) => String(row.values.scheduledAt))
    .sort()
  const nextAppointmentAt = upcoming[0] ?? null
  if (visa.values.nextAppointmentAt !== nextAppointmentAt) {
    db.records.update(visa.id, {
      values: { ...visa.values, nextAppointmentAt },
    })
  }
}

/* ----------------------------------------------------------------------------
 * Document checklist (B8.7)
 * ------------------------------------------------------------------------- */

export const CHECKLIST_OBJECTS = ["enrollment", "visaApplication"] as const

export function checklistOf(
  workspaceId: string,
  objectKey: string,
  recordId: string
) {
  return db.checklistItems
    .findMany(
      (row) =>
        row.workspaceId === workspaceId &&
        row.objectKey === objectKey &&
        row.recordId === recordId
    )
    .sort((a, b) => a.sort - b.sort)
}

export function checklistContext(
  workspaceId: string,
  values: RecordValues
): ChecklistContext {
  const applicant = str(values.applicantId)
    ? findRecordRow(workspaceId, "contact", String(values.applicantId))
    : undefined
  const program = str(values.programId)
    ? findRecordRow(workspaceId, "program", String(values.programId))
    : undefined
  return {
    hasSponsor: Boolean(applicant?.values.sponsorId),
    fieldOfStudy: str(program?.values.fieldOfStudy),
  }
}

export function checklistTemplateKey(row: RecordRow) {
  return templateKeyFor(row.objectKey, row.values)
}

/** Adds the template's missing items; existing keys are kept (idempotent). */
export function applyChecklistTemplate(
  row: RecordRow,
  templateKey: string,
  actorId: string | null = null,
  now = new Date().toISOString()
): ChecklistItemRow[] {
  const existing = checklistOf(row.workspaceId, row.objectKey, row.id)
  const keys = new Set(existing.map((item) => item.key))
  let sort = existing.reduce((max, item) => Math.max(max, item.sort), -1)
  for (const item of buildChecklist(
    templateKey,
    checklistContext(row.workspaceId, row.values)
  )) {
    if (keys.has(item.key)) continue
    sort += 1
    db.checklistItems.create({
      id: `chk_${row.id}_${item.key}`,
      workspaceId: row.workspaceId,
      objectKey: row.objectKey,
      recordId: row.id,
      key: item.key,
      label: item.label,
      category: item.category,
      required: item.required,
      status: "missing",
      attachmentId: null,
      expiresAt: null,
      documentDate: null,
      maxAgeDays: item.maxAgeDays ?? null,
      note: null,
      requestedAt: null,
      updatedAt: now,
      updatedBy: actorId,
      sort,
      custom: false,
    })
  }
  syncChecklistSummary(row.workspaceId, row.objectKey, row.id)
  return checklistOf(row.workspaceId, row.objectKey, row.id)
}

export function checklistSummary(items: readonly ChecklistItemRow[]) {
  const summary = summarizeChecklist(items, today())
  return {
    total: summary.total,
    required: summary.required,
    complete: summary.complete,
    missing: summary.missing.length,
    outdated: summary.outdated.length,
    progress: summary.progress,
    ready:
      summary.missing.length === 0 &&
      !summary.outdated.some((item) => item.required),
  }
}

/** Read-only summary values on the record (lists, reports, dashboard). */
export function syncChecklistSummary(
  workspaceId: string,
  objectKey: string,
  recordId: string
) {
  const row = findRecordRow(workspaceId, objectKey, recordId)
  if (!row) return
  const items = checklistOf(workspaceId, objectKey, recordId)
  const summary = checklistSummary(items)
  const checklistProgress = items.length
    ? Math.round(summary.progress * 100)
    : null
  const missingDocuments = items.length ? summary.missing : null
  if (
    row.values.checklistProgress !== checklistProgress ||
    row.values.missingDocuments !== missingDocuments
  ) {
    db.records.update(row.id, {
      values: { ...row.values, checklistProgress, missingDocuments },
    })
  }
}

/* ----------------------------------------------------------------------------
 * Payment plans (B8.8)
 * ------------------------------------------------------------------------- */

export const planId = (objectKey: string, recordId: string) =>
  `${objectKey}:${recordId}`

export function planOf(
  workspaceId: string,
  objectKey: string,
  recordId: string
): PaymentPlanRow | undefined {
  const row = db.paymentPlans.findById(planId(objectKey, recordId))
  return row?.workspaceId === workspaceId ? row : undefined
}

export function syncPaymentSummary(
  workspaceId: string,
  objectKey: string,
  recordId: string
) {
  const row = findRecordRow(workspaceId, objectKey, recordId)
  if (!row) return
  const plan = planOf(workspaceId, objectKey, recordId)
  const summary = planSummary(plan, today())
  const money = (amount: number) =>
    plan ? { amount, currency: summary.currency } : null
  db.records.update(row.id, {
    values: {
      ...row.values,
      serviceFee: plan ? { ...plan.serviceFee } : null,
      paidAmount: money(summary.paid),
      outstandingAmount: money(summary.outstanding),
      paymentStatus: summary.status,
      nextDueDate: summary.nextDueDate,
    },
  })
}

/* ----------------------------------------------------------------------------
 * Stage guards (B8.6, B8.7)
 * ------------------------------------------------------------------------- */

const stageIndex = (stages: readonly string[], stage: string | null) =>
  stage ? stages.indexOf(stage) : -1

/** Entering `gate` (or a later open/won stage) from an earlier one. */
function crosses(
  stages: readonly string[],
  gate: string,
  from: string | null,
  to: string,
  exempt: readonly string[]
) {
  if (exempt.includes(to)) return false
  const gateIndex = stageIndex(stages, gate)
  return (
    stageIndex(stages, to) >= gateIndex && stageIndex(stages, from) < gateIndex
  )
}

function checklistFailure(
  workspaceId: string,
  objectKey: string,
  recordId: string | null
) {
  const items = recordId ? checklistOf(workspaceId, objectKey, recordId) : []
  if (items.length === 0) return null
  const summary = summarizeChecklist(items, today())
  const blocking = [
    ...summary.missing,
    ...summary.outdated.filter((item) => item.required && isItemComplete(item)),
  ]
  if (blocking.length === 0) return null
  const language = workspaceLanguage(workspaceId)
  const names = blocking.map((item) =>
    typeof item.label === "string"
      ? item.label
      : resolveI18nText(item.label, language)
  )
  return {
    code: "CHECKLIST_INCOMPLETE",
    message: tr(workspaceId, "errors.checklistIncomplete", {
      count: names.length,
      items: names.slice(0, 3).join(", "),
    }),
    details: { missing: blocking.map((item) => item.key) },
  }
}

export const enrollmentGuard: StageGuard = ({
  workspaceId,
  recordId,
  from,
  to,
}) =>
  crosses(ENROLLMENT_STAGES, "applied", from, to, ["rejected", "withdrawn"])
    ? checklistFailure(workspaceId, "enrollment", recordId)
    : null

export const visaGuard: StageGuard = ({
  workspaceId,
  recordId,
  from,
  to,
  values,
}) => {
  const exempt = ["cancelled"]
  if (crosses(VISA_STAGES, "appointment_booked", from, to, exempt)) {
    const booked = recordId
      ? recordsOf(workspaceId, "appointment").some(
          (row) =>
            row.values.visaApplicationId === recordId &&
            (row.values.status === "scheduled" ||
              row.values.status === "attended")
        )
      : false
    if (!booked) {
      return {
        code: "APPOINTMENT_REQUIRED",
        message: tr(workspaceId, "errors.appointmentRequired"),
      }
    }
  }
  if (crosses(VISA_STAGES, "submitted", from, to, exempt)) {
    const checklist = checklistFailure(workspaceId, "visaApplication", recordId)
    if (checklist) return checklist
    const applicant = str(values.applicantId)
      ? findRecordRow(workspaceId, "contact", String(values.applicantId))
      : undefined
    const validity = passportValidity(
      (applicant?.values.passport as PassportValue | undefined) ?? null,
      {
        today: today(),
        destination: str(values.destinationCountry),
        returnDate:
          str(values.plannedReturnDate) ?? str(values.plannedTravelDate),
      }
    )
    if (validity !== "ok" && validity !== "expiresSoon") {
      return {
        code: "PASSPORT_VALIDITY",
        message: tr(workspaceId, `errors.passport.${validity}`),
        details: { validity },
      }
    }
  }
  return null
}
