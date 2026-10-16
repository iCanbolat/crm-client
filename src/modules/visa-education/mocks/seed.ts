import type { TaskRow } from "@/features/activities/mocks/factory"
import type { RecordRow, ViewRow } from "@/features/records/mocks/factory"
import {
  createSeededFaker,
  MOCK_REFERENCE_DATE,
  type SeededFaker,
} from "@/mocks/db/faker"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"

import {
  buildChecklist,
  templateKeyFor,
  type ChecklistContext,
} from "../lib/checklist-templates"
import { summarizeChecklist } from "../lib/checklist"
import { computeCommission, toMoney, type Money } from "../lib/commission"
import {
  APPOINTMENT_CITY_LABELS,
  APPOINTMENT_PROVIDER_LABELS,
  defaultConfirmationDoc,
  OFFER_STAGES,
  type AppointmentCity,
  type AppointmentProvider,
  type ChecklistStatus,
  type CommissionBasis,
  type EnrollmentStage,
  type VisaCategory,
  type VisaStage,
} from "../lib/constants"
import { formatFileNumber } from "../lib/numbering"
import { addDays, addMonths } from "../lib/passport"
import { planSummary, type Installment } from "../lib/payments"
import { seedCatalog } from "./catalog"
import type { ChecklistItemRow, PaymentPlanRow } from "./types"

/**
 * Atlas Yurtdışı Eğitim (Faz 8): applicants, enquiries, school and visa
 * applications, appointments, checklists and payment plans. Deterministic;
 * appointments and instalments are offset from the real "today" (like the
 * seeded tasks) so the demo always has upcoming and overdue items.
 */

const WS = WORKSPACE_IDS.atlas
const DAY = 86_400_000
const REF = MOCK_REFERENCE_DATE.getTime()

const refIso = (daysAgo: number) => new Date(REF - daysAgo * DAY).toISOString()
const refDay = (daysAgo: number) => refIso(daysAgo).slice(0, 10)

const OWNER = SEED_USERS.atlasOwner.id
const MANAGER = SEED_USERS.atlasManager.id
const EDUCATION = SEED_USERS.atlasEducation.id
const VISA = SEED_USERS.atlasVisa.id

const EDU_OWNERS = [EDUCATION, EDUCATION, EDUCATION, MANAGER]
const VISA_OWNERS = [VISA, VISA, VISA, MANAGER]
const ALL_OWNERS = [OWNER, MANAGER, EDUCATION, VISA]

export const VISA_EDUCATION_SEED_COUNTS = {
  applicants: 140,
  sponsors: 40,
  leads: 160,
  enrollments: 90,
  visas: 110,
}

const TR_UNIVERSITIES = [
  "Boğaziçi Üniversitesi",
  "İstanbul Teknik Üniversitesi",
  "Ankara Üniversitesi",
  "Ege Üniversitesi",
  "Hacettepe Üniversitesi",
  "Yıldız Teknik Üniversitesi",
  "Marmara Üniversitesi",
  "Dokuz Eylül Üniversitesi",
  "Bilkent Üniversitesi",
  "Koç Üniversitesi",
]

const TR_HIGH_SCHOOLS = [
  "Kadıköy Anadolu Lisesi",
  "Ankara Fen Lisesi",
  "İzmir Bornova Anadolu Lisesi",
  "Bursa Anadolu Lisesi",
  "Antalya Fen Lisesi",
]

const ascii = (text: string) =>
  text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "")

const pad = (value: number) => String(value).padStart(3, "0")

const timestamps = (daysAgo: number, updatedDaysAgo = daysAgo) => ({
  createdAt: refIso(daysAgo),
  updatedAt: refIso(Math.min(daysAgo, updatedDaysAgo)),
})

function phone(faker: SeededFaker) {
  return `+905${faker.string.numeric({ length: 9, allowLeadingZeros: true })}`
}

function languageScores(faker: SeededFaker, strong: boolean) {
  const exam = faker.helpers.weightedArrayElement([
    { weight: 6, value: "IELTS" as const },
    { weight: 2, value: "TOEFL" as const },
    { weight: 1, value: "PTE" as const },
    { weight: 1, value: "DUOLINGO" as const },
    { weight: 1, value: "GOETHE" as const },
  ])
  const testDate = refDay(faker.number.int({ min: 20, max: 700 }))
  if (exam === "GOETHE") {
    return [
      { exam, level: faker.helpers.arrayElement(["B1", "B2", "C1"]), testDate },
    ]
  }
  const overall = {
    IELTS: faker.helpers.arrayElement(strong ? [6.5, 7, 7.5] : [5.5, 6, 6.5]),
    TOEFL: faker.number.int({ min: strong ? 90 : 70, max: strong ? 110 : 92 }),
    PTE: faker.number.int({ min: strong ? 62 : 50, max: strong ? 78 : 64 }),
    DUOLINGO: faker.helpers.arrayElement(
      strong ? [115, 120, 125] : [95, 100, 105]
    ),
  }[exam]
  return [{ exam, overall, testDate }]
}

function educationHistory(faker: SeededFaker, age: number) {
  const graduation = 2026 - Math.max(0, age - 22)
  if (age < 20) {
    return [
      {
        level: "high_school",
        institution: faker.helpers.arrayElement(TR_HIGH_SCHOOLS),
        country: "TR",
        field: null,
        gpa: faker.number.int({ min: 70, max: 96 }),
        gpaScale: 100,
        graduationYear: 2026,
      },
    ]
  }
  return [
    {
      level: "bachelor",
      institution: faker.helpers.arrayElement(TR_UNIVERSITIES),
      country: "TR",
      field: faker.helpers.arrayElement([
        "İşletme",
        "Bilgisayar Mühendisliği",
        "Ekonomi",
        "Psikoloji",
        "Makine Mühendisliği",
        "Mimarlık",
      ]),
      gpa: Math.round(faker.number.float({ min: 2.3, max: 3.8 }) * 100) / 100,
      gpaScale: 4,
      graduationYear: graduation,
    },
  ]
}

function passport(faker: SeededFaker, expiringSoon: boolean) {
  const issuedDaysAgo = expiringSoon
    ? 3650 - faker.number.int({ min: 30, max: 160 })
    : faker.number.int({ min: 60, max: 2900 })
  const issuedAt = refDay(issuedDaysAgo)
  return {
    number: `U${faker.string.numeric({ length: 8, allowLeadingZeros: true })}`,
    issuingCountry: "TR",
    issuedAt,
    expiresAt: addMonths(issuedAt, 120),
  }
}

/* ---------------------------------------------------------------- people */

interface Person {
  row: RecordRow
  age: number
}

function seedPeople(faker: SeededFaker) {
  const sponsors: RecordRow[] = []
  for (let index = 0; index < VISA_EDUCATION_SEED_COUNTS.sponsors; index++) {
    const name = faker.person.fullName()
    const daysAgo = faker.number.int({ min: 30, max: 260 })
    sponsors.push({
      id: `con_atl_s${pad(index + 1)}`,
      workspaceId: WS,
      objectKey: "contact",
      values: {
        name,
        title: null,
        companyId: null,
        email: `${ascii(name)}@example.com`,
        phone: phone(faker),
        country: "TR",
        whatsappOptIn: false,
        whatsappOptInAt: null,
        personRoles: ["parent_sponsor"],
        ownerId: faker.helpers.arrayElement(ALL_OWNERS),
        tags: [],
        ...timestamps(daysAgo),
      },
    })
  }

  const applicants: Person[] = []
  for (let index = 0; index < VISA_EDUCATION_SEED_COUNTS.applicants; index++) {
    const name = faker.person.fullName()
    const age = faker.number.int({ min: 17, max: 34 })
    const daysAgo = faker.number.int({ min: 5, max: 280 })
    const optIn = faker.datatype.boolean({ probability: 0.85 })
    applicants.push({
      age,
      row: {
        id: `con_atl_${pad(index + 1)}`,
        workspaceId: WS,
        objectKey: "contact",
        values: {
          name,
          title: null,
          companyId: null,
          email: `${ascii(name)}${index}@example.com`,
          phone: phone(faker),
          country: "TR",
          whatsappOptIn: optIn,
          whatsappOptInAt: optIn ? refIso(daysAgo) : null,
          personRoles: ["applicant"],
          dateOfBirth: refDay(
            age * 365 + faker.number.int({ min: 0, max: 360 })
          ),
          nationality: "TR",
          passport:
            faker.helpers.maybe(() => passport(faker, index % 23 === 0), {
              probability: 0.9,
            }) ?? null,
          languageScores:
            faker.helpers.maybe(
              () => languageScores(faker, faker.datatype.boolean()),
              { probability: 0.75 }
            ) ?? null,
          educationHistory: educationHistory(faker, age),
          sponsorId:
            index < VISA_EDUCATION_SEED_COUNTS.sponsors * 2 && index % 2 === 0
              ? sponsors[index / 2]!.id
              : null,
          ownerId: faker.helpers.arrayElement(ALL_OWNERS),
          tags:
            faker.helpers.maybe(() => ["scholarship"], { probability: 0.08 }) ??
            [],
          ...timestamps(daysAgo),
        },
      },
    })
  }
  return { sponsors, applicants }
}

/* ----------------------------------------------------------------- leads */

const PROFILE_KEYS = [
  "dateOfBirth",
  "nationality",
  "passport",
  "languageScores",
  "educationHistory",
] as const

function seedLeads(faker: SeededFaker, applicants: Person[]) {
  const leads: RecordRow[] = []
  /** Applicant id → converted lead id. */
  const leadOf = new Map<string, string>()
  for (let index = 0; index < VISA_EDUCATION_SEED_COUNTS.leads; index++) {
    const serviceType = faker.helpers.weightedArrayElement([
      { weight: 55, value: "education" },
      { weight: 30, value: "visa" },
      { weight: 15, value: "both" },
    ])
    const stage = faker.helpers.weightedArrayElement([
      { weight: 35, value: "new" },
      { weight: 30, value: "contacted" },
      { weight: 25, value: "qualified" },
      { weight: 50, value: "converted" },
      { weight: 20, value: "lost" },
    ])
    const converted =
      stage === "converted"
        ? applicants[leadOf.size % applicants.length]
        : undefined
    const education = serviceType !== "visa"
    const name = converted
      ? String(converted.row.values.name)
      : faker.person.fullName()
    const daysAgo = faker.number.int({ min: 1, max: 300 })
    const id = `led_atl_${pad(index + 1)}`
    if (converted) leadOf.set(converted.row.id, id)
    const profile = converted
      ? Object.fromEntries(
          PROFILE_KEYS.map((key) => [key, converted.row.values[key] ?? null])
        )
      : {
          dateOfBirth: null,
          nationality: "TR",
          passport: null,
          languageScores:
            faker.helpers.maybe(() => languageScores(faker, false), {
              probability: 0.3,
            }) ?? null,
          educationHistory: null,
        }
    leads.push({
      id,
      workspaceId: WS,
      objectKey: "lead",
      values: {
        name,
        companyName: null,
        email:
          converted?.row.values.email ?? `${ascii(name)}.${index}@example.com`,
        phone: converted?.row.values.phone ?? phone(faker),
        country: "TR",
        whatsappOptIn: faker.datatype.boolean({ probability: 0.7 }),
        whatsappOptInAt: null,
        source: faker.helpers.weightedArrayElement([
          { weight: 8, value: "webForm" },
          { weight: 4, value: "referral" },
          { weight: 3, value: "phone" },
          { weight: 2, value: "email" },
          { weight: 2, value: "fair" },
          { weight: 1, value: "other" },
        ]),
        stage,
        lostReason:
          stage === "lost"
            ? faker.helpers.arrayElement([
                "price",
                "noResponse",
                "notQualified",
                "competitor",
                "other",
              ])
            : null,
        estimatedValue: {
          amount: education
            ? faker.helpers.arrayElement([45000, 60000, 75000, 90000])
            : faker.helpers.arrayElement([6000, 8500, 12000, 25000]),
          currency: "TRY",
        },
        message: null,
        serviceType,
        targetCountries: faker.helpers.arrayElements(
          education
            ? ["GB", "US", "CA", "DE", "IE", "NL", "AU", "IT"]
            : ["DE", "FR", "IT", "ES", "NL", "GB", "US"],
          { min: 1, max: 2 }
        ),
        studyLevel: education
          ? faker.helpers.arrayElement([
              "master",
              "master",
              "bachelor",
              "language_course",
              "foundation",
            ])
          : null,
        fieldOfStudy: education
          ? faker.helpers.arrayElement([
              "business",
              "computer_science",
              "data_science",
              "engineering",
              "psychology",
            ])
          : null,
        desiredIntake: education
          ? {
              year: faker.helpers.arrayElement([2027, 2027, 2028]),
              month: faker.helpers.arrayElement([1, 9, 9]),
            }
          : null,
        budgetPerYear: education
          ? {
              amount: faker.helpers.arrayElement([15000, 20000, 25000, 35000]),
              currency: faker.helpers.arrayElement(["EUR", "GBP", "USD"]),
            }
          : null,
        visaCategory:
          serviceType === "education"
            ? null
            : serviceType === "both"
              ? "student"
              : faker.helpers.weightedArrayElement([
                  { weight: 6, value: "tourist_schengen" },
                  { weight: 1, value: "tourist_other" },
                  { weight: 1, value: "business" },
                  { weight: 1, value: "work" },
                  { weight: 1, value: "family_reunification" },
                ]),
        plannedTravelDate: refDay(-faker.number.int({ min: 20, max: 300 })),
        ...profile,
        convertedCompanyId: null,
        convertedContactId: converted?.row.id ?? null,
        convertedDealId: null,
        ownerId: faker.helpers.arrayElement(
          education ? EDU_OWNERS : VISA_OWNERS
        ),
        tags: [],
        ...timestamps(daysAgo),
      },
    })
  }
  return { leads, leadOf }
}

/* ------------------------------------------------------------ checklists */

function checklistFor(
  faker: SeededFaker,
  row: RecordRow,
  context: ChecklistContext,
  completion: number,
  now: string,
  today: string
): ChecklistItemRow[] {
  const templateKey = templateKeyFor(row.objectKey, row.values)
  if (!templateKey) return []
  return buildChecklist(templateKey, context).map((item, index) => {
    const done = faker.number.float({ min: 0, max: 1 }) < completion
    const status: ChecklistStatus = done
      ? item.required || faker.datatype.boolean()
        ? "approved"
        : "not_applicable"
      : completion >= 1
        ? "approved"
        : faker.helpers.weightedArrayElement([
            { weight: 4, value: "missing" as const },
            { weight: 3, value: "requested" as const },
            { weight: 2, value: "received" as const },
            { weight: 1, value: "rejected" as const },
          ])
    const hasFile = status === "approved" || status === "received"
    return {
      id: `chk_${row.id}_${item.key}`,
      workspaceId: WS,
      objectKey: row.objectKey,
      recordId: row.id,
      key: item.key,
      label: item.label,
      category: item.category,
      required: item.required,
      status,
      attachmentId: null,
      expiresAt: null,
      // Received recently (real today): fresh enough for `maxAgeDays`.
      documentDate: hasFile
        ? addDays(today, -faker.number.int({ min: 1, max: 20 }))
        : null,
      maxAgeDays: item.maxAgeDays ?? null,
      note:
        status === "rejected" ? "Okunaklı değil, yeniden yüklenmeli." : null,
      requestedAt:
        status === "requested"
          ? refIso(faker.number.int({ min: 1, max: 14 }))
          : null,
      updatedAt: now,
      updatedBy: null,
      sort: index,
      custom: false,
    }
  })
}

function withChecklistSummary(
  row: RecordRow,
  items: ChecklistItemRow[],
  today: string
) {
  if (items.length === 0) return
  const summary = summarizeChecklist(items, today)
  row.values.checklistProgress = Math.round(summary.progress * 100)
  row.values.missingDocuments = summary.missing.length
}

/* -------------------------------------------------------- payment plans */

function planFor(
  faker: SeededFaker,
  row: RecordRow,
  fee: Money,
  today: string,
  overdue: boolean
): PaymentPlanRow {
  const count = faker.helpers.arrayElement([1, 2, 3, 3, 4])
  const firstDue = addDays(
    today,
    overdue
      ? -faker.number.int({ min: 10, max: 60 })
      : faker.number.int({ min: -120, max: 20 })
  )
  const base = Math.floor(fee.amount / count)
  const installments: Installment[] = Array.from(
    { length: count },
    (_, index) => {
      const dueDate = addMonths(firstDue, index)
      const amount =
        index === count - 1 ? fee.amount - base * (count - 1) : base
      const past = dueDate < today
      const paid = past && !(overdue && index === 0)
      return {
        id: `ins_${index + 1}`,
        label: String(index + 1),
        dueDate,
        amount,
        paidAmount: paid ? amount : 0,
        paidAt: paid ? dueDate : null,
        method: paid
          ? faker.helpers.arrayElement(["transfer", "card", "cash"] as const)
          : null,
        note: null,
      }
    }
  )
  return {
    id: `${row.objectKey}:${row.id}`,
    workspaceId: WS,
    objectKey: row.objectKey,
    recordId: row.id,
    serviceFee: fee,
    installments,
    updatedAt: refIso(1),
  }
}

function withPaymentSummary(
  row: RecordRow,
  plan: PaymentPlanRow,
  today: string
) {
  const summary = planSummary(plan, today)
  const money = (amount: number) => ({ amount, currency: summary.currency })
  row.values.serviceFee = { ...plan.serviceFee }
  row.values.paidAmount = money(summary.paid)
  row.values.outstandingAmount = money(summary.outstanding)
  row.values.paymentStatus = summary.status
  row.values.nextDueDate = summary.nextDueDate
}

/* --------------------------------------------------------- applications */

const ENROLLMENT_PLAN: [EnrollmentStage, number][] = [
  ["counselling", 8],
  ["documents", 12],
  ["applied", 12],
  ["conditional_offer", 8],
  ["unconditional_offer", 8],
  ["confirmation", 7],
  ["enrolled", 25],
  ["rejected", 5],
  ["withdrawn", 5],
]

const VISA_PLAN: [VisaStage, number][] = [
  ["consultation", 12],
  ["documents", 20],
  ["appointment_booked", 18],
  ["submitted", 12],
  ["processing", 13],
  ["approved", 25],
  ["refused", 7],
  ["cancelled", 3],
]

const SCHENGEN_DESTINATIONS = ["FR", "DE", "IT", "ES", "NL", "GR", "AT", "CH"]

const expand = <T>(plan: [T, number][]) =>
  plan.flatMap(([stage, count]) => Array.from({ length: count }, () => stage))

const STAGE_COMPLETION: Record<string, number> = {
  counselling: 0.1,
  consultation: 0.1,
  documents: 0.55,
  appointment_booked: 0.85,
  cancelled: 0.3,
  withdrawn: 0.4,
}

const PROVIDERS: Record<string, AppointmentProvider> = {
  DE: "IDATA",
  IT: "IDATA",
  FR: "VFS_GLOBAL",
  NL: "VFS_GLOBAL",
  AT: "VFS_GLOBAL",
  CH: "VFS_GLOBAL",
  GB: "TLSCONTACT",
  ES: "BLS",
  GR: "VFS_GLOBAL",
  US: "EMBASSY",
  CA: "VFS_GLOBAL",
  AU: "VFS_GLOBAL",
  IE: "VFS_GLOBAL",
}

export interface VisaEducationSeed {
  records: RecordRow[]
  views: ViewRow[]
  tasks: TaskRow[]
  checklistItems: ChecklistItemRow[]
  paymentPlans: PaymentPlanRow[]
}

let cache: VisaEducationSeed | null = null

export function seedVisaEducation(): VisaEducationSeed {
  if (cache) return cache
  const faker = createSeededFaker("visa:atlas")
  const realToday = new Date().toISOString().slice(0, 10)
  const now = refIso(0)

  const catalog = seedCatalog(WS, MANAGER)
  const institutionById = new Map(
    catalog.institutions.map((row) => [row.id, row])
  )
  const { sponsors, applicants } = seedPeople(faker)
  const { leads, leadOf } = seedLeads(faker, applicants)
  const checklistItems: ChecklistItemRow[] = []
  const paymentPlans: PaymentPlanRow[] = []
  let overdueBudget = 12

  const contextOf = (applicantId: string, program?: RecordRow) => ({
    hasSponsor: Boolean(
      applicants.find((person) => person.row.id === applicantId)?.row.values
        .sponsorId
    ),
    fieldOfStudy: (program?.values.fieldOfStudy as string | undefined) ?? null,
  })

  /* enrolments */
  const enrollments: RecordRow[] = []
  const universityPrograms = catalog.programs.filter(
    (row) => row.values.studyLevel !== "language_course"
  )
  expand(ENROLLMENT_PLAN).forEach((stage, index) => {
    const applicant = applicants[index]!
    const program = faker.helpers.arrayElement(
      index % 5 === 0 ? catalog.programs : universityPrograms
    )
    const institution = institutionById.get(
      String(program.values.institutionId)
    )!
    const stageIndex = ENROLLMENT_PLAN.findIndex(([key]) => key === stage)
    const daysAgo = faker.number.int({
      min: 20 + stageIndex * 12,
      max: 60 + stageIndex * 25,
    })
    const intakeMonths = program.values.intakeMonths as string[]
    const tuition = toMoney(program.values.tuitionFee)
    const scholarship =
      tuition && faker.datatype.boolean({ probability: 0.2 })
        ? {
            amount: Math.round(tuition.amount * 0.2),
            currency: tuition.currency,
          }
        : null
    const rate = (institution.values.commissionRate as number | null) ?? null
    const commission = computeCommission({
      tuition,
      scholarship,
      rate,
      basis:
        (institution.values.commissionBasis as CommissionBasis | null) ?? null,
      flat: toMoney(institution.values.flatCommission),
      durationMonths: program.values.durationMonths as number,
    })
    const offer = OFFER_STAGES.includes(stage)
    const applied = offer || stage === "applied" || stage === "rejected"
    const confirmed = stage === "confirmation" || stage === "enrolled"
    const country = String(program.values.country)
    const commissionStatus =
      stage === "enrolled" && commission
        ? faker.helpers.weightedArrayElement([
            { weight: 5, value: "received" },
            { weight: 3, value: "claimed" },
            { weight: 2, value: "expected" },
          ])
        : "none"
    const row: RecordRow = {
      id: `enr_atl_${pad(index + 1)}`,
      workspaceId: WS,
      objectKey: "enrollment",
      values: {
        enrollmentNumber: formatFileNumber("ENR", 2026, index + 1),
        applicantId: applicant.row.id,
        programId: program.id,
        institutionId: institution.id,
        country,
        studyLevel: program.values.studyLevel,
        intake: {
          year: stage === "enrolled" ? 2026 : 2027,
          month: Number(faker.helpers.arrayElement(intakeMonths)),
        },
        stage,
        appliedAt: applied ? refDay(daysAgo - 10) : null,
        offerReceivedAt: offer ? refDay(Math.max(1, daysAgo - 30)) : null,
        offerConditions:
          stage === "conditional_offer"
            ? "IELTS 6.5 (her bölümden min. 6.0) ve diploma aslı."
            : null,
        confirmationDocType: defaultConfirmationDoc(country),
        confirmationNumber: confirmed
          ? `${defaultConfirmationDoc(country)}-${faker.string.alphanumeric({ length: 10, casing: "upper" })}`
          : null,
        depositPaid: confirmed,
        tuitionFee: tuition,
        scholarship,
        commissionRate: rate,
        commissionExpected: commission,
        commissionStatus,
        commissionReceived: commissionStatus === "received" ? commission : null,
        commissionReceivedAt:
          commissionStatus === "received"
            ? refDay(faker.number.int({ min: 5, max: 60 }))
            : null,
        rejectionReason:
          stage === "rejected"
            ? faker.helpers.arrayElement(["academic", "language", "capacity"])
            : null,
        withdrawReason:
          stage === "withdrawn"
            ? faker.helpers.arrayElement([
                "budget",
                "other_school",
                "postponed",
              ])
            : null,
        visaApplicationId: null,
        leadId: leadOf.get(applicant.row.id) ?? null,
        paymentStatus: "none",
        notes: null,
        ownerId: EDU_OWNERS[index % EDU_OWNERS.length]!,
        tags: [],
        ...timestamps(daysAgo, faker.number.int({ min: 1, max: 20 })),
      },
    }
    const items = checklistFor(
      faker,
      row,
      contextOf(applicant.row.id, program),
      STAGE_COMPLETION[stage] ?? 1,
      now,
      realToday
    )
    checklistItems.push(...items)
    withChecklistSummary(row, items, realToday)
    if (
      stage !== "counselling" &&
      faker.datatype.boolean({ probability: 0.6 })
    ) {
      const plan = planFor(
        faker,
        row,
        {
          amount: faker.helpers.arrayElement([45000, 60000, 75000, 90000]),
          currency: "TRY",
        },
        realToday,
        overdueBudget-- > 0 && index % 4 === 1
      )
      paymentPlans.push(plan)
      withPaymentSummary(row, plan, realToday)
    }
    enrollments.push(row)
  })

  /* visa applications */
  const visas: RecordRow[] = []
  const appointments: RecordRow[] = []
  const studentSources = enrollments.filter((row) =>
    ["confirmation", "enrolled"].includes(String(row.values.stage))
  )
  const categories: VisaCategory[] = [
    ...Array<VisaCategory>(45).fill("student"),
    ...Array<VisaCategory>(40).fill("tourist_schengen"),
    ...Array<VisaCategory>(12).fill("work"),
    ...Array<VisaCategory>(13).fill("family_reunification"),
  ]
  const stages = faker.helpers.shuffle(expand(VISA_PLAN))
  categories.forEach((category, index) => {
    const enrollment =
      category === "student" ? studentSources[index] : undefined
    let stage = stages[index]!
    if (enrollment) {
      stage =
        enrollment.values.stage === "enrolled"
          ? "approved"
          : faker.helpers.arrayElement([
              "documents",
              "appointment_booked",
              "submitted",
            ] as const)
    }
    const applicant = enrollment
      ? applicants.find(
          (person) => person.row.id === enrollment.values.applicantId
        )!
      : applicants[(index * 7 + 11) % applicants.length]!
    const destination = enrollment
      ? String(enrollment.values.country)
      : category === "tourist_schengen" || category === "family_reunification"
        ? faker.helpers.arrayElement(SCHENGEN_DESTINATIONS)
        : category === "work"
          ? faker.helpers.arrayElement(["DE", "NL", "GB", "CA"])
          : faker.helpers.arrayElement(["GB", "US", "CA", "DE", "IE"])
    const stageIndex = VISA_PLAN.findIndex(([key]) => key === stage)
    const daysAgo = faker.number.int({
      min: 10 + stageIndex * 8,
      max: 40 + stageIndex * 15,
    })
    const travel = refDay(-faker.number.int({ min: 20, max: 180 }))
    const decided = stage === "approved" || stage === "refused"
    const submitted = decided || stage === "submitted" || stage === "processing"
    const id = `vis_atl_${pad(index + 1)}`
    const row: RecordRow = {
      id,
      workspaceId: WS,
      objectKey: "visaApplication",
      values: {
        applicationNumber: formatFileNumber("VSA", 2026, index + 1),
        applicantId: applicant.row.id,
        destinationCountry: destination,
        visaCategory: category,
        visaSubtype:
          category === "student"
            ? ({
                GB: "Student route",
                US: "F-1",
                CA: "Study permit",
                DE: "D-Visum (Studium)",
              }[destination] ?? null)
            : category === "tourist_schengen"
              ? "C (kısa süreli)"
              : null,
        stage,
        purpose: null,
        plannedTravelDate: travel,
        plannedReturnDate:
          category === "tourist_schengen"
            ? addDays(travel, faker.number.int({ min: 5, max: 21 }))
            : null,
        nextAppointmentAt: null,
        submissionDate: submitted ? refDay(Math.max(1, daysAgo - 15)) : null,
        decisionDate: decided ? refDay(Math.max(0, daysAgo - 30)) : null,
        visaValidFrom: stage === "approved" ? travel : null,
        visaValidUntil:
          stage === "approved"
            ? addMonths(
                travel,
                category === "student"
                  ? 12
                  : category === "tourist_schengen"
                    ? 3
                    : 24
              )
            : null,
        entries:
          stage === "approved"
            ? faker.helpers.arrayElement(["single", "multiple"])
            : null,
        refusalReason:
          stage === "refused"
            ? faker.helpers.arrayElement([
                "insufficient_funds",
                "purpose_unclear",
                "weak_ties",
                "documents",
              ])
            : null,
        withdrawReason: stage === "cancelled" ? "postponed" : null,
        enrollmentId: enrollment?.id ?? null,
        leadId: leadOf.get(applicant.row.id) ?? null,
        paymentStatus: "none",
        notes: null,
        ownerId: VISA_OWNERS[index % VISA_OWNERS.length]!,
        tags: [],
        ...timestamps(daysAgo, faker.number.int({ min: 0, max: 10 })),
      },
    }
    if (enrollment) enrollment.values.visaApplicationId = id

    const items = checklistFor(
      faker,
      row,
      contextOf(applicant.row.id),
      STAGE_COMPLETION[stage] ?? 1,
      now,
      realToday
    )
    checklistItems.push(...items)
    withChecklistSummary(row, items, realToday)

    if (stageIndex >= 2 && stage !== "cancelled") {
      const provider = PROVIDERS[destination] ?? "VFS_GLOBAL"
      const city = faker.helpers.weightedArrayElement<AppointmentCity>([
        { weight: 6, value: "istanbul" },
        { weight: 3, value: "ankara" },
        { weight: 2, value: "izmir" },
        { weight: 1, value: "antalya" },
      ])
      const upcoming = stage === "appointment_booked"
      const at = new Date(
        Date.parse(
          `${addDays(realToday, upcoming ? faker.number.int({ min: 1, max: 21 }) : -faker.number.int({ min: 10, max: 60 }))}T00:00:00Z`
        ) +
          faker.helpers.arrayElement([7, 8, 9, 10, 11, 12]) * 3_600_000
      ).toISOString()
      appointments.push({
        id: `app_atl_${pad(appointments.length + 1)}`,
        workspaceId: WS,
        objectKey: "appointment",
        values: {
          title: `${APPOINTMENT_PROVIDER_LABELS[provider].tr} · ${APPOINTMENT_CITY_LABELS[city].tr}`,
          visaApplicationId: id,
          applicantId: applicant.row.id,
          provider,
          city,
          country: destination,
          scheduledAt: at,
          kind: provider === "EMBASSY" ? "interview" : "biometrics",
          status: upcoming ? "scheduled" : "attended",
          referenceNo: faker.string.alphanumeric({
            length: 8,
            casing: "upper",
          }),
          notes: null,
          ownerId: row.values.ownerId,
          tags: [],
          ...timestamps(Math.max(1, daysAgo - 5)),
        },
      })
      if (upcoming) row.values.nextAppointmentAt = at
    }

    if (
      stage !== "consultation" &&
      faker.datatype.boolean({ probability: 0.55 })
    ) {
      const fee =
        category === "tourist_schengen"
          ? faker.helpers.arrayElement([6000, 7500, 9000])
          : category === "student"
            ? 15000
            : 25000
      const plan = planFor(
        faker,
        row,
        { amount: fee, currency: "TRY" },
        realToday,
        overdueBudget-- > 0 && index % 3 === 0
      )
      paymentPlans.push(plan)
      withPaymentSummary(row, plan, realToday)
    }
    visas.push(row)
  })

  const tasks = seedTasks(faker, [...enrollments, ...visas])

  cache = {
    records: [
      ...catalog.institutions,
      ...catalog.programs,
      ...sponsors,
      ...applicants.map((person) => person.row),
      ...leads,
      ...enrollments,
      ...visas,
      ...appointments,
    ],
    views: seedViews(),
    tasks,
    checklistItems,
    paymentPlans,
  }
  return cache
}

/* ----------------------------------------------------------------- tasks */

const TASK_TITLES = [
  "Ön görüşme yap",
  "Eksik belgeleri hatırlat",
  "Niyet mektubunu gözden geçir",
  "Okula başvuruyu gönder",
  "Konsolosluk randevusu al",
  "Banka dökümünü kontrol et",
  "Kabul mektubunu öğrenciye ilet",
  "Depozito ödemesini takip et",
]

function seedTasks(faker: SeededFaker, records: RecordRow[]): TaskRow[] {
  const today = new Date()
  const owners = [MANAGER, EDUCATION, VISA, OWNER]
  return Array.from({ length: 30 }, (_, index) => {
    const record = faker.helpers.arrayElement(records)
    const offset =
      index < owners.length ? 0 : faker.number.int({ min: -6, max: 12 })
    const done =
      index >= owners.length && faker.datatype.boolean({ probability: 0.2 })
    const due = new Date(today.getTime() + offset * DAY)
    return {
      id: `tsk_atlas_${pad(index + 1)}`,
      workspaceId: WS,
      title: faker.helpers.arrayElement(TASK_TITLES),
      description: null,
      dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
      priority: faker.helpers.arrayElement(["low", "medium", "high"] as const),
      status: done ? "done" : "open",
      assigneeId: owners[index % owners.length]!,
      completedAt: done ? new Date(today.getTime() - DAY).toISOString() : null,
      related: { objectKey: record.objectKey, recordId: record.id },
      createdBy: MANAGER,
      createdAt: refIso(faker.number.int({ min: 1, max: 30 })),
    } satisfies TaskRow
  })
}

/* ----------------------------------------------------------------- views */

export const VISA_EDUCATION_VIEW_IDS = {
  missingDocuments: "view_atlas_missing_documents",
  overduePayments: "view_atlas_overdue_payments",
  refusedVisas: "view_atlas_refused_visas",
  scheduledAppointments: "view_atlas_scheduled_appointments",
} as const

function seedViews(): ViewRow[] {
  const base = {
    workspaceId: WS,
    ownerId: MANAGER,
    shared: true,
    createdAt: refIso(20),
  }
  return [
    {
      ...base,
      id: VISA_EDUCATION_VIEW_IDS.missingDocuments,
      objectKey: "visaApplication",
      name: "Eksik belgesi olanlar",
      state: {
        filters: [
          { field: "missingDocuments", op: "gt", value: 0 },
          {
            field: "stage",
            op: "notIn",
            value: ["approved", "refused", "cancelled"],
          },
        ],
        sort: { field: "missingDocuments", direction: "desc" },
      },
    },
    {
      ...base,
      id: VISA_EDUCATION_VIEW_IDS.overduePayments,
      objectKey: "enrollment",
      name: "Geciken ödemeler",
      state: {
        filters: [{ field: "paymentStatus", op: "in", value: ["overdue"] }],
        sort: { field: "nextDueDate", direction: "asc" },
      },
    },
    {
      ...base,
      id: VISA_EDUCATION_VIEW_IDS.refusedVisas,
      objectKey: "visaApplication",
      name: "Ret alan vize başvuruları",
      state: {
        filters: [{ field: "stage", op: "in", value: ["refused"] }],
        sort: { field: "decisionDate", direction: "desc" },
      },
    },
    {
      ...base,
      id: VISA_EDUCATION_VIEW_IDS.scheduledAppointments,
      objectKey: "appointment",
      name: "Planlanmış randevular",
      state: {
        filters: [{ field: "status", op: "in", value: ["scheduled"] }],
        sort: { field: "scheduledAt", direction: "asc" },
      },
    },
  ]
}
