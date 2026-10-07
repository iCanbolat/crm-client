import { base, en, Faker, tr } from "@faker-js/faker"

export const MOCK_SEED = 42
/** Fixed "now" so relative dates (past/future/recent) stay deterministic. */
export const MOCK_REFERENCE_DATE = new Date("2026-10-01T09:00:00.000Z")

function hashString(value: string) {
  let hash = 5381
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return hash >>> 0
}

/**
 * Each collection gets its own seeded faker, so adding a new collection
 * never shifts the data generated for the existing ones.
 */
export function createSeededFaker(namespace: string, seed = MOCK_SEED) {
  const faker = new Faker({ locale: [tr, en, base] })
  faker.seed(hashString(namespace) ^ seed)
  faker.setDefaultRefDate(MOCK_REFERENCE_DATE)
  return faker
}

export type SeededFaker = ReturnType<typeof createSeededFaker>
