import { describe, expect, it } from "vitest"

import "@/app/modules"

import { validateTemplateDef } from "@/engine/messaging"
import { getMessageTemplates } from "@/engine/modules"
import type { RecordValues } from "@/engine/metadata"
import {
  createRecord,
  moveRecordStage,
} from "@/features/records/api/records.api"
import { fetchReport } from "@/features/reports/api/reports.api"
import type { ReportContext } from "@/features/reports/mocks/registry"
import { db } from "@/mocks/db"
import { FX_RATES } from "@/mocks/db/fx-rates"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { runScheduledChecks } from "@/mocks/scheduler"
import { signInAs } from "@/test/auth"

import { buildVisaEducationDashboard } from "../mocks/dashboard"
import {
  buildCommissionByInstitution,
  buildEnrollmentFunnel,
  buildVisaOutcomes,
} from "../mocks/reports"

const ATLAS = WORKSPACE_IDS.atlas

const dispatchesOf = (triggerId: string, recordId?: string) =>
  db.messageDispatches.findMany(
    (row) =>
      row.workspaceId === ATLAS &&
      row.triggerId === triggerId &&
      (!recordId || row.record.recordId === recordId)
  )

async function applicant(optIn = true) {
  return createRecord("contact", {
    name: "Selin Demir",
    phone: "+905321112233",
    whatsappOptIn: optIn,
    personRoles: ["applicant"],
    passport: {
      number: "U87654321",
      issuingCountry: "TR",
      issuedAt: "2024-01-01",
      expiresAt: "2033-12-31",
    },
  })
}

describe("WhatsApp templates (B8.9)", () => {
  it("TC-8.9-01 every template passes Meta's rules", () => {
    const templates = getMessageTemplates(["visa-education"])
    expect(templates).toHaveLength(12)
    for (const { template } of templates) {
      expect(validateTemplateDef(template), template.name).toEqual([])
      expect(template.name).toMatch(/^ved_[a-z_]+_v\d+$/)
    }
    const names = templates.map(({ template }) => template.name)
    expect(new Set(names).size).toBe(names.length)
    // A refusal is never spelled out.
    const decision = templates.find(
      ({ template }) => template.name === "ved_visa_decision_ready_v1"
    )!.template
    expect(decision.content.tr.body).not.toMatch(/ret|red/i)
  })

  it("TC-8.9-02 a new appointment sends its template when switched on", async () => {
    signInAs("atlasOwner")
    const settings = db.waSettings.findById(`was_${ATLAS}`)!
    db.waSettings.update(settings.id, {
      triggers: {
        ...settings.triggers,
        "visa-education.appointmentScheduled": true,
      },
    })
    const person = await applicant()
    const visa = await createRecord("visaApplication", {
      applicantId: person.id,
      destinationCountry: "NL",
      visaCategory: "tourist_schengen",
    })
    const appointment = await createRecord("appointment", {
      visaApplicationId: visa.id,
      provider: "VFS_GLOBAL",
      city: "ankara",
      scheduledAt: new Date(Date.now() + 9 * 86_400_000).toISOString(),
      kind: "biometrics",
      status: "scheduled",
    })
    const [dispatch] = dispatchesOf(
      "visa-education.appointmentScheduled",
      appointment.id
    )
    expect(dispatch).toMatchObject({ status: "sent" })
    const message = db.messages.findById(
      db.messages.findFirst(
        (row) => row.conversationId === dispatch!.conversationId
      )!.id
    )!
    expect(message.body).toContain("VFS Global · Ankara")

    // Without opt-in the dispatch is skipped and logged.
    const other = await applicant(false)
    const second = await createRecord("visaApplication", {
      applicantId: other.id,
      destinationCountry: "NL",
      visaCategory: "tourist_schengen",
    })
    const skipped = await createRecord("appointment", {
      visaApplicationId: second.id,
      provider: "VFS_GLOBAL",
      city: "ankara",
      scheduledAt: new Date(Date.now() + 9 * 86_400_000).toISOString(),
      kind: "biometrics",
      status: "scheduled",
    })
    expect(
      dispatchesOf("visa-education.appointmentScheduled", skipped.id)[0]
    ).toMatchObject({ status: "skipped" })
  })

  it("TC-8.9-03 a refusal only says that a decision is available", async () => {
    signInAs("atlasOwner")
    const person = await applicant()
    const visa = await createRecord("visaApplication", {
      applicantId: person.id,
      destinationCountry: "FR",
      visaCategory: "tourist_schengen",
    })
    // Submitted earlier (appointment and documents done).
    db.records.update(visa.id, {
      values: { ...db.records.findById(visa.id)!.values, stage: "processing" },
    })
    await moveRecordStage("visaApplication", visa.id, {
      stage: "refused",
      values: { refusalReason: "weak_ties" },
    })
    expect(dispatchesOf("visa-education.visaRefused", visa.id)).toHaveLength(1)
    expect(dispatchesOf("visa-education.visaApproved", visa.id)).toHaveLength(0)
    expect(db.records.findById(visa.id)!.values.decisionDate).toBeTruthy()
  })

  it("TC-8.9-04 / TC-8.8-04 reminders are sent and notified once", async () => {
    signInAs("atlasOwner")
    const person = await applicant()
    const visa = await createRecord("visaApplication", {
      applicantId: person.id,
      destinationCountry: "ES",
      visaCategory: "tourist_schengen",
    })
    const appointment = await createRecord("appointment", {
      visaApplicationId: visa.id,
      provider: "BLS",
      city: "istanbul",
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      kind: "biometrics",
      status: "scheduled",
    })
    runScheduledChecks(ATLAS)
    runScheduledChecks(ATLAS)
    expect(
      dispatchesOf("visa-education.appointmentReminder", appointment.id)
    ).toHaveLength(1)
    expect(
      db.notifications.findMany(
        (row) =>
          row.type === "appointment.upcoming" &&
          row.userId === SEED_USERS.atlasOwner.id &&
          row.dedupeKey.startsWith(`appointment:${appointment.id}`)
      )
    ).toHaveLength(1)

    // Seeded overdue instalments notify their counsellors once.
    const overdue = db.notifications.findMany(
      (row) => row.workspaceId === ATLAS && row.type === "installment.overdue"
    )
    expect(overdue.length).toBeGreaterThan(0)
    expect(new Set(overdue.map((row) => row.dedupeKey)).size).toBe(
      overdue.length
    )
  })

  it("TC-8.9-05 forwarding templates of Acme are unchanged", () => {
    const acme = db.waTemplates.findMany(
      (row) => row.workspaceId === WORKSPACE_IDS.acme
    )
    expect(acme).toHaveLength(20)
    expect(acme.every((row) => row.id.startsWith("wat_acme_fwd_"))).toBe(true)
    expect(
      db.waTemplates.findMany((row) => row.workspaceId === ATLAS)
    ).toHaveLength(24)
  })
})

describe("automation seed (B8.9)", () => {
  it("TC-8.9-06 an unconditional offer creates the deposit follow-up once", async () => {
    signInAs("atlasOwner")
    const enrollment = db.records.findFirst(
      (row) =>
        row.workspaceId === ATLAS &&
        row.objectKey === "enrollment" &&
        row.values.stage === "conditional_offer"
    )!
    const tasksBefore = db.tasks.count()
    await moveRecordStage("enrollment", enrollment.id, {
      stage: "unconditional_offer",
    })
    await moveRecordStage("enrollment", enrollment.id, {
      stage: "conditional_offer",
    })
    await moveRecordStage("enrollment", enrollment.id, {
      stage: "unconditional_offer",
    })
    expect(db.tasks.count()).toBe(tasksBefore + 1)
    expect(
      db.automationRuns.findMany(
        (row) =>
          row.ruleId === "aut_atlas_offer_deposit" &&
          row.record?.recordId === enrollment.id
      )
    ).toHaveLength(1)
  })
})

/* ------------------------------------------------------------- reports */

let seq = 0
const row = (objectKey: string, values: RecordValues) => ({
  id: `r${++seq}`,
  objectKey,
  values: { createdAt: "2026-09-10T08:00:00.000Z", ownerId: "u1", ...values },
})

const context = (
  records: ReportContext["records"],
  overrides: Partial<ReportContext> = {}
): ReportContext => ({
  records,
  range: { from: "2026-09-01", to: "2026-09-30" },
  ownerId: null,
  language: "tr",
  currency: "USD",
  userName: (id) => ({ u1: "Ece", u2: "Onur" })[id] ?? id,
  objectDef: () => undefined,
  ...overrides,
})

describe("visa & education reports (B8.10)", () => {
  it("TC-8.10-01 approval rate of decided files and days to decision", () => {
    const visa = (stage: string, values: RecordValues = {}) =>
      row("visaApplication", {
        stage,
        destinationCountry: "FR",
        visaCategory: "tourist_schengen",
        submissionDate: "2026-09-01",
        ...values,
      })
    const { rows, totals } = buildVisaOutcomes(
      context([
        visa("approved", { decisionDate: "2026-09-11" }),
        visa("approved", { decisionDate: "2026-09-21" }),
        visa("refused", { decisionDate: "2026-09-16" }),
        visa("processing"),
        visa("documents"),
        visa("approved", {
          destinationCountry: "GB",
          visaCategory: "student",
          decisionDate: "2026-09-04",
        }),
      ])
    )
    expect(rows[0]).toMatchObject({
      country: "Fransa",
      category: "Turistik (Schengen)",
      submitted: 4,
      approved: 2,
      refused: 1,
      approvalRate: 66.7,
      avgDays: 15,
    })
    expect(totals).toMatchObject({
      submitted: 5,
      approved: 3,
      approvalRate: 75,
    })
  })

  it("TC-8.10-02 school application funnel counts the furthest step", () => {
    const enrollment = (stage: string, values: RecordValues = {}) =>
      row("enrollment", { stage, ...values })
    const { rows } = buildEnrollmentFunnel(
      context([
        enrollment("counselling"),
        enrollment("applied"),
        enrollment("conditional_offer"),
        enrollment("enrolled"),
        enrollment("rejected", { appliedAt: "2026-09-12" }),
        enrollment("withdrawn", {
          appliedAt: "2026-09-12",
          offerReceivedAt: "2026-09-20",
        }),
      ])
    )
    expect(rows.map((item) => item.count)).toEqual([6, 5, 3, 1, 1, 1])
    expect(rows[1]).toMatchObject({ ofStarted: 83.3, stepRate: 83.3 })
  })

  it("TC-8.10-03 commission converts to the report currency", () => {
    const institution = {
      id: "ins1",
      objectKey: "institution",
      values: { name: "Northbridge University", country: "GB" },
    }
    const enrolled = (expected: number, received: number | null) =>
      row("enrollment", {
        stage: "enrolled",
        institutionId: "ins1",
        commissionExpected: { amount: expected, currency: "GBP" },
        commissionReceived:
          received === null ? null : { amount: received, currency: "GBP" },
      })
    const { rows, totals } = buildCommissionByInstitution(
      context([institution, enrolled(3000, 3000), enrolled(1580, null)])
    )
    const usd = (gbp: number) =>
      Math.round((gbp / FX_RATES.rates.GBP) * 100) / 100
    expect(rows[0]).toMatchObject({
      institution: "Northbridge University",
      country: "Birleşik Krallık",
      enrolled: 2,
      received: usd(3000),
    })
    expect(rows[0]!.expected).toBeCloseTo(usd(3000) + usd(1580), 2)
    expect(totals!.open).toBeCloseTo(usd(1580), 2)
  })

  it("TC-8.10-04 agents only see their own files", async () => {
    signInAs("atlasVisa")
    const result = await fetchReport("counselorPerformance", {
      from: "2025-01-01",
      to: "2026-12-31",
      ownerId: SEED_USERS.atlasManager.id,
    })
    expect(result.rows.map((item) => item.name)).toEqual(["Onur Aksoy"])
  })

  it("TC-8.10-06 module reports and dashboard are gone without the module", async () => {
    signInAs("owner")
    await expect(
      fetchReport("visaOutcomes", { from: "2026-01-01", to: "2026-12-31" })
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe("dashboard (B8.10)", () => {
  it("TC-8.10-05 aggregates stages, approvals, lists and the intake forecast", () => {
    const now = "2026-10-15T09:00:00.000Z"
    const records = [
      row("lead", { stage: "new", serviceType: "education" }),
      row("lead", { stage: "converted", serviceType: "visa" }),
      row("contact", { name: "Selin" }),
      row("visaApplication", { stage: "approved" }),
      row("visaApplication", { stage: "refused" }),
      row("visaApplication", {
        stage: "documents",
        missingDocuments: 3,
        applicationNumber: "VSA-1",
      }),
      row("enrollment", {
        stage: "enrolled",
        intake: { year: 2027, month: 9 },
        commissionExpected: { amount: 100, currency: "USD" },
      }),
      row("appointment", {
        status: "scheduled",
        title: "VFS Global · İstanbul",
        scheduledAt: "2026-10-17T07:00:00.000Z",
      }),
      row("appointment", {
        status: "scheduled",
        title: "Later",
        scheduledAt: "2026-11-30T07:00:00.000Z",
      }),
    ]
    const dashboard = buildVisaEducationDashboard({
      records,
      plans: [],
      range: { from: "2026-09-01", to: "2026-09-30" },
      now,
      currency: "USD",
      rates: FX_RATES.rates,
    })
    expect(dashboard.openInquiries).toEqual({
      total: 1,
      byService: [{ service: "education", count: 1 }],
    })
    expect(dashboard.approvalRate).toEqual({
      approved: 1,
      refused: 1,
      rate: 50,
    })
    expect(
      dashboard.enrollmentsByStage.find((item) => item.stage === "enrolled")
    ).toEqual({ stage: "enrolled", count: 1 })
    expect(dashboard.upcomingAppointments.map((item) => item.title)).toEqual([
      "VFS Global · İstanbul",
    ])
    expect(dashboard.missingDocuments[0]).toMatchObject({
      number: "VSA-1",
      missing: 3,
    })
    expect(dashboard.intakeForecast).toEqual([
      { year: 2027, month: 9, count: 1 },
    ])
    expect(dashboard.commission).toEqual({ expected: 100, received: 0 })

    const empty = buildVisaEducationDashboard({
      records: [],
      plans: [],
      range: { from: "2026-09-01", to: "2026-09-30" },
      now,
      currency: "USD",
      rates: FX_RATES.rates,
    })
    expect(empty.approvalRate.rate).toBeNull()
  })
})

describe("counsellor reports (B8.10)", () => {
  const file = (objectKey: string, values: RecordValues) =>
    row(objectKey, { ownerId: "u1", ...values })

  it("collections and counsellor performance per owner", async () => {
    const { buildCollections, buildCounselorPerformance } =
      await import("../mocks/reports")
    const records = [
      file("lead", {}),
      file("enrollment", {
        stage: "enrolled",
        serviceFee: { amount: 1000, currency: "USD" },
        paidAmount: { amount: 600, currency: "USD" },
        outstandingAmount: { amount: 400, currency: "USD" },
        paymentStatus: "overdue",
      }),
      file("visaApplication", { stage: "approved" }),
      file("visaApplication", { stage: "refused", ownerId: "u2" }),
    ]
    expect(buildCollections(context(records))).toEqual({
      rows: [
        {
          name: "Ece",
          files: 1,
          billed: 1000,
          collected: 600,
          outstanding: 400,
          overdue: 1,
        },
      ],
      totals: {
        name: "Toplam",
        files: 1,
        billed: 1000,
        collected: 600,
        outstanding: 400,
        overdue: 1,
      },
    })
    expect(buildCounselorPerformance(context(records)).rows).toEqual([
      {
        name: "Ece",
        leads: 1,
        enrollments: 1,
        enrolled: 1,
        visas: 1,
        approvalRate: 100,
        serviceFees: 1000,
      },
      {
        name: "Onur",
        leads: 0,
        enrollments: 0,
        enrolled: 0,
        visas: 1,
        approvalRate: 0,
        serviceFees: 0,
      },
    ])
    expect(buildCollections(context([])).rows).toEqual([])
  })
})
