import type { RecordValues } from "@/engine/metadata"
import type { RecordRow, ViewRow } from "@/features/records/mocks/factory"
import {
  createSeededFaker,
  MOCK_REFERENCE_DATE,
  type SeededFaker,
} from "@/mocks/db/faker"
import {
  getRecordOwners,
  SEED_USERS,
  seedWorkspaces,
  WORKSPACE_IDS,
} from "@/mocks/db/seed"

import type { QuoteInput } from "../api/quotes.schemas"
import type { LocationValue } from "../api/reference.schemas"
import { calcCbm, calcChargeableWeight, type DimensionLine } from "../lib/cargo"
import {
  PIECE_MODES,
  type ChargeCode,
  type Milestone,
  type QuoteStatus,
  type TransportMode,
  type UnitBasis,
} from "../lib/constants"
import { getDelay } from "../lib/milestones"
import { calcLineQuantity, formatQuoteNumber } from "../lib/quote"
import { DEAL_STAGE_MAP } from "../metadata/extend"
import { quoteRecordValues } from "./quote-logic"
import { CARRIERS, FX_RATES } from "./reference/carriers"
import { location } from "./reference/locations"
import type { MilestoneRow, QuoteVersionRow } from "./types"

/**
 * Forwarding seed (Faz 3): enriches the core records of workspaces that use
 * the module (company types, freight requests, forwarding deal stages) and
 * adds partners, quotes, shipments and milestone histories. Deterministic.
 */

const DAY = 86_400_000
const REF_DAY = MOCK_REFERENCE_DATE.toISOString().slice(0, 10)

const daysFromRef = (days: number) =>
  new Date(MOCK_REFERENCE_DATE.getTime() + days * DAY)
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

export const FORWARDING_SEED_COUNTS = {
  [WORKSPACE_IDS.acme]: { agents: 20, quotes: 120, shipments: 90 },
  [WORKSPACE_IDS.marmara]: { agents: 4, quotes: 12, shipments: 8 },
} as const

/* ------------------------------------------------------------------ lanes */

interface Lane {
  mode: TransportMode
  origin: string
  destination: string
  weight: number
}

export const LANES: Lane[] = [
  { mode: "SEA_FCL", origin: "TRIST", destination: "DEHAM", weight: 8 },
  { mode: "SEA_FCL", origin: "TRMER", destination: "NLRTM", weight: 7 },
  { mode: "SEA_FCL", origin: "TRIZM", destination: "ITGOA", weight: 4 },
  { mode: "SEA_FCL", origin: "TRGEM", destination: "BEANR", weight: 3 },
  { mode: "SEA_FCL", origin: "TRMER", destination: "AEJEA", weight: 4 },
  { mode: "SEA_FCL", origin: "TRIST", destination: "USNYC", weight: 3 },
  { mode: "SEA_FCL", origin: "CNSHA", destination: "TRAMB", weight: 6 },
  { mode: "SEA_FCL", origin: "CNNGB", destination: "TRMER", weight: 4 },
  { mode: "SEA_FCL", origin: "KRPUS", destination: "TRIST", weight: 2 },
  { mode: "SEA_LCL", origin: "TRIST", destination: "DEHAM", weight: 3 },
  { mode: "SEA_LCL", origin: "CNSHA", destination: "TRIST", weight: 3 },
  { mode: "SEA_LCL", origin: "TRIZM", destination: "ESVLC", weight: 2 },
  { mode: "AIR", origin: "IST", destination: "FRA", weight: 4 },
  { mode: "AIR", origin: "IST", destination: "JFK", weight: 2 },
  { mode: "AIR", origin: "PVG", destination: "IST", weight: 3 },
  { mode: "AIR", origin: "IST", destination: "DXB", weight: 2 },
  { mode: "ROAD_FTL", origin: "TRBUR", destination: "DEDUS", weight: 5 },
  { mode: "ROAD_FTL", origin: "TRKCO", destination: "ITMIL", weight: 3 },
  { mode: "ROAD_LTL", origin: "TRCOR", destination: "FRLYS", weight: 2 },
  { mode: "ROAD_LTL", origin: "TRMAN", destination: "PLLOD", weight: 2 },
  { mode: "ROAD_FTL", origin: "TRGZT", destination: "IQEBL", weight: 3 },
  { mode: "RAIL", origin: "TRKCO", destination: "DEDUI", weight: 1 },
  { mode: "COURIER", origin: "IST", destination: "LHR", weight: 1 },
]

const TRANSIT_DAYS: Record<TransportMode, [number, number]> = {
  SEA_FCL: [9, 35],
  SEA_LCL: [12, 38],
  AIR: [1, 4],
  ROAD_FTL: [3, 8],
  ROAD_LTL: [4, 10],
  RAIL: [14, 22],
  MULTIMODAL: [18, 40],
  COURIER: [1, 3],
}

const COMMODITIES = [
  { name: "Tekstil ürünleri", hs: "6109.10" },
  { name: "Otomotiv yedek parça", hs: "8708.99" },
  { name: "Beyaz eşya", hs: "8418.10" },
  { name: "Makine aksamı", hs: "8483.40" },
  { name: "Kuru meyve", hs: "0806.20" },
  { name: "Seramik karo", hs: "6907.21" },
  { name: "Plastik granül", hs: "3901.10" },
  { name: "Elektronik ekipman", hs: "8471.30" },
  { name: "Mobilya", hs: "9403.60" },
  { name: "Kimyasal (boya)", hs: "3208.10" },
]

const pickLane = (faker: SeededFaker) =>
  faker.helpers.weightedArrayElement(
    LANES.map((lane) => ({ weight: lane.weight, value: lane }))
  )

const carrierKind = (mode: TransportMode) =>
  mode === "AIR" || mode === "COURIER"
    ? "air"
    : mode.startsWith("ROAD") || mode === "RAIL"
      ? "road"
      : "sea"

function pickCarrier(faker: SeededFaker, mode: TransportMode) {
  const kind = carrierKind(mode)
  return faker.helpers.arrayElement(
    CARRIERS.filter((item) => item.kind === kind)
  )
}

/* ------------------------------------------------------------------ cargo */

interface Cargo {
  commodity: string
  hsCode: string
  containers: { type: string; count: number }[] | null
  dimensions: DimensionLine[] | null
  packageCount: number
  grossKg: number
  cbm: number
  chargeableKg: number
}

function buildCargo(faker: SeededFaker, mode: TransportMode): Cargo {
  const commodity = faker.helpers.arrayElement(COMMODITIES)
  if (mode === "SEA_FCL") {
    const type = faker.helpers.arrayElement(["20DC", "40DC", "40HC", "40HC"])
    const count = faker.number.int({ min: 1, max: 4 })
    const grossKg = count * faker.number.int({ min: 8, max: 22 }) * 1000
    const cbm = count * (type === "20DC" ? 28 : 60)
    return {
      commodity: commodity.name,
      hsCode: commodity.hs,
      containers: [{ type, count }],
      dimensions: null,
      packageCount: count * faker.number.int({ min: 10, max: 40 }),
      grossKg,
      cbm,
      chargeableKg: grossKg,
    }
  }
  if (PIECE_MODES.includes(mode)) {
    const quantity = faker.number.int({ min: 1, max: mode === "AIR" ? 6 : 12 })
    const dimensions: DimensionLine[] = [
      {
        length: faker.helpers.arrayElement([120, 100, 80]),
        width: faker.helpers.arrayElement([80, 100, 60]),
        height: faker.number.int({ min: 60, max: 160 }),
        quantity,
      },
    ]
    const cbm = calcCbm(dimensions)
    const grossKg = Math.round(cbm * faker.number.int({ min: 90, max: 420 }))
    return {
      commodity: commodity.name,
      hsCode: commodity.hs,
      containers: null,
      dimensions,
      packageCount: quantity,
      grossKg,
      cbm,
      chargeableKg: calcChargeableWeight(mode, grossKg, cbm).value,
    }
  }
  const grossKg = faker.number.int({ min: 6, max: 24 }) * 1000
  return {
    commodity: commodity.name,
    hsCode: commodity.hs,
    containers: null,
    dimensions: null,
    packageCount: faker.number.int({ min: 10, max: 33 }),
    grossKg,
    cbm: faker.number.int({ min: 30, max: 90 }),
    chargeableKg: grossKg,
  }
}

/* ---------------------------------------------------------------- charges */

interface ChargeTemplate {
  code: ChargeCode
  basis: UnitBasis
  /** Selling price range per unit. */
  sell: [number, number]
  currency: string
}

const CHARGES: Record<TransportMode, ChargeTemplate[]> = {
  SEA_FCL: [
    { code: "OFR", basis: "container", sell: [900, 3200], currency: "USD" },
    { code: "BAF", basis: "container", sell: [150, 450], currency: "USD" },
    { code: "THC_O", basis: "container", sell: [180, 260], currency: "EUR" },
    { code: "ISPS", basis: "container", sell: [15, 25], currency: "EUR" },
    { code: "DOC", basis: "shipment", sell: [60, 90], currency: "EUR" },
  ],
  SEA_LCL: [
    { code: "OFR", basis: "wm", sell: [45, 120], currency: "USD" },
    { code: "THC_O", basis: "wm", sell: [12, 20], currency: "EUR" },
    { code: "DOC", basis: "shipment", sell: [50, 75], currency: "EUR" },
  ],
  AIR: [
    { code: "AFR", basis: "kg", sell: [2.2, 5.8], currency: "USD" },
    {
      code: "PRE_CARRIAGE",
      basis: "shipment",
      sell: [80, 220],
      currency: "EUR",
    },
    { code: "DOC", basis: "shipment", sell: [40, 60], currency: "EUR" },
  ],
  ROAD_FTL: [
    { code: "RFR", basis: "shipment", sell: [1800, 4200], currency: "EUR" },
    { code: "CUSTOMS", basis: "shipment", sell: [90, 160], currency: "EUR" },
  ],
  ROAD_LTL: [
    { code: "RFR", basis: "kg", sell: [0.12, 0.3], currency: "EUR" },
    { code: "CUSTOMS", basis: "shipment", sell: [80, 140], currency: "EUR" },
  ],
  RAIL: [
    { code: "RFR", basis: "container", sell: [2200, 3600], currency: "EUR" },
    { code: "DOC", basis: "shipment", sell: [60, 90], currency: "EUR" },
  ],
  MULTIMODAL: [
    { code: "OFR", basis: "container", sell: [1500, 3600], currency: "USD" },
    {
      code: "ON_CARRIAGE",
      basis: "shipment",
      sell: [400, 900],
      currency: "EUR",
    },
  ],
  COURIER: [
    { code: "AFR", basis: "kg", sell: [6, 14], currency: "USD" },
    { code: "DOC", basis: "shipment", sell: [25, 40], currency: "EUR" },
  ],
}

function buildOption(
  faker: SeededFaker,
  mode: TransportMode,
  cargo: Cargo,
  id: string
): QuoteInput["options"][number] {
  const [minTransit, maxTransit] = TRANSIT_DAYS[mode]
  const containerCount =
    cargo.containers?.reduce((sum, line) => sum + line.count, 0) ?? 1
  return {
    id,
    carrier: pickCarrier(faker, mode).name,
    transitDays: faker.number.int({ min: minTransit, max: maxTransit }),
    lines: CHARGES[mode].map((charge, index) => {
      const sellPrice =
        Math.round(
          faker.number.float({ min: charge.sell[0], max: charge.sell[1] }) * 100
        ) / 100
      const buyPrice =
        Math.round(
          sellPrice * faker.number.float({ min: 0.78, max: 0.95 }) * 100
        ) / 100
      return {
        id: `${id}-l${index + 1}`,
        code: charge.code,
        description: null,
        basis: charge.basis,
        quantity: calcLineQuantity(charge.basis, {
          mode,
          containerCount,
          grossKg: cargo.grossKg,
          cbm: cargo.cbm,
          chargeableKg: cargo.chargeableKg,
        }),
        buyPrice,
        sellPrice,
        currency: charge.currency,
      }
    }),
  }
}

/* ------------------------------------------------------------- milestones */

interface ShipmentPlan {
  etd: Date
  eta: Date
  createdAt: Date
  /** The shipment is stuck after departure (ETA passes → delayed). */
  stuck: boolean
}

function buildMilestones(
  faker: SeededFaker,
  plan: ShipmentPlan,
  mode: TransportMode
): { milestone: Milestone; at: Date }[] {
  const departureSlip =
    faker.helpers.maybe(() => faker.number.int({ min: 1, max: 3 }), {
      probability: 0.25,
    }) ?? 0
  const arrivalSlip =
    faker.helpers.maybe(() => faker.number.int({ min: 1, max: 4 }), {
      probability: 0.25,
    }) ?? 0
  const at = (date: Date, hours = 10) =>
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        hours
      )
    )
  const atd = new Date(plan.etd.getTime() + departureSlip * DAY)
  const ata = new Date(plan.eta.getTime() + arrivalSlip * DAY)
  const transshipment =
    (mode === "SEA_FCL" || mode === "SEA_LCL") && faker.datatype.boolean(0.35)

  const events: { milestone: Milestone; at: Date }[] = [
    { milestone: "BOOKED", at: at(plan.createdAt, 9) },
    {
      milestone: "CARGO_READY",
      at: at(new Date(plan.etd.getTime() - 3 * DAY)),
    },
    { milestone: "PICKED_UP", at: at(new Date(plan.etd.getTime() - DAY), 14) },
    { milestone: "DEPARTED", at: at(atd, 18) },
  ]
  if (transshipment) {
    events.push({
      milestone: "TRANSSHIPMENT",
      at: at(new Date((atd.getTime() + ata.getTime()) / 2), 12),
    })
  }
  if (!plan.stuck) {
    events.push(
      { milestone: "ARRIVED", at: at(ata, 7) },
      {
        milestone: "CUSTOMS_CLEARED",
        at: at(new Date(ata.getTime() + DAY), 15),
      },
      { milestone: "DELIVERED", at: at(new Date(ata.getTime() + 2 * DAY), 11) }
    )
  }
  // Only what has happened by the reference date; dates never go backwards.
  let previous = 0
  return events
    .map((event) => {
      const time = Math.max(event.at.getTime(), previous)
      previous = time
      return { ...event, at: new Date(time) }
    })
    .filter((event) => event.at.getTime() <= MOCK_REFERENCE_DATE.getTime())
}

/* ------------------------------------------------------------------- seed */

export interface ForwardingSeed {
  records: RecordRow[]
  quoteVersions: QuoteVersionRow[]
  milestones: MilestoneRow[]
  views: ViewRow[]
}

const pad = (value: number) => String(value).padStart(4, "0")

function seedWorkspace(
  workspaceId: keyof typeof FORWARDING_SEED_COUNTS,
  core: RecordRow[]
): ForwardingSeed {
  const counts = FORWARDING_SEED_COUNTS[workspaceId]
  const owners = getRecordOwners(workspaceId)
  const faker = createSeededFaker(`forwarding:${workspaceId}`)
  const own = core.filter((row) => row.workspaceId === workspaceId)
  const prefix = workspaceId === WORKSPACE_IDS.acme ? "" : "m"

  /* Companies: customers (+ brokers, truckers) and the overseas agents. */
  const companies = own
    .filter((row) => row.objectKey === "company")
    .map((row): RecordRow => {
      const types = faker.helpers.weightedArrayElement([
        { weight: 14, value: ["customer"] },
        { weight: 2, value: ["customs_broker"] },
        { weight: 2, value: ["trucker"] },
        { weight: 1, value: ["carrier"] },
        { weight: 1, value: ["customer", "customs_broker"] },
      ])
      return {
        ...row,
        values: {
          ...row.values,
          companyTypes: types,
          services:
            types[0] === "customer"
              ? null
              : faker.helpers.arrayElements(["road", "customs", "warehouse"], {
                  min: 1,
                  max: 2,
                }),
        },
      }
    })

  const AGENT_COUNTRIES = [
    "DE",
    "NL",
    "IT",
    "GB",
    "US",
    "CN",
    "AE",
    "ES",
    "FR",
    "PL",
  ]
  const agents = Array.from(
    { length: counts.agents },
    (_, index): RecordRow => {
      const country = AGENT_COUNTRIES[index % AGENT_COUNTRIES.length]!
      const name = `${faker.company.name()} ${faker.helpers.arrayElement([
        "Logistics",
        "Shipping",
        "Freight",
        "Spedition",
      ])}`
      const createdAt = faker.date.past({ years: 2 })
      return {
        id: `cmp_${prefix}agent${pad(index + 1)}`,
        workspaceId,
        objectKey: "company",
        values: {
          name,
          domain: null,
          industry: "logistics",
          email: `ops${index + 1}@agent-${country.toLowerCase()}.example`,
          phone: null,
          country,
          city: faker.location.city(),
          taxNumber: null,
          employees: faker.number.int({ min: 20, max: 800 }),
          annualRevenue: null,
          description: null,
          companyTypes: ["overseas_agent"],
          services: faker.helpers.arrayElements(
            ["sea", "air", "road", "customs", "warehouse"],
            {
              min: 2,
              max: 4,
            }
          ),
          ownerId: faker.helpers.arrayElement(owners),
          tags: ["partner"],
          createdAt: createdAt.toISOString(),
          updatedAt: createdAt.toISOString(),
        },
      }
    }
  )

  const customers = companies.filter((row) =>
    (row.values.companyTypes as string[]).includes("customer")
  )
  const contacts = own.filter((row) => row.objectKey === "contact")

  /* Freight requests. */
  const leads = own
    .filter((row) => row.objectKey === "lead")
    .map((row): RecordRow => {
      const lane = pickLane(faker)
      const cargo = buildCargo(faker, lane.mode)
      const hazardous = faker.datatype.boolean(0.08)
      return {
        ...row,
        values: {
          ...row.values,
          transportMode: lane.mode,
          origin: location(lane.origin),
          destination: location(lane.destination),
          commodity: cargo.commodity,
          hsCode: cargo.hsCode,
          grossWeight: cargo.grossKg,
          volume: cargo.cbm,
          packageCount: cargo.packageCount,
          dimensions: cargo.dimensions,
          containers: cargo.containers,
          isHazardous: hazardous,
          dangerousGoods: hazardous
            ? {
                imoClass: faker.helpers.arrayElement(["3", "8", "9"]),
                unNumber: "1263",
              }
            : null,
          temperatureControlled: faker.datatype.boolean(0.06),
          readyDate: isoDay(
            faker.date.soon({ days: 45, refDate: daysFromRef(-20) })
          ),
          incoterm: faker.helpers.arrayElement([
            "EXW",
            "FCA",
            "FOB",
            "CIF",
            "DAP",
          ]),
          insuranceRequested: faker.datatype.boolean(0.3),
        },
      }
    })

  /* Deals on the forwarding pipeline. */
  const LOST_REASON_MAP: Record<string, string> = {
    timing: "transitTime",
    noDecision: "cancelled",
  }
  const dealLanes = new Map<string, Lane>()
  const deals = own
    .filter((row) => row.objectKey === "deal")
    .map((row): RecordRow => {
      const lane = pickLane(faker)
      dealLanes.set(row.id, lane)
      const lostReason = row.values.lostReason as string | null
      return {
        ...row,
        values: {
          ...row.values,
          stage: DEAL_STAGE_MAP[String(row.values.stage)] ?? "rate_research",
          lostReason: lostReason
            ? (LOST_REASON_MAP[lostReason] ?? lostReason)
            : null,
          transportMode: lane.mode,
          origin: location(lane.origin),
          destination: location(lane.destination),
        },
      }
    })

  /* Quotes (+ versions). */
  const quoteRecords: RecordRow[] = []
  const quoteVersions: QuoteVersionRow[] = []
  const accepted: { quote: RecordRow; document: QuoteInput; cargo: Cargo }[] =
    []
  for (let index = 0; index < counts.quotes; index++) {
    const deal = faker.datatype.boolean(0.8)
      ? faker.helpers.arrayElement(deals)
      : null
    const lead = deal ? null : faker.helpers.arrayElement(leads)
    const lane = deal
      ? dealLanes.get(deal.id)!
      : {
          mode: lead!.values.transportMode as TransportMode,
          origin: (lead!.values.origin as LocationValue).code,
          destination: (lead!.values.destination as LocationValue).code,
          weight: 1,
        }
    const companyId = deal
      ? String(deal.values.companyId)
      : faker.helpers.arrayElement(customers).id
    const contact = contacts.find((row) => row.values.companyId === companyId)
    const cargo = buildCargo(faker, lane.mode)
    const status = faker.helpers.weightedArrayElement<QuoteStatus>([
      { weight: 4, value: "draft" },
      { weight: 6, value: "sent" },
      { weight: 5, value: "accepted" },
      { weight: 3, value: "rejected" },
      { weight: 2, value: "expired" },
    ])
    const created = faker.date.between({
      from: daysFromRef(-150),
      to: daysFromRef(-1),
    })
    const validDays =
      status === "expired" ? -faker.number.int({ min: 1, max: 30 }) : 30
    const validUntil =
      status === "expired"
        ? isoDay(new Date(MOCK_REFERENCE_DATE.getTime() + validDays * DAY))
        : status === "sent"
          ? isoDay(faker.date.soon({ days: 40, refDate: MOCK_REFERENCE_DATE }))
          : isoDay(new Date(created.getTime() + 30 * DAY))
    const id = `quo_${prefix}${pad(index + 1)}`
    const optionCount = faker.helpers.weightedArrayElement([
      { weight: 3, value: 1 },
      { weight: 2, value: 2 },
    ])
    const options = Array.from({ length: optionCount }, (_, option) =>
      buildOption(faker, lane.mode, cargo, `${id}-o${option + 1}`)
    )
    const document: QuoteInput = {
      companyId,
      contactId: contact?.id ?? null,
      dealId: deal?.id ?? null,
      leadId: lead?.id ?? null,
      transportMode: lane.mode,
      origin: location(lane.origin),
      destination: location(lane.destination),
      incoterm: faker.helpers.arrayElement(["EXW", "FCA", "FOB", "CIF", "DAP"]),
      currency: faker.helpers.weightedArrayElement([
        { weight: 6, value: "USD" },
        { weight: 4, value: "EUR" },
      ]),
      validUntil,
      cargo: {
        commodity: cargo.commodity,
        containers: cargo.containers,
        packageCount: cargo.packageCount,
        grossKg: cargo.grossKg,
        cbm: cargo.cbm,
        chargeableKg: cargo.chargeableKg,
      },
      options,
      selectedOptionId: options[0]!.id,
      notes: null,
    }
    const version = status !== "draft" && faker.datatype.boolean(0.15) ? 2 : 1
    const ownerId = String(
      deal?.values.ownerId ?? lead?.values.ownerId ?? owners[0]
    )
    const createdBy = ownerId
    for (let v = 1; v <= version; v++) {
      const previous = v < version
      quoteVersions.push({
        id: `${id}:v${v}`,
        workspaceId,
        quoteId: id,
        version: v,
        status: previous ? "sent" : status,
        document: previous
          ? {
              ...document,
              options: document.options.map((option) => ({
                ...option,
                lines: option.lines.map((line) => ({
                  ...line,
                  sellPrice: Math.round(line.sellPrice * 1.08 * 100) / 100,
                })),
              })),
            }
          : document,
        createdAt: new Date(
          created.getTime() + (v - 1) * 3 * DAY
        ).toISOString(),
        createdBy,
      })
    }
    const sentAt =
      status === "draft"
        ? null
        : new Date(created.getTime() + (version - 1) * 3 * DAY + 3_600_000)
    const values = quoteRecordValues(
      document,
      {
        quoteNumber: formatQuoteNumber(created.getUTCFullYear(), index + 1),
        status,
        version,
        ownerId,
        createdAt: created.toISOString(),
        updatedAt: (sentAt ?? created).toISOString(),
        sentAt: sentAt?.toISOString() ?? null,
      },
      FX_RATES.rates
    )
    const quote: RecordRow = { id, workspaceId, objectKey: "quote", values }
    quoteRecords.push(quote)
    if (status === "accepted") accepted.push({ quote, document, cargo })
  }

  /* Shipments: bookings of accepted quotes, then direct bookings. */
  const shipments: RecordRow[] = []
  const milestones: MilestoneRow[] = []
  for (let index = 0; index < counts.shipments; index++) {
    const source = accepted[index]
    const lane = source
      ? {
          mode: source.document.transportMode,
          origin: source.document.origin.code,
          destination: source.document.destination.code,
        }
      : pickLane(faker)
    const cargo = source?.cargo ?? buildCargo(faker, lane.mode)
    const customerId =
      source?.document.companyId ?? faker.helpers.arrayElement(customers).id
    const [minTransit, maxTransit] = TRANSIT_DAYS[lane.mode]
    const refMidnight = Date.parse(`${REF_DAY}T00:00:00.000Z`)
    const etd = new Date(
      refMidnight + faker.number.int({ min: -95, max: 30 }) * DAY
    )
    const eta = new Date(
      etd.getTime() +
        faker.number.int({ min: minTransit, max: maxTransit }) * DAY
    )
    const createdAt = new Date(
      etd.getTime() - faker.number.int({ min: 7, max: 21 }) * DAY
    )
    const stuck =
      eta.getTime() < MOCK_REFERENCE_DATE.getTime() &&
      faker.datatype.boolean(0.15)
    const id = `shp_${prefix}${pad(index + 1)}`
    const events = buildMilestones(
      faker,
      { etd, eta, createdAt, stuck },
      lane.mode
    )
    const departed = events.find((event) => event.milestone === "DEPARTED")
    const arrived = events.find((event) => event.milestone === "ARRIVED")
    const last = events.at(-1)?.milestone ?? "BOOKED"
    const sea = lane.mode === "SEA_FCL" || lane.mode === "SEA_LCL"
    const agent = agents.length ? faker.helpers.arrayElement(agents) : null
    const dates = {
      etd: isoDay(etd),
      eta: isoDay(eta),
      atd: departed ? isoDay(departed.at) : null,
      ata: arrived ? isoDay(arrived.at) : null,
    }
    const ownerId = String(
      source?.quote.values.ownerId ?? faker.helpers.arrayElement(owners)
    )
    const values: RecordValues = {
      shipmentNumber: `SHP-${createdAt.getUTCFullYear()}-${pad(index + 1)}`,
      status: last,
      delayed: last !== "DELIVERED" && getDelay(dates, REF_DAY).delayed,
      mode: lane.mode,
      origin: location(lane.origin),
      destination: location(lane.destination),
      ...dates,
      customerId,
      contactId:
        source?.document.contactId ??
        contacts.find((row) => row.values.companyId === customerId)?.id ??
        null,
      shipperId: customerId,
      consigneeId: agent?.id ?? null,
      notifyPartyId: null,
      agentId: agent?.id ?? null,
      carrier: source
        ? String(source.quote.values.carrier)
        : pickCarrier(faker, lane.mode).name,
      bookingRef: `BK${faker.string.numeric(8)}`,
      blNumber: sea
        ? `${faker.string.alpha({ length: 4, casing: "upper" })}${faker.string.numeric(9)}`
        : null,
      awbNumber: lane.mode === "AIR" ? `235-${faker.string.numeric(8)}` : null,
      containers: lane.mode === "SEA_FCL" ? cargo.containers : null,
      commodity: cargo.commodity,
      packageCount: cargo.packageCount,
      grossWeight: cargo.grossKg,
      volume: cargo.cbm,
      quoteId: source?.quote.id ?? null,
      dealId: source?.document.dealId ?? null,
      ownerId,
      tags: null,
      createdAt: createdAt.toISOString(),
      updatedAt: (events.at(-1)?.at ?? createdAt).toISOString(),
    }
    shipments.push({ id, workspaceId, objectKey: "shipment", values })
    if (source) source.quote.values.shipmentId = id
    events.forEach((event, eventIndex) =>
      milestones.push({
        id: `${id}-m${eventIndex + 1}`,
        workspaceId,
        shipmentId: id,
        milestone: event.milestone,
        at: event.at.toISOString(),
        note: null,
        createdBy: ownerId,
      })
    )
  }

  const views: ViewRow[] = [
    {
      id: `view_agent_network_${workspaceId}`,
      workspaceId,
      objectKey: "company",
      name: "Acente ağı",
      ownerId: SEED_USERS.admin.id,
      shared: true,
      state: {
        filters: [
          { field: "companyTypes", op: "in", value: ["overseas_agent"] },
        ],
        sort: { field: "country", direction: "asc" },
      },
      createdAt: daysFromRef(-60).toISOString(),
    },
    {
      id: `view_delayed_shipments_${workspaceId}`,
      workspaceId,
      objectKey: "shipment",
      name: "Geciken sevkiyatlar",
      ownerId: SEED_USERS.manager.id,
      shared: true,
      state: {
        filters: [{ field: "delayed", op: "isTrue" }],
        sort: { field: "eta", direction: "asc" },
      },
      createdAt: daysFromRef(-30).toISOString(),
    },
  ]

  const enriched = new Map(
    [...companies, ...leads, ...deals].map((row) => [row.id, row])
  )
  return {
    // Core rows keep their order; module rows follow.
    records: [
      ...own.map((row) => enriched.get(row.id) ?? row),
      ...agents,
      ...quoteRecords,
      ...shipments,
    ],
    quoteVersions,
    milestones,
    views,
  }
}

let cache: ForwardingSeed | null = null

/**
 * Applies the forwarding seed to the core records of every workspace that
 * has the module; other workspaces' rows pass through unchanged.
 */
export function seedForwarding(core: readonly RecordRow[]): ForwardingSeed {
  if (cache) return cache
  const seeded = seedWorkspaces()
    .filter(
      (workspace) =>
        workspace.modules.includes("forwarding") &&
        workspace.id in FORWARDING_SEED_COUNTS
    )
    .map((workspace) =>
      seedWorkspace(workspace.id as keyof typeof FORWARDING_SEED_COUNTS, [
        ...core,
      ])
    )
  const byWorkspace = new Map<string, RecordRow[]>()
  for (const item of seeded) {
    const workspaceId = item.records[0]?.workspaceId
    if (workspaceId) byWorkspace.set(workspaceId, item.records)
  }
  // Workspace order of the core seed is kept.
  const records: RecordRow[] = []
  const emitted = new Set<string>()
  for (const row of core) {
    const replacement = byWorkspace.get(row.workspaceId)
    if (!replacement) {
      records.push(row)
    } else if (!emitted.has(row.workspaceId)) {
      emitted.add(row.workspaceId)
      records.push(...replacement)
    }
  }
  cache = {
    records,
    quoteVersions: seeded.flatMap((item) => item.quoteVersions),
    milestones: seeded.flatMap((item) => item.milestones),
    views: seeded.flatMap((item) => item.views),
  }
  return cache
}
