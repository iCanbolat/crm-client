import type { ObjectDef, RecordValues } from "@/engine/metadata"
import type { Condition } from "@/engine/logic"
import {
  createSeededFaker,
  MOCK_REFERENCE_DATE,
  type SeededFaker,
} from "@/mocks/db/faker"
import { getRecordOwners, SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"

import type { ViewState } from "../api/records.schemas"
import { coreObjects, INDUSTRIES, LEAD_SOURCES } from "./core-objects"

/* ----------------------------------------------------------------------------
 * Stored shapes (tenant scoped)
 * ------------------------------------------------------------------------- */

export interface ObjectRow {
  /** `${workspaceId}:${objectKey}` */
  id: string
  workspaceId: string
  def: ObjectDef
}

export interface RecordRow {
  id: string
  workspaceId: string
  objectKey: string
  values: RecordValues
}

export interface ViewRow {
  id: string
  workspaceId: string
  objectKey: string
  name: string
  ownerId: string
  shared: boolean
  state: ViewState
  createdAt: string
}

export interface ViewPrefRow {
  /** `${workspaceId}:${userId}:${objectKey}` */
  id: string
  defaultViewId: string | null
}

export interface AttachmentRow {
  id: string
  workspaceId: string
  objectKey: string
  recordId: string
  name: string
  size: number
  mimeType: string
  uploadedBy: string
  uploadedAt: string
  category?: string | null
}

export interface UploadRow {
  id: string
  workspaceId: string
  name: string
  size: number
  mimeType: string
  uploadedAt: string
}

export const objectRowId = (workspaceId: string, objectKey: string) =>
  `${workspaceId}:${objectKey}`

/* ----------------------------------------------------------------------------
 * Metadata
 * ------------------------------------------------------------------------- */

export function seedObjects(): ObjectRow[] {
  return Object.values(WORKSPACE_IDS).flatMap((workspaceId) =>
    coreObjects().map((def) => ({
      id: objectRowId(workspaceId, def.key),
      workspaceId,
      def,
    }))
  )
}

/* ----------------------------------------------------------------------------
 * Records
 * ------------------------------------------------------------------------- */

export const RECORD_SEED_COUNTS = {
  [WORKSPACE_IDS.acme]: { company: 60, contact: 150, lead: 200, deal: 80 },
  [WORKSPACE_IDS.marmara]: { company: 12, contact: 20, lead: 25, deal: 10 },
} as const

const ID_PREFIX: Record<string, string> = {
  company: "cmp",
  contact: "con",
  lead: "led",
  deal: "dea",
  quote: "quo",
  shipment: "shp",
}

export function newRecordId(objectKey: string) {
  const prefix = ID_PREFIX[objectKey] ?? objectKey.slice(0, 3)
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`
}

/** "Çağrı Öztürk" → "cagri.ozturk" */
export function asciiSlug(text: string, separator = ".") {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "")
}

const COUNTRY_WEIGHTS = [
  { weight: 12, value: "TR" },
  { weight: 3, value: "DE" },
  { weight: 2, value: "NL" },
  { weight: 1, value: "GB" },
  { weight: 1, value: "IT" },
  { weight: 1, value: "AE" },
  { weight: 1, value: "CN" },
  { weight: 1, value: "US" },
]

const CURRENCY_WEIGHTS = [
  { weight: 4, value: "TRY" },
  { weight: 3, value: "USD" },
  { weight: 3, value: "EUR" },
]

const TAG_VALUES = ["vip", "hot", "cold", "followUp", "partner"]

function seedId(faker: SeededFaker, objectKey: string) {
  return `${ID_PREFIX[objectKey]}_${faker.string.alphanumeric({ length: 12, casing: "lower" })}`
}

function timestamps(faker: SeededFaker) {
  const createdAt = faker.date.past({ years: 1 })
  const updatedAt = faker.date.between({
    from: createdAt,
    to: MOCK_REFERENCE_DATE,
  })
  return {
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }
}

function tags(faker: SeededFaker) {
  return (
    faker.helpers.maybe(
      () => faker.helpers.arrayElements(TAG_VALUES, { min: 1, max: 2 }),
      { probability: 0.35 }
    ) ?? null
  )
}

function mobilePhone(faker: SeededFaker) {
  return `+905${faker.string.numeric(9)}`
}

function money(faker: SeededFaker, min: number, max: number) {
  return {
    amount: faker.number.int({ min: min / 1000, max: max / 1000 }) * 1000,
    currency: faker.helpers.weightedArrayElement(CURRENCY_WEIGHTS),
  }
}

/**
 * WhatsApp consent (Faz 6): two of every three people opted in when the
 * record was created. Derived from the index so faker sequences stay put.
 */
function withOptIn(index: number, record: RecordRow): RecordRow {
  const optIn = index % 3 !== 2
  return {
    ...record,
    values: {
      ...record.values,
      whatsappOptIn: optIn,
      whatsappOptInAt: optIn ? record.values.createdAt : null,
    },
  }
}

function seedWorkspaceRecords(
  workspaceId: keyof typeof RECORD_SEED_COUNTS
): RecordRow[] {
  const counts = RECORD_SEED_COUNTS[workspaceId]
  const owners = getRecordOwners(workspaceId)
  const row = (
    objectKey: string,
    id: string,
    values: RecordValues
  ): RecordRow => ({
    id,
    workspaceId,
    objectKey,
    values,
  })

  // One faker per object keeps each object's data stable on its own.
  const fc = createSeededFaker(`records:${workspaceId}:company`)
  const companies = Array.from({ length: counts.company }, () => {
    const name = fc.company.name()
    const domain = `${asciiSlug(name, "-").slice(0, 24)}.com.tr`
    const country = fc.helpers.weightedArrayElement(COUNTRY_WEIGHTS)
    return row("company", seedId(fc, "company"), {
      name,
      domain: `https://${domain}`,
      industry: fc.helpers.arrayElement(INDUSTRIES).value,
      email: `info@${domain}`,
      phone: mobilePhone(fc),
      country,
      city: fc.location.city(),
      taxNumber: fc.string.numeric(10),
      employees: fc.number.int({ min: 5, max: 2500 }),
      annualRevenue:
        fc.helpers.maybe(() => money(fc, 1_000_000, 90_000_000), {
          probability: 0.7,
        }) ?? null,
      description:
        fc.helpers.maybe(() => fc.lorem.sentence(), { probability: 0.3 }) ??
        null,
      ownerId: fc.helpers.arrayElement(owners),
      tags: tags(fc),
      ...timestamps(fc),
    })
  })

  const fp = createSeededFaker(`records:${workspaceId}:contact`)
  const contacts = Array.from({ length: counts.contact }, (_, index) => {
    const name = fp.person.fullName()
    const company = fp.helpers.arrayElement(companies)
    const domain = String(company.values.email).split("@")[1]
    return withOptIn(
      index,
      row("contact", seedId(fp, "contact"), {
        name,
        title: fp.person.jobTitle(),
        companyId: company.id,
        email: `${asciiSlug(name)}@${domain}`,
        phone: mobilePhone(fp),
        country: company.values.country,
        ownerId: company.values.ownerId,
        tags: tags(fp),
        ...timestamps(fp),
      })
    )
  })

  const fl = createSeededFaker(`records:${workspaceId}:lead`)
  const leads = Array.from({ length: counts.lead }, (_, index) => {
    const name = fl.person.fullName()
    const companyName = fl.company.name()
    const stage = fl.helpers.weightedArrayElement([
      { weight: 7, value: "new" },
      { weight: 5, value: "contacted" },
      { weight: 4, value: "qualified" },
      { weight: 2, value: "converted" },
      { weight: 2, value: "lost" },
    ])
    return withOptIn(
      index,
      row("lead", seedId(fl, "lead"), {
        name,
        companyName,
        email: `${asciiSlug(name)}@${asciiSlug(companyName, "-").slice(0, 20)}.com`,
        phone: mobilePhone(fl),
        country: fl.helpers.weightedArrayElement(COUNTRY_WEIGHTS),
        source: fl.helpers.arrayElement(LEAD_SOURCES).value,
        stage,
        lostReason:
          stage === "lost"
            ? fl.helpers.arrayElement([
                "price",
                "noResponse",
                "notQualified",
                "competitor",
                "other",
              ])
            : null,
        estimatedValue:
          fl.helpers.maybe(() => money(fl, 5_000, 400_000), {
            probability: 0.6,
          }) ?? null,
        message:
          fl.helpers.maybe(() => fl.lorem.sentences(2), { probability: 0.5 }) ??
          null,
        ownerId: fl.helpers.arrayElement(owners),
        tags: tags(fl),
        ...timestamps(fl),
      })
    )
  })

  const fd = createSeededFaker(`records:${workspaceId}:deal`)
  const PROBABILITY: Record<string, number> = {
    qualification: 20,
    proposal: 40,
    negotiation: 70,
    won: 100,
    lost: 0,
  }
  const deals = Array.from({ length: counts.deal }, () => {
    const company = fd.helpers.arrayElement(companies)
    const contact = contacts.find(
      (item) => item.values.companyId === company.id
    )
    const stage = fd.helpers.weightedArrayElement([
      { weight: 5, value: "qualification" },
      { weight: 4, value: "proposal" },
      { weight: 3, value: "negotiation" },
      { weight: 2, value: "won" },
      { weight: 2, value: "lost" },
    ])
    const topic = fd.helpers.arrayElement([
      "İhracat sözleşmesi",
      "İthalat projesi",
      "Yıllık taşıma anlaşması",
      "Konteyner taşıma",
      "Parsiyel taşıma",
      "Proje kargo",
    ])
    return row("deal", seedId(fd, "deal"), {
      name: `${company.values.name} — ${topic}`,
      companyId: company.id,
      contactId: contact?.id ?? null,
      amount: money(fd, 10_000, 1_500_000),
      stage,
      probability: PROBABILITY[stage] ?? 0,
      closeDate: fd.date
        .soon({
          days: 120,
          refDate: new Date(MOCK_REFERENCE_DATE.getTime() - 30 * 86_400_000),
        })
        .toISOString()
        .slice(0, 10),
      lostReason:
        stage === "lost"
          ? fd.helpers.arrayElement([
              "price",
              "timing",
              "competitor",
              "noDecision",
              "other",
            ])
          : null,
      description: null,
      ownerId: company.values.ownerId,
      tags: tags(fd),
      ...timestamps(fd),
    })
  })

  return [...companies, ...contacts, ...leads, ...deals]
}

let recordSeedCache: RecordRow[] | null = null

/** Deterministic and cached: the collection clones what it loads. */
export function seedRecords(): RecordRow[] {
  recordSeedCache ??= [
    ...seedWorkspaceRecords(WORKSPACE_IDS.acme),
    ...seedWorkspaceRecords(WORKSPACE_IDS.marmara),
  ]
  return recordSeedCache
}

/* ----------------------------------------------------------------------------
 * Saved views
 * ------------------------------------------------------------------------- */

const createdAt = (daysAgo: number) =>
  new Date(MOCK_REFERENCE_DATE.getTime() - daysAgo * 86_400_000).toISOString()

const inStages = (stages: string[], op: Condition["op"] = "in"): Condition => ({
  field: "stage",
  op,
  value: stages,
})

export const SEED_VIEW_IDS = {
  qualifiedLeads: "view_qualified_leads",
  openDeals: "view_open_deals",
} as const

export function seedViews(): ViewRow[] {
  return [
    {
      id: SEED_VIEW_IDS.qualifiedLeads,
      workspaceId: WORKSPACE_IDS.acme,
      objectKey: "lead",
      name: "Nitelikli lead'ler",
      ownerId: SEED_USERS.manager.id,
      shared: true,
      state: {
        filters: [inStages(["qualified"])],
        sort: { field: "createdAt", direction: "desc" },
      },
      createdAt: createdAt(40),
    },
    {
      id: SEED_VIEW_IDS.openDeals,
      workspaceId: WORKSPACE_IDS.acme,
      objectKey: "deal",
      name: "Açık fırsatlar",
      ownerId: SEED_USERS.admin.id,
      shared: true,
      state: {
        filters: [inStages(["won", "lost"], "notIn")],
        sort: { field: "closeDate", direction: "asc" },
      },
      createdAt: createdAt(25),
    },
  ]
}
