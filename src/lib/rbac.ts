/**
 * Role based access control policy (Faz 1 / B1.4).
 * Pure and framework-free: the UI (`<Can>`, route guards) and the mock API
 * evaluate the very same rules.
 */

export const ROLES = ["owner", "admin", "manager", "agent", "viewer"] as const
export type Role = (typeof ROLES)[number]

export const ACTIONS = ["read", "create", "update", "delete", "manage"] as const
export type Action = (typeof ACTIONS)[number]

/**
 * - `record`: CRM records (leads, deals, …), their activities and tasks
 * - `view`: saved list views (`manage` = share with the team)
 * - `member`: workspace members and invitations
 * - `workspace`: workspace profile, onboarding, modules and object metadata
 * - `form`: lead forms of the form builder (`manage` = publish, unpublish,
 *   restore a version)
 * - `site`: public form site — branding, default form, custom domains (B5.2);
 *   everyone may read it (it is public anyway, and embed codes need it)
 * - `submission`: form submissions inbox (`update` = status, `manage` =
 *   convert to a record) (B5.6)
 */
export const RESOURCES = [
  "record",
  "view",
  "member",
  "workspace",
  "form",
  "site",
  "submission",
] as const
export type Resource = (typeof RESOURCES)[number]

export interface Subject {
  userId: string
  role: Role
}

/** Optional context of the concrete object an action targets. */
export interface Target {
  ownerId?: string | null
}

interface Rule {
  /** Allowed on any object. */
  any: readonly Action[]
  /** Allowed only on objects owned by the subject. */
  own?: readonly Action[]
}

const ALL: readonly Action[] = ACTIONS

const POLICY: Record<Role, Partial<Record<Resource, Rule>>> = {
  owner: {
    record: { any: ALL },
    view: { any: ALL },
    member: { any: ALL },
    workspace: { any: ALL },
    form: { any: ALL },
    site: { any: ALL },
    submission: { any: ALL },
  },
  admin: {
    record: { any: ALL },
    view: { any: ALL },
    member: { any: ALL },
    // Only the owner may delete the workspace.
    workspace: { any: ["read", "update", "manage"] },
    form: { any: ALL },
    site: { any: ALL },
    submission: { any: ALL },
  },
  manager: {
    record: { any: ["read", "create", "update", "delete"] },
    view: { any: ["read", "create", "manage"], own: ["update", "delete"] },
    member: { any: ["read"] },
    workspace: { any: ["read"] },
    form: { any: ALL },
    site: { any: ["read"] },
    submission: { any: ALL },
  },
  agent: {
    record: { any: ["read", "create"], own: ["update", "delete"] },
    view: { any: ["read", "create"], own: ["update", "delete"] },
    workspace: { any: ["read"] },
    form: { any: ["read"] },
    site: { any: ["read"] },
    submission: { any: ["read"] },
  },
  viewer: {
    record: { any: ["read"] },
    // Personal views only: viewers may still save their own filters.
    view: { any: ["read", "create"], own: ["update", "delete"] },
    workspace: { any: ["read"] },
    form: { any: ["read"] },
    site: { any: ["read"] },
    submission: { any: ["read"] },
  },
}

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role)
}

export function can(
  subject: Subject | null | undefined,
  action: Action,
  resource: Resource,
  target?: Target
): boolean {
  if (!subject) return false

  const rule = POLICY[subject.role][resource]
  if (!rule) return false
  if (rule.any.includes(action)) return true

  // Ownership rules need a concrete object; without one they never apply.
  return (
    !!rule.own?.includes(action) &&
    target?.ownerId != null &&
    target.ownerId === subject.userId
  )
}

/** Thrown by route guards; rendered as the 403 page by the route error boundary. */
export class ForbiddenError extends Error {
  override readonly name = "ForbiddenError"

  constructor(message = "Forbidden") {
    super(message)
  }
}

export function isForbiddenError(error: unknown): error is ForbiddenError {
  return error instanceof ForbiddenError
}
