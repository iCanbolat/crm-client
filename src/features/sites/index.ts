/**
 * Public form site settings (Faz 5): subdomain, branding, default form,
 * SEO, legal links (B5.2) and custom domains (B5.3).
 */
export { siteKeys } from "./api/sites.keys"
export {
  useCreateDomain,
  useDeleteDomain,
  useMakeDomainPrimary,
  useUpdateSite,
  useVerifyDomain,
} from "./api/sites.mutations"
export { DOMAIN_POLL_MS, siteQueries } from "./api/sites.queries"
export {
  CNAME_TARGET,
  createDomainInputSchema,
  domainSchema,
  hostnameSchema,
  isApexDomain,
  isDomainPending,
  siteSchema,
  subdomainSchema,
  updateSiteInputSchema,
} from "./api/sites.schemas"
export type {
  Domain,
  DomainStatus,
  Site,
  UpdateSiteInput,
} from "./api/sites.schemas"
export { SiteSettingsPage } from "./components/site-settings-page"
export { getPlatformHost, getSiteOrigin } from "./lib/origin"
