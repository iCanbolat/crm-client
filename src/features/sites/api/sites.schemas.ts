import { z } from "zod"

import { HEX_COLOR_PATTERN, isHttpsUrl } from "@/engine/forms"
import i18n from "@/lib/i18n"

/** DNS label of the platform subdomain: `acme-lojistik.forms.<platform>`. */
export const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/
/** Labels taken by the platform itself. */
export const RESERVED_SUBDOMAINS = ["www", "app", "api", "admin", "cname"]
/** ~256 KB image as a base64 data URL. */
const IMAGE_MAX_LENGTH = 350_000

export const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    if (!SUBDOMAIN_PATTERN.test(value) || value.includes("--")) {
      ctx.addIssue({
        code: "custom",
        message: i18n.t("sites:validation.subdomain"),
      })
    } else if (RESERVED_SUBDOMAINS.includes(value)) {
      ctx.addIssue({
        code: "custom",
        message: i18n.t("sites:validation.subdomainReserved"),
      })
    }
  })

/** Empty string = no link. */
const optionalHttpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || isHttpsUrl(value), {
    error: () => i18n.t("sites:validation.httpsUrl"),
  })

const imageSchema = z.string().max(IMAGE_MAX_LENGTH).nullable()

export const siteBrandSchema = z.object({
  /** Shown in the page header and title; defaults to the workspace name. */
  name: z.string().trim().min(1).max(80),
  logoUrl: imageSchema,
  faviconUrl: imageSchema,
  primaryColor: z.string().regex(HEX_COLOR_PATTERN),
})

export const siteSeoSchema = z.object({
  title: z.string().trim().max(70),
  description: z.string().trim().max(160),
  ogImageUrl: imageSchema,
})

export const siteLegalSchema = z.object({
  kvkkUrl: optionalHttpsUrl,
  privacyUrl: optionalHttpsUrl,
  cookieUrl: optionalHttpsUrl,
})

export const siteFormOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
})
export type SiteFormOption = z.infer<typeof siteFormOptionSchema>

export const siteSchema = z.object({
  id: z.string(),
  subdomain: z.string(),
  /** Active custom domain marked primary; `null` → platform subdomain. */
  primaryDomain: z.string().nullable(),
  brand: siteBrandSchema,
  /** Shown at `/` of the site (`null` → brand-neutral 404). */
  defaultFormId: z.string().nullable(),
  seo: siteSeoSchema,
  legal: siteLegalSchema,
  /** Published forms the default form can be chosen from. */
  publishedForms: z.array(siteFormOptionSchema),
  updatedAt: z.string(),
})
export type Site = z.infer<typeof siteSchema>

export const updateSiteInputSchema = z.object({
  subdomain: subdomainSchema,
  brand: siteBrandSchema,
  defaultFormId: z.string().nullable(),
  seo: siteSeoSchema,
  legal: siteLegalSchema,
})
export type UpdateSiteInput = z.infer<typeof updateSiteInputSchema>

// Custom domains (B5.3) ------------------------------------------------------

export const DOMAIN_STATUSES = [
  "pending_dns",
  "verifying",
  "ssl_pending",
  "active",
  "failed",
] as const
export const domainStatusSchema = z.enum(DOMAIN_STATUSES)
export type DomainStatus = z.infer<typeof domainStatusSchema>

export const DOMAIN_FAILURE_REASONS = ["dns_mismatch", "ssl_failed"] as const
export type DomainFailureReason = (typeof DOMAIN_FAILURE_REASONS)[number]

/** Verification is still running: the UI keeps polling. */
export const isDomainPending = (status: DomainStatus) =>
  status !== "active" && status !== "failed"

/** Target of the tenant's CNAME record. */
export const CNAME_TARGET = "cname.forms-platform.com"
export const VERIFY_RECORD_PREFIX = "_crm-verify"

const HOST_LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
const HOSTNAME_PATTERN = new RegExp(`^(?:${HOST_LABEL}\\.)+[a-z]{2,63}$`)
/** Second-level labels under which the registrable domain has 3 labels. */
const COMPOUND_SUFFIXES = [
  "com",
  "net",
  "org",
  "gen",
  "biz",
  "info",
  "co",
  "ac",
  "gov",
  "edu",
  "k12",
  "bel",
  "web",
  "av",
]

/**
 * Apex (registrable) domains cannot carry a CNAME: only subdomains such as
 * `teklif.acmelojistik.com` / `teklif.acme.com.tr` are accepted.
 */
export function isApexDomain(hostname: string) {
  const labels = hostname.split(".")
  const compound =
    labels.length >= 3 &&
    labels.at(-1)!.length === 2 &&
    COMPOUND_SUFFIXES.includes(labels.at(-2)!)
  return labels.length <= (compound ? 3 : 2)
}

export const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^https?:\/\//, "").replace(/\/+$/, ""))
  .superRefine((value, ctx) => {
    if (value.length > 253 || !HOSTNAME_PATTERN.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: i18n.t("sites:validation.hostname"),
      })
    } else if (isApexDomain(value)) {
      ctx.addIssue({ code: "custom", message: i18n.t("sites:validation.apex") })
    }
  })

export const createDomainInputSchema = z.object({ hostname: hostnameSchema })
export type CreateDomainInput = z.infer<typeof createDomainInputSchema>

export const domainSchema = z.object({
  id: z.string(),
  hostname: z.string(),
  status: domainStatusSchema,
  isPrimary: z.boolean(),
  failureReason: z.enum(DOMAIN_FAILURE_REASONS).nullable(),
  dns: z.object({
    cname: z.object({ name: z.string(), value: z.string() }),
    txt: z.object({ name: z.string(), value: z.string() }),
  }),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type Domain = z.infer<typeof domainSchema>

export const domainListSchema = z.object({ data: z.array(domainSchema) })
