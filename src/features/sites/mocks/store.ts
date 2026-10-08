import { migrateFormContent } from "@/engine/forms"
import { db } from "@/mocks/db"

import {
  CNAME_TARGET,
  VERIFY_RECORD_PREFIX,
  type Domain,
  type DomainStatus,
  type Site,
} from "../api/sites.schemas"
import { createSiteRow } from "./seed"
import type { DomainRow, SiteRow } from "./types"

/** The workspace's site; created on first access (new workspaces). */
export function ensureSite(workspaceId: string): SiteRow {
  const existing = db.sites.findFirst((row) => row.workspaceId === workspaceId)
  if (existing) return existing
  const workspace = db.workspaces.findById(workspaceId)
  if (!workspace) throw new Error(`Unknown workspace ${workspaceId}`)
  return db.sites.create(createSiteRow(workspace, new Date().toISOString()))
}

export function domainsOf(workspaceId: string) {
  return db.domains
    .findMany((row) => row.workspaceId === workspaceId)
    .map(advanceDomain)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function findDomainRow(workspaceId: string, id: string) {
  const row = db.domains.findById(id)
  return row && row.workspaceId === workspaceId ? advanceDomain(row) : undefined
}

export function isSubdomainTaken(subdomain: string, exceptWorkspaceId: string) {
  return db.workspaces.all().some((workspace) => {
    if (workspace.id === exceptWorkspaceId) return false
    return ensureSite(workspace.id).subdomain === subdomain
  })
}

export function isHostnameTaken(hostname: string) {
  return db.domains.all().some((row) => row.hostname === hostname)
}

/** Published forms of a workspace: candidates for the default form. */
export function publishedFormsOf(workspaceId: string) {
  return db.forms
    .findMany(
      (row) => row.workspaceId === workspaceId && row.status === "published"
    )
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((row) => ({ id: row.id, name: row.name, slug: row.slug }))
}

export function primaryDomainOf(workspaceId: string) {
  return (
    domainsOf(workspaceId).find(
      (row) => row.isPrimary && row.status === "active"
    )?.hostname ?? null
  )
}

export function toSite(row: SiteRow): Site {
  const publishedForms = publishedFormsOf(row.workspaceId)
  return {
    id: row.id,
    subdomain: row.subdomain,
    primaryDomain: primaryDomainOf(row.workspaceId),
    brand: row.brand,
    // A default form that was unpublished or deleted no longer counts.
    defaultFormId: publishedForms.some((form) => form.id === row.defaultFormId)
      ? row.defaultFormId
      : null,
    seo: row.seo,
    legal: row.legal,
    publishedForms,
    updatedAt: row.updatedAt,
  }
}

// Domain verification state machine (B5.3) ---------------------------------

/** Each verification step takes this long in the mock. */
export const DOMAIN_STEP_MS = 1_500

const STEPS: DomainStatus[] = ["pending_dns", "verifying", "ssl_pending"]

/**
 * Deterministic status from the time since the verification started:
 * pending_dns → verifying → ssl_pending → active. A hostname containing
 * `fail` never resolves to the platform and fails after "verifying".
 */
export function domainStatusAt(
  row: Pick<DomainRow, "hostname" | "checkStartedAt">,
  now: number
): Pick<DomainRow, "status" | "failureReason"> {
  const elapsed = now - new Date(row.checkStartedAt).getTime()
  const step = Math.max(0, Math.floor(elapsed / DOMAIN_STEP_MS))
  if (row.hostname.includes("fail") && step >= 2) {
    return { status: "failed", failureReason: "dns_mismatch" }
  }
  const status = STEPS[step] ?? "active"
  return { status, failureReason: null }
}

function advanceDomain(row: DomainRow): DomainRow {
  if (row.status === "active" || row.status === "failed") return row
  const next = domainStatusAt(row, Date.now())
  if (next.status === row.status) return row
  return db.domains.update(row.id, {
    ...next,
    verifiedAt: next.status === "active" ? new Date().toISOString() : null,
  })!
}

export function toDomain(row: DomainRow): Domain {
  return {
    id: row.id,
    hostname: row.hostname,
    status: row.status,
    isPrimary: row.isPrimary,
    failureReason: row.failureReason,
    dns: {
      cname: { name: row.hostname, value: CNAME_TARGET },
      txt: {
        name: `${VERIFY_RECORD_PREFIX}.${row.hostname}`,
        value: row.verifyToken,
      },
    },
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
  }
}

/** Site of a public host: platform subdomain or active custom domain. */
export function resolveSiteByHost(host: string, platformDomain: string) {
  const suffix = `.${platformDomain}`
  if (host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length)
    return db.workspaces
      .all()
      .map((workspace) => ensureSite(workspace.id))
      .find((site) => site.subdomain === subdomain)
  }
  const domain = db.domains
    .findMany((row) => row.hostname === host)
    .map(advanceDomain)
    .find((row) => row.status === "active")
  return domain ? ensureSite(domain.workspaceId) : undefined
}

/** Published content of a site's form (the live version), if any. */
export function publishedFormOf(workspaceId: string, slug: string) {
  const form = db.forms.findFirst(
    (row) =>
      row.workspaceId === workspaceId &&
      row.slug === slug &&
      row.status === "published"
  )
  if (!form || form.publishedVersion == null) return undefined
  const version = db.formVersions.findFirst(
    (row) => row.formId === form.id && row.version === form.publishedVersion
  )
  if (!version) return undefined
  return { form, version, content: migrateFormContent(version.content) }
}
