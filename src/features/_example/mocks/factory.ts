import type { SeededFaker } from "@/mocks/db/faker"
import { getRecordOwners, WORKSPACE_IDS } from "@/mocks/db/seed"

import type { ExampleItem } from "../api/example.schemas"

export const EXAMPLE_SEED_COUNT = 24

/** Stored shape: tenant scoped, the owner's name is joined on read. */
export interface ExampleRecord extends Omit<ExampleItem, "ownerName"> {
  workspaceId: string
}

export function buildExampleItem(
  faker: SeededFaker,
  overrides: Partial<ExampleRecord> = {}
): ExampleRecord {
  const workspaceId = overrides.workspaceId ?? WORKSPACE_IDS.acme

  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    status: faker.helpers.weightedArrayElement([
      { weight: 4, value: "active" as const },
      { weight: 1, value: "archived" as const },
    ]),
    createdAt: faker.date.past({ years: 1 }).toISOString(),
    ownerId: faker.helpers.arrayElement(getRecordOwners(workspaceId)),
    workspaceId,
    ...overrides,
  }
}

export function seedExampleItems(
  faker: SeededFaker,
  count = EXAMPLE_SEED_COUNT,
  workspaceId: string = WORKSPACE_IDS.acme
): ExampleRecord[] {
  return Array.from({ length: count }, () =>
    buildExampleItem(faker, { workspaceId })
  )
}
