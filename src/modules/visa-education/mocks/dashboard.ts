import type { RecordValues } from "@/engine/metadata"
import { convertCurrency, roundMoney, type FxRates } from "@/lib/currency"

import type { VisaEducationDashboard } from "../api/dashboard.schemas"
import { toMoney } from "../lib/commission"
import { ENROLLMENT_STAGES, VISA_STAGES } from "../lib/constants"
import { toIntake } from "../lib/intake"
import { isInstallmentPaid } from "../lib/payments"
import type { PaymentPlanRow } from "./types"

interface SourceRow {
  id: string
  objectKey: string
  values: RecordValues
}

export interface DashboardInput {
  records: readonly SourceRow[]
  plans: readonly PaymentPlanRow[]
  range: { from: string; to: string }
  /** Real "now" (ISO) for upcoming / overdue items. */
  now: string
  currency: string
  rates: FxRates
}

const OPEN_LEAD_STAGES = ["new", "contacted", "qualified"]
const OPEN_FILE_STAGES = new Set([
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

const day = (value: unknown) =>
  typeof value === "string" && value ? value.slice(0, 10) : ""

/**
 * Aggregates of the visa & education dashboard (B8.10, TC-8.10-05). Files
 * created in the range feed the stage charts and the approval rate;
 * appointments, missing documents and overdue instalments are "now" lists.
 */
export function buildVisaEducationDashboard(
  input: DashboardInput
): VisaEducationDashboard {
  const { records, range, now, currency, rates } = input
  const today = now.slice(0, 10)
  const inRange = (row: SourceRow) => {
    const created = day(row.values.createdAt)
    return created >= range.from && created <= range.to
  }
  const of = (objectKey: string) =>
    records.filter((row) => row.objectKey === objectKey)
  const byId = new Map(records.map((row) => [row.id, row]))
  const applicantName = (values: RecordValues) => {
    const applicant = byId.get(String(values.applicantId ?? ""))
    return applicant ? String(applicant.values.name ?? "") : null
  }
  const numberOf = (row: SourceRow) =>
    String(
      row.values.enrollmentNumber ?? row.values.applicationNumber ?? row.id
    )
  const usd = (value: unknown) => {
    const money = toMoney(value)
    return money
      ? convertCurrency(money.amount, money.currency, currency, rates)
      : 0
  }

  const leads = of("lead").filter(
    (row) => OPEN_LEAD_STAGES.includes(String(row.values.stage)) && inRange(row)
  )
  const services = new Map<string, number>()
  for (const row of leads) {
    const service = String(row.values.serviceType ?? "unknown")
    services.set(service, (services.get(service) ?? 0) + 1)
  }

  const enrollments = of("enrollment").filter(inRange)
  const visas = of("visaApplication").filter(inRange)
  const count = (rows: SourceRow[], stages: readonly string[]) =>
    stages.map((stage) => ({
      stage,
      count: rows.filter((row) => row.values.stage === stage).length,
    }))
  const approved = visas.filter((row) => row.values.stage === "approved").length
  const refused = visas.filter((row) => row.values.stage === "refused").length

  const weekAhead = new Date(Date.parse(now) + 7 * 86_400_000).toISOString()
  const upcomingAppointments = of("appointment")
    .filter((row) => {
      const at = String(row.values.scheduledAt ?? "")
      return row.values.status === "scheduled" && at >= now && at <= weekAhead
    })
    .sort((a, b) =>
      String(a.values.scheduledAt).localeCompare(String(b.values.scheduledAt))
    )
    .map((row) => ({
      id: row.id,
      title: String(row.values.title ?? ""),
      scheduledAt: String(row.values.scheduledAt),
      applicant: applicantName(row.values),
    }))

  const missingDocuments = [...of("enrollment"), ...of("visaApplication")]
    .filter(
      (row) =>
        OPEN_FILE_STAGES.has(String(row.values.stage)) &&
        typeof row.values.missingDocuments === "number" &&
        row.values.missingDocuments > 0
    )
    .sort(
      (a, b) =>
        Number(b.values.missingDocuments) - Number(a.values.missingDocuments)
    )
    .slice(0, 8)
    .map((row) => ({
      objectKey: row.objectKey,
      id: row.id,
      number: numberOf(row),
      applicant: applicantName(row.values),
      missing: Number(row.values.missingDocuments),
    }))

  const overdueInstallments = input.plans
    .flatMap((plan) => {
      const row = byId.get(plan.recordId)
      if (!row) return []
      return plan.installments
        .filter((item) => !isInstallmentPaid(item) && item.dueDate < today)
        .map((item) => ({
          objectKey: plan.objectKey,
          id: plan.recordId,
          number: numberOf(row),
          applicant: applicantName(row.values),
          amount: {
            amount: roundMoney(item.amount - item.paidAmount),
            currency: plan.serviceFee.currency,
          },
          dueDate: item.dueDate,
        }))
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8)

  // Students with an offer, per intake (all time: intakes lie ahead).
  const intakes = new Map<
    number,
    { year: number; month: number; count: number }
  >()
  const offered = ENROLLMENT_STAGES.indexOf("unconditional_offer")
  for (const row of of("enrollment")) {
    const index = ENROLLMENT_STAGES.indexOf(row.values.stage as never)
    const intake = toIntake(row.values.intake)
    if (
      !intake ||
      index < offered ||
      index > ENROLLMENT_STAGES.indexOf("enrolled")
    )
      continue
    const key = intake.year * 100 + intake.month
    const item = intakes.get(key) ?? { ...intake, count: 0 }
    item.count += 1
    intakes.set(key, item)
  }

  let expected = 0
  let received = 0
  for (const row of enrollments) {
    if (row.values.stage !== "enrolled") continue
    expected += usd(row.values.commissionExpected)
    received += usd(row.values.commissionReceived)
  }

  return {
    range,
    currency,
    openInquiries: {
      total: leads.length,
      byService: Array.from(services, ([service, value]) => ({
        service,
        count: value,
      })),
    },
    approvalRate: {
      approved,
      refused,
      rate:
        approved + refused
          ? Math.round((approved / (approved + refused)) * 1000) / 10
          : null,
    },
    enrollmentsByStage: count(enrollments, ENROLLMENT_STAGES),
    visasByStage: count(visas, VISA_STAGES),
    upcomingAppointments,
    missingDocuments,
    overdueInstallments,
    intakeForecast: Array.from(intakes.entries())
      .sort(([a], [b]) => a - b)
      .map(([, item]) => item),
    commission: {
      expected: roundMoney(expected),
      received: roundMoney(received),
    },
  }
}
