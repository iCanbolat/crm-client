import type { RecordRow } from "@/features/records/mocks/factory"
import {
  createSeededFaker,
  MOCK_REFERENCE_DATE,
  type SeededFaker,
} from "@/mocks/db/faker"

import type { FieldOfStudy, StudyLevel } from "../lib/constants"

/**
 * Starting catalogue of institutions and programmes (B8.3). Names are
 * fictional on purpose: real school names would imply partnerships.
 * Deterministic per workspace; programme countries follow the institution.
 */

interface InstitutionSeed {
  name: string
  type: "university" | "college" | "language_school" | "pathway"
  city: string
  currency: string
  tuition: [number, number]
}

const INSTITUTIONS: Record<string, InstitutionSeed[]> = {
  GB: [
    {
      name: "Northbridge University",
      type: "university",
      city: "Manchester",
      currency: "GBP",
      tuition: [17000, 26000],
    },
    {
      name: "University of Westmere",
      type: "university",
      city: "Birmingham",
      currency: "GBP",
      tuition: [16000, 24000],
    },
    {
      name: "Kingsford University",
      type: "university",
      city: "London",
      currency: "GBP",
      tuition: [22000, 32000],
    },
    {
      name: "Ashdown University",
      type: "university",
      city: "Leeds",
      currency: "GBP",
      tuition: [16500, 23000],
    },
    {
      name: "Thamesvale University",
      type: "university",
      city: "Reading",
      currency: "GBP",
      tuition: [17500, 25000],
    },
    {
      name: "Caledon University",
      type: "university",
      city: "Glasgow",
      currency: "GBP",
      tuition: [18000, 26000],
    },
    {
      name: "Severn College London",
      type: "college",
      city: "London",
      currency: "GBP",
      tuition: [12000, 16000],
    },
    {
      name: "Oakridge International Pathways",
      type: "pathway",
      city: "Brighton",
      currency: "GBP",
      tuition: [15000, 19000],
    },
    {
      name: "Bridgegate English School",
      type: "language_school",
      city: "Cambridge",
      currency: "GBP",
      tuition: [9000, 12000],
    },
    {
      name: "Harbour English Academy",
      type: "language_school",
      city: "Bournemouth",
      currency: "GBP",
      tuition: [8000, 11000],
    },
  ],
  US: [
    {
      name: "Lakeshore State University",
      type: "university",
      city: "Chicago",
      currency: "USD",
      tuition: [28000, 42000],
    },
    {
      name: "Pacific Crest University",
      type: "university",
      city: "San Diego",
      currency: "USD",
      tuition: [30000, 46000],
    },
    {
      name: "Eastbrook University",
      type: "university",
      city: "Boston",
      currency: "USD",
      tuition: [38000, 56000],
    },
    {
      name: "Red Mesa College",
      type: "college",
      city: "Phoenix",
      currency: "USD",
      tuition: [14000, 20000],
    },
    {
      name: "Hudson Point University",
      type: "university",
      city: "New York",
      currency: "USD",
      tuition: [36000, 52000],
    },
    {
      name: "Liberty Language Institute",
      type: "language_school",
      city: "Miami",
      currency: "USD",
      tuition: [10000, 14000],
    },
  ],
  CA: [
    {
      name: "Maplewood University",
      type: "university",
      city: "Toronto",
      currency: "CAD",
      tuition: [32000, 45000],
    },
    {
      name: "Fraser Valley Institute",
      type: "college",
      city: "Vancouver",
      currency: "CAD",
      tuition: [16000, 22000],
    },
    {
      name: "Laurentian Heights College",
      type: "college",
      city: "Montréal",
      currency: "CAD",
      tuition: [15000, 21000],
    },
    {
      name: "Prairie North University",
      type: "university",
      city: "Calgary",
      currency: "CAD",
      tuition: [26000, 36000],
    },
    {
      name: "Bayshore College",
      type: "college",
      city: "Halifax",
      currency: "CAD",
      tuition: [14000, 19000],
    },
    {
      name: "Ontario Lakes Language Centre",
      type: "language_school",
      city: "Toronto",
      currency: "CAD",
      tuition: [9000, 13000],
    },
  ],
  DE: [
    {
      name: "Hochschule Rheinfeld",
      type: "university",
      city: "Köln",
      currency: "EUR",
      tuition: [0, 3000],
    },
    {
      name: "Technische Hochschule Elbtal",
      type: "university",
      city: "Dresden",
      currency: "EUR",
      tuition: [0, 3000],
    },
    {
      name: "Berlin School of Applied Sciences",
      type: "college",
      city: "Berlin",
      currency: "EUR",
      tuition: [9000, 14000],
    },
    {
      name: "Isar International University",
      type: "university",
      city: "München",
      currency: "EUR",
      tuition: [10000, 16000],
    },
    {
      name: "Sprachinstitut am Main",
      type: "language_school",
      city: "Frankfurt",
      currency: "EUR",
      tuition: [4000, 7000],
    },
  ],
  IE: [
    {
      name: "Liffey University",
      type: "university",
      city: "Dublin",
      currency: "EUR",
      tuition: [15000, 24000],
    },
    {
      name: "Shannon Institute of Technology",
      type: "college",
      city: "Limerick",
      currency: "EUR",
      tuition: [12000, 16000],
    },
    {
      name: "Emerald English College",
      type: "language_school",
      city: "Dublin",
      currency: "EUR",
      tuition: [6000, 9000],
    },
  ],
  NL: [
    {
      name: "Amstelhaven University",
      type: "university",
      city: "Amsterdam",
      currency: "EUR",
      tuition: [12000, 20000],
    },
    {
      name: "Hogeschool Maasdelta",
      type: "college",
      city: "Rotterdam",
      currency: "EUR",
      tuition: [9000, 13000],
    },
    {
      name: "Utrechtse Business School",
      type: "college",
      city: "Utrecht",
      currency: "EUR",
      tuition: [10000, 15000],
    },
  ],
  AU: [
    {
      name: "Southern Cross University of Technology",
      type: "university",
      city: "Sydney",
      currency: "AUD",
      tuition: [36000, 48000],
    },
    {
      name: "Coral Coast University",
      type: "university",
      city: "Brisbane",
      currency: "AUD",
      tuition: [32000, 44000],
    },
    {
      name: "Yarra English Academy",
      type: "language_school",
      city: "Melbourne",
      currency: "AUD",
      tuition: [12000, 16000],
    },
  ],
  IT: [
    {
      name: "Università Adriatica",
      type: "university",
      city: "Bologna",
      currency: "EUR",
      tuition: [2000, 4000],
    },
    {
      name: "Milano School of Design",
      type: "college",
      city: "Milano",
      currency: "EUR",
      tuition: [14000, 20000],
    },
  ],
  PL: [
    {
      name: "Vistula Business University",
      type: "university",
      city: "Warszawa",
      currency: "EUR",
      tuition: [3500, 6000],
    },
    {
      name: "Kraków Medical Academy",
      type: "university",
      city: "Kraków",
      currency: "EUR",
      tuition: [11000, 14000],
    },
  ],
}

interface ProgramTemplate {
  name: string
  level: StudyLevel
  field: FieldOfStudy
  months: number
}

const UNIVERSITY_PROGRAMS: ProgramTemplate[] = [
  {
    name: "MSc Data Science",
    level: "master",
    field: "data_science",
    months: 12,
  },
  { name: "MBA", level: "master", field: "business", months: 12 },
  {
    name: "MSc Computer Science",
    level: "master",
    field: "computer_science",
    months: 12,
  },
  {
    name: "MA International Relations",
    level: "master",
    field: "social_sciences",
    months: 12,
  },
  {
    name: "MSc Finance",
    level: "master",
    field: "economics_finance",
    months: 12,
  },
  {
    name: "MSc Mechanical Engineering",
    level: "master",
    field: "engineering",
    months: 18,
  },
  { name: "MSc Psychology", level: "master", field: "psychology", months: 12 },
  {
    name: "MArch Architecture",
    level: "master",
    field: "architecture_design",
    months: 24,
  },
  {
    name: "BSc Computer Science",
    level: "bachelor",
    field: "computer_science",
    months: 36,
  },
  {
    name: "BA Business Management",
    level: "bachelor",
    field: "business",
    months: 36,
  },
  {
    name: "BEng Civil Engineering",
    level: "bachelor",
    field: "engineering",
    months: 48,
  },
  {
    name: "BA Graphic Design",
    level: "bachelor",
    field: "arts_media",
    months: 36,
  },
  {
    name: "BSc Nursing",
    level: "bachelor",
    field: "medicine_health",
    months: 36,
  },
  { name: "LLM International Law", level: "master", field: "law", months: 12 },
  { name: "PhD Engineering", level: "phd", field: "engineering", months: 48 },
]

const COLLEGE_PROGRAMS: ProgramTemplate[] = [
  {
    name: "Diploma in Hospitality Management",
    level: "certificate",
    field: "hospitality_tourism",
    months: 24,
  },
  {
    name: "Diploma in Software Development",
    level: "certificate",
    field: "computer_science",
    months: 24,
  },
  {
    name: "Associate in Business",
    level: "associate",
    field: "business",
    months: 24,
  },
  {
    name: "Graduate Certificate in Project Management",
    level: "certificate",
    field: "business",
    months: 12,
  },
  {
    name: "Diploma in Digital Marketing",
    level: "certificate",
    field: "arts_media",
    months: 12,
  },
]

const LANGUAGE_PROGRAMS: ProgramTemplate[] = [
  {
    name: "General English (24 weeks)",
    level: "language_course",
    field: "language",
    months: 6,
  },
  {
    name: "IELTS Preparation (12 weeks)",
    level: "language_course",
    field: "language",
    months: 3,
  },
  {
    name: "Academic English (36 weeks)",
    level: "language_course",
    field: "language",
    months: 9,
  },
]

const PATHWAY_PROGRAMS: ProgramTemplate[] = [
  {
    name: "International Foundation Year",
    level: "foundation",
    field: "business",
    months: 9,
  },
  {
    name: "Pre-Master's Programme",
    level: "foundation",
    field: "business",
    months: 6,
  },
  {
    name: "International Year One in Engineering",
    level: "foundation",
    field: "engineering",
    months: 9,
  },
]

const TEMPLATES = {
  university: UNIVERSITY_PROGRAMS,
  college: COLLEGE_PROGRAMS,
  language_school: LANGUAGE_PROGRAMS,
  pathway: PATHWAY_PROGRAMS,
} as const

const LANGUAGE_REQUIREMENT: Record<StudyLevel, [number, number]> = {
  language_course: [0, 0],
  high_school: [5, 5.5],
  foundation: [5, 5.5],
  associate: [5.5, 6],
  certificate: [6, 6],
  bachelor: [6, 6.5],
  master: [6.5, 7],
  phd: [7, 7],
}

const DAY = 86_400_000

const iso = (days: number) =>
  new Date(MOCK_REFERENCE_DATE.getTime() - days * DAY).toISOString()

const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

function teachingLanguage(country: string, faker: SeededFaker) {
  if (country === "DE") return faker.helpers.arrayElement(["de", "en"])
  return "en"
}

function intakesOf(country: string, level: StudyLevel) {
  if (level === "language_course") return ["1", "4", "7", "9", "10"]
  if (country === "AU") return ["2", "7"]
  if (country === "CA" || country === "US") return ["1", "9"]
  if (country === "DE") return ["4", "10"]
  return level === "foundation" ? ["1", "9"] : ["9"]
}

export interface CatalogSeed {
  institutions: RecordRow[]
  programs: RecordRow[]
}

/** 40 institutions and 120 programmes for a workspace. */
export function seedCatalog(workspaceId: string, ownerId: string): CatalogSeed {
  const faker = createSeededFaker(`visa:catalog:${workspaceId}`)
  const institutions: RecordRow[] = []
  const programs: RecordRow[] = []
  const prefix = workspaceId.replace(/^ws_/, "")

  for (const [country, list] of Object.entries(INSTITUTIONS)) {
    for (const item of list) {
      const id = `ins_${prefix}_${slug(item.name)}`.slice(0, 48)
      const partner = faker.helpers.weightedArrayElement([
        { weight: 6, value: "direct" },
        { weight: 3, value: "via_aggregator" },
        { weight: 1, value: "none" },
      ])
      const basis =
        item.type === "language_school"
          ? "first_year_tuition"
          : faker.helpers.weightedArrayElement([
              { weight: 8, value: "first_year_tuition" },
              { weight: 1, value: "full_tuition" },
              { weight: 1, value: "flat" },
            ])
      const createdAt = iso(faker.number.int({ min: 200, max: 290 }))
      institutions.push({
        id,
        workspaceId,
        objectKey: "institution",
        values: {
          name: item.name,
          institutionType: item.type,
          country,
          city: item.city,
          website: `https://www.${slug(item.name).replace(/-/g, "")}.example`,
          partnerStatus: partner,
          aggregator:
            partner === "via_aggregator"
              ? faker.helpers.arrayElement(["EduLink Global", "StudyBridge"])
              : null,
          commissionBasis: partner === "none" ? null : basis,
          commissionRate:
            partner === "none" || basis === "flat"
              ? null
              : faker.helpers.arrayElement([10, 12, 15, 15, 18, 20]),
          flatCommission:
            basis === "flat" && partner !== "none"
              ? {
                  amount: faker.helpers.arrayElement([1000, 1500, 2000]),
                  currency: item.currency,
                }
              : null,
          contractExpiresAt:
            partner === "none"
              ? null
              : iso(-faker.number.int({ min: 60, max: 700 })).slice(0, 10),
          contactEmail: `admissions@${slug(item.name).replace(/-/g, "")}.example`,
          notes: null,
          ownerId,
          tags: [],
          createdAt,
          updatedAt: createdAt,
        },
      })

      const templates = faker.helpers.arrayElements(TEMPLATES[item.type], 3)
      for (const template of templates) {
        const [low, high] = LANGUAGE_REQUIREMENT[template.level]
        const ielts = low ? faker.helpers.arrayElement([low, high]) : null
        const tuition =
          Math.round(
            faker.number.int({ min: item.tuition[0], max: item.tuition[1] }) /
              500
          ) * 500
        const deadlineOffset = faker.number.int({ min: -30, max: 240 })
        const language = teachingLanguage(country, faker)
        programs.push({
          id: `pro_${prefix}_${programs.length + 1}`,
          workspaceId,
          objectKey: "program",
          values: {
            name: template.name,
            institutionId: id,
            country,
            studyLevel: template.level,
            fieldOfStudy: template.field,
            teachingLanguage: language,
            durationMonths: template.months,
            tuitionFee: { amount: tuition, currency: item.currency },
            applicationFee:
              item.type === "language_school"
                ? null
                : {
                    amount: faker.helpers.arrayElement([0, 50, 75, 100]),
                    currency: item.currency,
                  },
            intakeMonths: intakesOf(country, template.level),
            applicationDeadline: iso(-deadlineOffset).slice(0, 10),
            minIelts: ielts,
            minToefl: ielts ? Math.round(ielts * 13.5) : null,
            minPte: ielts ? Math.round(ielts * 9) : null,
            minDuolingo: ielts ? Math.round((ielts * 17) / 5) * 5 : null,
            minCefr: language === "de" ? "C1" : null,
            minGpa:
              template.level === "master" || template.level === "phd"
                ? faker.helpers.arrayElement([2.5, 2.75, 3, 3])
                : null,
            scholarshipAvailable: faker.datatype.boolean({ probability: 0.4 }),
            url: null,
            active: true,
            ownerId,
            tags: [],
            createdAt: iso(faker.number.int({ min: 150, max: 200 })),
            updatedAt: iso(faker.number.int({ min: 10, max: 150 })),
          },
        })
      }
    }
  }
  return { institutions, programs }
}
