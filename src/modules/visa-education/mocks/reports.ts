import { percentOf, type ReportRow } from "@/engine/reports"
import {
  reportRows,
  type ReportBody,
  type ReportContext,
} from "@/features/reports/mocks/registry"
import { getCountryName } from "@/lib/countries"
import { convertCurrency, roundMoney } from "@/lib/currency"
import { resolveI18nText } from "@/lib/i18n-text"
import { FX_RATES } from "@/mocks/db/fx-rates"

import { toMoney } from "../lib/commission"
import {
  ENROLLMENT_STAGES,
  t,
  VISA_CATEGORY_LABELS,
  type VisaCategory,
} from "../lib/constants"

const TOTAL = t("Toplam", "Total")
const DECIDED = ["approved", "refused"]
const SUBMITTED = ["submitted", "processing", ...DECIDED]

function moneyIn(context: ReportContext) {
  return (value: unknown) => {
    const money = toMoney(value)
    return money
      ? convertCurrency(
          money.amount,
          money.currency,
          context.currency,
          FX_RATES.rates
        )
      : 0
  }
}

const daysBetween = (from: unknown, to: unknown) =>
  typeof from === "string" && typeof to === "string" && from && to
    ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
    : null

/**
 * Visa outcomes per destination and category (TC-8.10-01): submitted files,
 * approvals, refusals, approval rate (of decided files) and the average
 * number of days from submission to decision.
 */
export function buildVisaOutcomes(context: ReportContext): ReportBody {
  const groups = new Map<
    string,
    {
      country: string
      category: string
      submitted: number
      approved: number
      refused: number
      days: number[]
    }
  >()
  for (const row of reportRows(context, "visaApplication")) {
    const stage = String(row.values.stage)
    if (!SUBMITTED.includes(stage)) continue
    const country = String(row.values.destinationCountry ?? "")
    const category = String(row.values.visaCategory ?? "")
    const key = `${country}:${category}`
    const group = groups.get(key) ?? {
      country: getCountryName(country, context.language),
      category: VISA_CATEGORY_LABELS[category as VisaCategory]
        ? resolveI18nText(
            VISA_CATEGORY_LABELS[category as VisaCategory],
            context.language
          )
        : category,
      submitted: 0,
      approved: 0,
      refused: 0,
      days: [],
    }
    group.submitted += 1
    if (stage === "approved") group.approved += 1
    if (stage === "refused") group.refused += 1
    const days = daysBetween(row.values.submissionDate, row.values.decisionDate)
    if (DECIDED.includes(stage) && days !== null && days >= 0) {
      group.days.push(days)
    }
    groups.set(key, group)
  }
  const average = (values: number[]) =>
    values.length
      ? Math.round(
          (values.reduce((sum, value) => sum + value, 0) / values.length) * 10
        ) / 10
      : null
  const rows: ReportRow[] = Array.from(groups.values())
    .sort((a, b) => b.submitted - a.submitted)
    .map(({ days, ...group }) => ({
      ...group,
      approvalRate: percentOf(group.approved, group.approved + group.refused),
      avgDays: average(days),
    }))
  if (!rows.length) return { rows: [], totals: null }
  const all = Array.from(groups.values())
  const sum = (key: "submitted" | "approved" | "refused") =>
    all.reduce((total, group) => total + group[key], 0)
  const approved = sum("approved")
  const refused = sum("refused")
  return {
    rows,
    totals: {
      country: resolveI18nText(TOTAL, context.language),
      category: "",
      submitted: sum("submitted"),
      approved,
      refused,
      approvalRate: percentOf(approved, approved + refused),
      avgDays: average(all.flatMap((group) => group.days)),
    },
  }
}

const FUNNEL = [
  {
    stage: "counselling",
    label: t("Danışmanlık başladı", "Counselling started"),
  },
  { stage: "applied", label: t("Okula başvuruldu", "Applied") },
  { stage: "conditional_offer", label: t("Kabul alındı", "Offer received") },
  {
    stage: "unconditional_offer",
    label: t("Kesin kabul", "Unconditional offer"),
  },
  {
    stage: "confirmation",
    label: t("Onay belgesi (CAS / I-20)", "Confirmation (CAS / I-20)"),
  },
  { stage: "enrolled", label: t("Kayıt tamamlandı", "Enrolled") },
] as const

/** Furthest step a school application reached (lost ones by their dates). */
function reachedStep(values: Record<string, unknown>) {
  const stage = String(values.stage)
  if (stage === "rejected" || stage === "withdrawn") {
    if (values.offerReceivedAt)
      return ENROLLMENT_STAGES.indexOf("conditional_offer")
    if (values.appliedAt) return ENROLLMENT_STAGES.indexOf("applied")
    return 0
  }
  return Math.max(0, ENROLLMENT_STAGES.indexOf(stage as never))
}

/** School application funnel (TC-8.10-02). */
export function buildEnrollmentFunnel(context: ReportContext): ReportBody {
  const files = reportRows(context, "enrollment").map((row) =>
    reachedStep(row.values)
  )
  if (!files.length) return { rows: [], totals: null }
  const counts = FUNNEL.map(
    (step) =>
      files.filter(
        (reached) => reached >= ENROLLMENT_STAGES.indexOf(step.stage)
      ).length
  )
  return {
    rows: FUNNEL.map((step, index) => ({
      stage: resolveI18nText(step.label, context.language),
      count: counts[index]!,
      ofStarted: percentOf(counts[index]!, counts[0]!),
      stepRate: index ? percentOf(counts[index]!, counts[index - 1]!) : null,
    })),
    totals: null,
  }
}

/**
 * Commission per institution (TC-8.10-03): enrolled students' expected
 * commission vs what the school paid, converted to the report currency.
 */
export function buildCommissionByInstitution(
  context: ReportContext
): ReportBody {
  const money = moneyIn(context)
  const names = new Map(
    context.records
      .filter((row) => row.objectKey === "institution")
      .map((row) => [row.id, row])
  )
  const groups = new Map<
    string,
    ReportRow & { expected: number; received: number; enrolled: number }
  >()
  for (const row of reportRows(context, "enrollment")) {
    if (
      row.values.stage !== "enrolled" ||
      !toMoney(row.values.commissionExpected)
    )
      continue
    const id = String(row.values.institutionId ?? "")
    const institution = names.get(id)
    const group = groups.get(id) ?? {
      institution: String(institution?.values.name ?? id),
      country: institution?.values.country
        ? getCountryName(String(institution.values.country), context.language)
        : "",
      enrolled: 0,
      expected: 0,
      received: 0,
    }
    group.enrolled += 1
    group.expected = roundMoney(
      group.expected + money(row.values.commissionExpected)
    )
    group.received = roundMoney(
      group.received + money(row.values.commissionReceived)
    )
    groups.set(id, group)
  }
  const rows = Array.from(groups.values())
    .map((group) => ({
      ...group,
      open: roundMoney(group.expected - group.received),
    }))
    .sort((a, b) => b.expected - a.expected)
  if (!rows.length) return { rows: [], totals: null }
  const sum = (key: "expected" | "received" | "open" | "enrolled") =>
    roundMoney(rows.reduce((total, row) => total + row[key], 0))
  return {
    rows,
    totals: {
      institution: resolveI18nText(TOTAL, context.language),
      country: "",
      enrolled: sum("enrolled"),
      expected: sum("expected"),
      received: sum("received"),
      open: sum("open"),
    },
  }
}

interface OwnerStats {
  leads: number
  enrollments: number
  enrolled: number
  visas: number
  approved: number
  refused: number
  serviceFees: number
  files: number
  billed: number
  collected: number
  outstanding: number
  overdue: number
}

function statsByOwner(context: ReportContext) {
  const money = moneyIn(context)
  const stats = new Map<string, OwnerStats>()
  const of = (ownerId: unknown) => {
    const id = String(ownerId ?? "")
    const current = stats.get(id) ?? {
      leads: 0,
      enrollments: 0,
      enrolled: 0,
      visas: 0,
      approved: 0,
      refused: 0,
      serviceFees: 0,
      files: 0,
      billed: 0,
      collected: 0,
      outstanding: 0,
      overdue: 0,
    }
    stats.set(id, current)
    return current
  }
  for (const row of reportRows(context, "lead"))
    of(row.values.ownerId).leads += 1
  for (const objectKey of ["enrollment", "visaApplication"]) {
    for (const row of reportRows(context, objectKey)) {
      const owner = of(row.values.ownerId)
      if (objectKey === "enrollment") {
        owner.enrollments += 1
        if (row.values.stage === "enrolled") owner.enrolled += 1
      } else {
        owner.visas += 1
        if (row.values.stage === "approved") owner.approved += 1
        if (row.values.stage === "refused") owner.refused += 1
      }
      if (toMoney(row.values.serviceFee)) {
        owner.files += 1
        owner.billed = roundMoney(owner.billed + money(row.values.serviceFee))
        owner.serviceFees = owner.billed
        owner.collected = roundMoney(
          owner.collected + money(row.values.paidAmount)
        )
        owner.outstanding = roundMoney(
          owner.outstanding + money(row.values.outstandingAmount)
        )
        if (row.values.paymentStatus === "overdue") owner.overdue += 1
      }
    }
  }
  return stats
}

/** Counsellor performance (TC-8.10-04: agents see only their own row). */
export function buildCounselorPerformance(context: ReportContext): ReportBody {
  const rows = Array.from(statsByOwner(context).entries())
    .filter(([id]) => id)
    .map(([id, stats]) => ({
      name: context.userName(id),
      leads: stats.leads,
      enrollments: stats.enrollments,
      enrolled: stats.enrolled,
      visas: stats.visas,
      approvalRate: percentOf(stats.approved, stats.approved + stats.refused),
      serviceFees: stats.serviceFees,
    }))
    .sort((a, b) => b.enrolled + b.visas - (a.enrolled + a.visas))
  return { rows, totals: null }
}

/** Collections of service fees per counsellor (B8.8). */
export function buildCollections(context: ReportContext): ReportBody {
  const rows = Array.from(statsByOwner(context).entries())
    .filter(([id, stats]) => id && stats.files > 0)
    .map(([id, stats]) => ({
      name: context.userName(id),
      files: stats.files,
      billed: stats.billed,
      collected: stats.collected,
      outstanding: stats.outstanding,
      overdue: stats.overdue,
    }))
    .sort((a, b) => b.billed - a.billed)
  if (!rows.length) return { rows: [], totals: null }
  const sum = (
    key: "files" | "billed" | "collected" | "outstanding" | "overdue"
  ) => roundMoney(rows.reduce((total, row) => total + row[key], 0))
  return {
    rows,
    totals: {
      name: resolveI18nText(TOTAL, context.language),
      files: sum("files"),
      billed: sum("billed"),
      collected: sum("collected"),
      outstanding: sum("outstanding"),
      overdue: sum("overdue"),
    },
  }
}
