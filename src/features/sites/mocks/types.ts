import type {
  DomainFailureReason,
  DomainStatus,
  Site,
} from "../api/sites.schemas"

/** Public form site of a workspace (B5.2); one per workspace. */
export interface SiteRow extends Pick<
  Site,
  "id" | "subdomain" | "brand" | "defaultFormId" | "seo" | "legal" | "updatedAt"
> {
  workspaceId: string
}

/** Custom domain of a site (B5.3); `status` advances with time on reads. */
export interface DomainRow {
  id: string
  workspaceId: string
  hostname: string
  status: DomainStatus
  isPrimary: boolean
  verifyToken: string
  failureReason: DomainFailureReason | null
  /** Start of the current verification run (added / "retry"). */
  checkStartedAt: string
  verifiedAt: string | null
  createdAt: string
}
