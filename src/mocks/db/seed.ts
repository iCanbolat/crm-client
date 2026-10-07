import type { User } from "@/features/auth"
import type { Invite, Workspace } from "@/features/workspace"
import type { Role } from "@/lib/rbac"

import { MOCK_REFERENCE_DATE } from "./faker"

/**
 * Fixed identities of the mock backend. IDs never change, so tests, E2E
 * simulations and persisted sessions can reference them safely.
 * Every seed account signs in with DEMO_PASSWORD (mock only).
 */
export const DEMO_PASSWORD = "Demo123!"

export interface MockUser extends User {
  password: string
}

export interface MembershipRecord {
  id: string
  userId: string
  workspaceId: string
  role: Role
  joinedAt: string
}

export interface InviteRecord extends Invite {
  workspaceId: string
  invitedBy: string
}

export interface RevokedToken {
  /** Token id (`jti`). */
  id: string
  revokedAt: string
}

export const WORKSPACE_IDS = {
  acme: "ws_acme",
  marmara: "ws_marmara",
  kuzey: "ws_kuzey",
} as const

const createdAt = (daysAgo: number) =>
  new Date(MOCK_REFERENCE_DATE.getTime() - daysAgo * 86_400_000).toISOString()

const COMPLETED = { status: "completed", step: 3, draft: {} } as const

export function seedWorkspaces(): Workspace[] {
  return [
    {
      id: WORKSPACE_IDS.acme,
      name: "Acme Lojistik",
      slug: "acme-lojistik",
      logoUrl: null,
      country: "TR",
      currency: "TRY",
      timezone: "Europe/Istanbul",
      language: "tr",
      modules: ["forwarding"],
      onboarding: COMPLETED,
      createdAt: createdAt(400),
    },
    {
      id: WORKSPACE_IDS.marmara,
      name: "Marmara Forwarding",
      slug: "marmara-forwarding",
      logoUrl: null,
      country: "TR",
      currency: "USD",
      timezone: "Europe/Istanbul",
      language: "en",
      modules: ["forwarding"],
      onboarding: COMPLETED,
      createdAt: createdAt(120),
    },
    {
      // Freshly signed up: onboarding not started yet.
      id: WORKSPACE_IDS.kuzey,
      name: "Kuzey Lojistik",
      slug: "kuzey-lojistik",
      logoUrl: null,
      country: null,
      currency: null,
      timezone: null,
      language: null,
      modules: [],
      onboarding: { status: "pending", step: 0, draft: {} },
      createdAt: createdAt(0),
    },
  ]
}

/** Seed accounts by role — handy for tests (`signInAs("viewer")`). */
export const SEED_USERS = {
  owner: { id: "usr_owner", email: "owner@acme.test", name: "Elif Yılmaz" },
  admin: { id: "usr_admin", email: "admin@acme.test", name: "Mert Demir" },
  manager: {
    id: "usr_manager",
    email: "manager@acme.test",
    name: "Zeynep Kaya",
  },
  agent: { id: "usr_agent", email: "agent@acme.test", name: "Can Öztürk" },
  viewer: { id: "usr_viewer", email: "viewer@acme.test", name: "Deniz Arslan" },
  newcomer: {
    id: "usr_newcomer",
    email: "selin@kuzey.test",
    name: "Selin Aydın",
  },
} as const

export type SeedUserKey = keyof typeof SEED_USERS

export function seedUsers(): MockUser[] {
  return Object.values(SEED_USERS).map((user) => ({
    ...user,
    avatarUrl: null,
    password: DEMO_PASSWORD,
  }))
}

const membership = (
  userId: string,
  workspaceId: string,
  role: Role,
  daysAgo: number
): MembershipRecord => ({
  id: `${workspaceId}:${userId}`,
  userId,
  workspaceId,
  role,
  joinedAt: createdAt(daysAgo),
})

export function seedMemberships(): MembershipRecord[] {
  const { acme, marmara, kuzey } = WORKSPACE_IDS
  return [
    membership(SEED_USERS.owner.id, acme, "owner", 400),
    membership(SEED_USERS.admin.id, acme, "admin", 380),
    membership(SEED_USERS.manager.id, acme, "manager", 300),
    membership(SEED_USERS.agent.id, acme, "agent", 200),
    membership(SEED_USERS.viewer.id, acme, "viewer", 90),
    membership(SEED_USERS.owner.id, marmara, "admin", 120),
    membership(SEED_USERS.admin.id, marmara, "owner", 120),
    membership(SEED_USERS.newcomer.id, kuzey, "owner", 0),
  ]
}

export function seedInvites(): InviteRecord[] {
  return [
    {
      id: "inv_acme_1",
      workspaceId: WORKSPACE_IDS.acme,
      email: "operasyon@acme.test",
      role: "agent",
      status: "pending",
      invitedAt: createdAt(3),
      invitedBy: SEED_USERS.owner.id,
    },
  ]
}

/** Users that own seeded records in a workspace (owner … agent). */
export function getRecordOwners(workspaceId: string) {
  return seedMemberships()
    .filter(
      (item) => item.workspaceId === workspaceId && item.role !== "viewer"
    )
    .map((item) => item.userId)
}
