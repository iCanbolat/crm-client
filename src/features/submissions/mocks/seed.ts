import {
  getAnswerFields,
  getEngineType,
  migrateFormContent,
  type FormAnswers,
  type FormContent,
  type FormField,
} from "@/engine/forms"
import type { FormSeed } from "@/features/form-builder/mocks/types"
import type { RecordRow } from "@/features/records/mocks/factory"
import {
  createSeededFaker,
  MOCK_REFERENCE_DATE,
  type SeededFaker,
} from "@/mocks/db/faker"

import type { Utm } from "../api/submissions.schemas"
import type { SubmissionRow } from "./types"

/**
 * Submissions of the seeded published forms (plan §5: ~300). Counts match
 * the Faz 4 form stats; a few extra spam rows do not count.
 */
export const SEED_SUBMISSION_COUNTS: Record<string, number> = {
  form_contact: 86,
  form_webinar: 50,
  form_freight: 164,
  form_marmara_quote: 21,
}
const SPAM_PER_FORM = 2
/** The most recent submissions are still unreviewed. */
const NEW_PER_FORM = 4

const UTM_SOURCES: (Partial<Utm> | null)[] = [
  { source: "google", medium: "cpc", campaign: "navlun-2026" },
  { source: "linkedin", medium: "social", campaign: "ihracat" },
  { source: "newsletter", medium: "email", campaign: "ekim-bulten" },
  null,
  null,
]

const emptyUtm = (): Utm => ({
  source: null,
  medium: null,
  campaign: null,
  term: null,
  content: null,
})

interface Identity {
  name: string
  email: string
  company: string
}

/** Answer of a field: the person's identity where the field asks for it. */
function fakeAnswer(
  faker: SeededFaker,
  field: FormField,
  target: string | undefined,
  identity: Identity
): unknown {
  const key = field.key.toLowerCase()
  if (field.type === "email" || target === "email") return identity.email
  if (target === "name" || /^(name|fullname|adsoyad)$/.test(key)) {
    return identity.name
  }
  if (target === "companyName" || /company|firma/.test(key)) {
    return identity.company
  }
  if (field.type === "phone" || target === "phone") {
    return `+90 5${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`
  }
  const options = field.options ?? []
  switch (getEngineType(field.type)) {
    case "select":
      return options.length ? faker.helpers.arrayElement(options).value : null
    case "multiselect":
      return options.length
        ? faker.helpers
            .arrayElements(options, { min: 1, max: 2 })
            .map((option) => option.value)
        : []
    case "boolean":
      return true
    case "textarea":
      return faker.lorem.sentence()
    case "number":
      return faker.number.int({ min: 1, max: 40 })
    case "date":
      return faker.date.soon({ days: 60 }).toISOString().slice(0, 10)
    case "text":
      return field.type === "hidden" ? null : faker.lorem.words(2)
    default:
      // Module types (route, cargo…) are left out of seeded answers.
      return null
  }
}

function fakeAnswers(
  faker: SeededFaker,
  content: FormContent,
  identity: Identity
): FormAnswers {
  const targets = content.mapping.fields
  return Object.fromEntries(
    getAnswerFields(content).map((field) => [
      field.key,
      fakeAnswer(faker, field, targets[field.id], identity),
    ])
  )
}

const text = (value: unknown) => (typeof value === "string" ? value : "")

export function seedSubmissions(
  forms: FormSeed,
  records: readonly RecordRow[]
): SubmissionRow[] {
  const rows: SubmissionRow[] = []
  for (const form of forms.forms) {
    const count = SEED_SUBMISSION_COUNTS[form.id]
    const version = forms.versions
      .filter((item) => item.formId === form.id)
      .sort((a, b) => b.version - a.version)[0]
    if (!count || !version) continue

    const faker = createSeededFaker(`submissions:${form.id}`)
    const content = migrateFormContent(version.content)
    const leads = records.filter(
      (row) => row.workspaceId === form.workspaceId && row.objectKey === "lead"
    )
    const total = count + SPAM_PER_FORM
    // Spread over ~150 days, newest first (index 0 = most recent).
    const spacingMs = (150 * 86_400_000) / total
    for (let index = 0; index < total; index++) {
      const isSpam = index >= count
      const createdAt = new Date(
        MOCK_REFERENCE_DATE.getTime() -
          (index + faker.number.float({ min: 0.1, max: 0.9 })) * spacingMs
      ).toISOString()
      const utmPick = faker.helpers.arrayElement(UTM_SOURCES)
      const lead = isSpam ? undefined : faker.helpers.arrayElement(leads)
      // The linked lead is the person who filled the form in.
      const identity: Identity = {
        name: text(lead?.values.name) || faker.person.fullName(),
        email: text(lead?.values.email) || faker.internet.email().toLowerCase(),
        company: text(lead?.values.companyName) || faker.company.name(),
      }
      rows.push({
        id: `sub_${form.id.slice(5)}_${String(index + 1).padStart(3, "0")}`,
        workspaceId: form.workspaceId,
        formId: form.id,
        formVersion: version.version,
        answers: fakeAnswers(faker, content, identity),
        status: isSpam ? "spam" : index < NEW_PER_FORM ? "new" : "processed",
        record: lead ? { objectKey: "lead", id: lead.id } : null,
        utm: { ...emptyUtm(), ...utmPick },
        referrer: utmPick
          ? null
          : faker.helpers.arrayElement([null, "https://www.google.com/"]),
        pageUrl: null,
        embedded: faker.datatype.boolean(),
        language: content.settings.defaultLanguage,
        error: null,
        createdAt,
      })
    }
  }
  return rows
}
