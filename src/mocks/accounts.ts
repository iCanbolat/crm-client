import type { Workspace } from "@/features/workspace"
import { coreObjects } from "@/features/records/mocks/core-objects"
import { objectRowId } from "@/features/records/mocks/factory"
import type { Role } from "@/lib/rbac"

import { db } from "./db"
import type { MockUser, OutboxEmail } from "./db/seed"

/**
 * Account side of the mock backend (Faz 10): self sign-up, e-mail
 * verification, new workspaces and the outbox the dev toolbar shows.
 */

export const VERIFICATION_TTL_MS = 30 * 60_000
export const RESEND_COOLDOWN_MS = 60_000
export const MAX_VERIFICATION_ATTEMPTS = 5
export const INVITE_TTL_MS = 14 * 86_400_000

export function sendEmail(email: Omit<OutboxEmail, "id" | "createdAt">) {
  return db.outbox.create({
    ...email,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  })
}

/** Latest e-mail sent to `to` (tests and the dev toolbar). */
export function latestEmail(to: string, kind?: OutboxEmail["kind"]) {
  return db.outbox
    .findMany((item) => item.to === to && (!kind || item.kind === kind))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

function randomCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000
  return String(value).padStart(6, "0")
}

/** Issues a fresh verification code and e-mails it. */
export function sendVerificationCode(user: MockUser) {
  const now = Date.now()
  const code = randomCode()
  const row = {
    code,
    expiresAt: new Date(now + VERIFICATION_TTL_MS).toISOString(),
    sentAt: new Date(now).toISOString(),
    attempts: 0,
  }
  if (db.emailVerifications.findById(user.id)) {
    db.emailVerifications.update(user.id, row)
  } else {
    db.emailVerifications.create({ id: user.id, ...row })
  }
  sendEmail({
    to: user.email,
    kind: "verifyEmail",
    subject: `Doğrulama kodunuz: ${code}`,
    code,
    link: "/verify-email",
  })
  return code
}

function slugify(name: string) {
  const base =
    name
      .toLocaleLowerCase("tr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  let slug = base
  for (
    let index = 2;
    db.workspaces.findFirst((item) => item.slug === slug);
    index++
  ) {
    slug = `${base}-${index}`
  }
  return slug
}

export function addMembership(userId: string, workspaceId: string, role: Role) {
  return db.memberships.create({
    id: `${workspaceId}:${userId}`,
    userId,
    workspaceId,
    role,
    joinedAt: new Date().toISOString(),
  })
}

/**
 * A new workspace owned by `userId`, waiting for its onboarding (sector,
 * company, team). Starts with the core object metadata only.
 */
export function createWorkspace(userId: string, name: string): Workspace {
  const workspace = db.workspaces.create({
    id: `ws_${crypto.randomUUID().slice(0, 8)}`,
    name,
    slug: slugify(name),
    logoUrl: null,
    country: null,
    currency: null,
    timezone: null,
    language: null,
    vertical: null,
    modules: [],
    agentVisibility: "assigned",
    onboarding: { status: "pending", step: 0, draft: {} },
    createdAt: new Date().toISOString(),
  })
  for (const def of coreObjects()) {
    db.objects.create({
      id: objectRowId(workspace.id, def.key),
      workspaceId: workspace.id,
      def,
    })
  }
  addMembership(userId, workspace.id, "owner")
  return workspace
}
