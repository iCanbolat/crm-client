import {
  seedExampleItems,
  type ExampleRecord,
} from "@/features/_example/mocks/factory"
import {
  seedActivities,
  seedTasks,
  type ActivityRow,
  type TaskRow,
} from "@/features/activities/mocks/factory"
import {
  seedObjects,
  seedRecords,
  seedViews,
  type AttachmentRow,
  type ObjectRow,
  type RecordRow,
  type UploadRow,
  type ViewPrefRow,
  type ViewRow,
} from "@/features/records/mocks/factory"
import { seedForms } from "@/features/form-builder/mocks/seed"
import type {
  FormRow,
  FormVersionRow,
} from "@/features/form-builder/mocks/types"
import type { Workspace } from "@/features/workspace"
import { seedForwardingForms } from "@/modules/forwarding/mocks/forms-seed"
import { seedForwarding } from "@/modules/forwarding/mocks/seed"
import type {
  MilestoneRow,
  QuoteVersionRow,
} from "@/modules/forwarding/mocks/types"

import { seedModuleObjects } from "../modules"

import { createCollection, type Collection } from "./collection"
import { createSeededFaker } from "./faker"
import {
  seedInvites,
  seedMemberships,
  seedUsers,
  seedWorkspaces,
  WORKSPACE_IDS,
  type InviteRecord,
  type MembershipRecord,
  type MockUser,
  type RevokedToken,
} from "./seed"

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Central registry of mock tables — every feature registers its collection here. */
export const db = {
  users: createCollection<MockUser>({
    name: "users",
    seed: seedUsers,
    onChange: notify,
  }),
  workspaces: createCollection<Workspace>({
    name: "workspaces",
    seed: seedWorkspaces,
    onChange: notify,
  }),
  memberships: createCollection<MembershipRecord>({
    name: "memberships",
    seed: seedMemberships,
    onChange: notify,
  }),
  invites: createCollection<InviteRecord>({
    name: "invites",
    seed: seedInvites,
    onChange: notify,
  }),
  revokedTokens: createCollection<RevokedToken>({
    name: "revokedTokens",
    onChange: notify,
  }),
  examples: createCollection<ExampleRecord>({
    name: "examples",
    seed: () => [
      ...seedExampleItems(createSeededFaker("examples")),
      ...seedExampleItems(
        createSeededFaker("examples:marmara"),
        6,
        WORKSPACE_IDS.marmara
      ),
    ],
    onChange: notify,
  }),
  objects: createCollection<ObjectRow>({
    name: "objects",
    seed: () => seedModuleObjects(seedObjects()),
    onChange: notify,
  }),
  records: createCollection<RecordRow>({
    name: "records",
    seed: () => seedForwarding(seedRecords()).records,
    onChange: notify,
  }),
  views: createCollection<ViewRow>({
    name: "views",
    seed: () => [...seedViews(), ...seedForwarding(seedRecords()).views],
    onChange: notify,
  }),
  viewPrefs: createCollection<ViewPrefRow>({
    name: "viewPrefs",
    onChange: notify,
  }),
  attachments: createCollection<AttachmentRow>({
    name: "attachments",
    onChange: notify,
  }),
  uploads: createCollection<UploadRow>({
    name: "uploads",
    onChange: notify,
  }),
  activities: createCollection<ActivityRow>({
    name: "activities",
    seed: seedActivities,
    onChange: notify,
  }),
  tasks: createCollection<TaskRow>({
    name: "tasks",
    seed: seedTasks,
    onChange: notify,
  }),
  // Forwarding module (Faz 3)
  quoteVersions: createCollection<QuoteVersionRow>({
    name: "quoteVersions",
    seed: () => seedForwarding(seedRecords()).quoteVersions,
    onChange: notify,
  }),
  milestones: createCollection<MilestoneRow>({
    name: "milestones",
    seed: () => seedForwarding(seedRecords()).milestones,
    onChange: notify,
  }),
  // Form builder (Faz 4)
  forms: createCollection<FormRow>({
    name: "forms",
    seed: () => [...seedForms().forms, ...seedForwardingForms().forms],
    onChange: notify,
  }),
  formVersions: createCollection<FormVersionRow>({
    name: "formVersions",
    seed: () => [...seedForms().versions, ...seedForwardingForms().versions],
    onChange: notify,
  }),
}

export type MockDb = typeof db
export type DbSnapshot = {
  [Key in keyof MockDb]: MockDb[Key] extends Collection<infer T> ? T[] : never
}

export function resetDb() {
  for (const collection of Object.values(db)) collection.reset()
}

export function snapshotDb(): DbSnapshot {
  return Object.fromEntries(
    Object.entries(db).map(([name, collection]) => [
      name,
      collection.snapshot(),
    ])
  ) as DbSnapshot
}

export function restoreDb(snapshot: Partial<DbSnapshot>) {
  for (const [name, items] of Object.entries(snapshot)) {
    const collection = db[name as keyof MockDb] as Collection<never> | undefined
    if (collection && Array.isArray(items)) collection.restore(items as never[])
  }
}

export function onDbChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
