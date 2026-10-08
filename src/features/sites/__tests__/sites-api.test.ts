import { describe, expect, it } from "vitest"

import { isApiError } from "@/lib/api"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"

import {
  createDomain,
  deleteDomain,
  fetchDomains,
  fetchSite,
  makeDomainPrimary,
  updateSite,
  verifyDomain,
} from "../api/sites.api"
import { DOMAIN_POLL_MS, siteQueries } from "../api/sites.queries"
import {
  hostnameSchema,
  isApexDomain,
  subdomainSchema,
  type Domain,
} from "../api/sites.schemas"
import { DOMAIN_STEP_MS, domainStatusAt } from "../mocks/store"

async function apiError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error
    throw error
  }
  throw new Error("expected an API error")
}

/** Moves a domain's verification start into the past (mock clock). */
function ageDomain(id: string, ms: number) {
  db.domains.update(id, {
    checkStartedAt: new Date(Date.now() - ms).toISOString(),
  })
}

describe("site settings (B5.2)", () => {
  it("returns the workspace site with its published forms", async () => {
    signInAs("owner")
    const site = await fetchSite()
    expect(site).toMatchObject({
      subdomain: "acme-lojistik",
      primaryDomain: null,
      defaultFormId: null,
      brand: { name: "Acme Lojistik" },
    })
    expect(site.publishedForms.map((form) => form.slug)).toEqual([
      "iletisim",
      "navlun-teklif",
      "webinar-kaydi",
    ])
  })

  it("TC-5.2-01 validates the subdomain format", () => {
    for (const valid of ["acme", "acme-lojistik", "a1b"]) {
      expect(subdomainSchema.safeParse(valid).success).toBe(true)
    }
    for (const invalid of ["ab", "-acme", "acme-", "ac--me", "acme_x", "www"]) {
      expect(subdomainSchema.safeParse(invalid).success).toBe(false)
    }
    expect(subdomainSchema.parse(" ACME ")).toBe("acme")
  })

  it("TC-5.2-01 rejects a subdomain used by another workspace", async () => {
    signInAs("owner")
    const error = await apiError(
      updateSite({ subdomain: "marmara-forwarding" })
    )
    expect(error.code).toBe("SUBDOMAIN_TAKEN")
    expect(error.fieldErrors?.subdomain).toBeDefined()

    const saved = await updateSite({ subdomain: "acme" })
    expect(saved.subdomain).toBe("acme")
  })

  it("accepts only a published form as the default form", async () => {
    signInAs("owner")
    const draft = await apiError(updateSite({ defaultFormId: "form_agent" }))
    expect(draft.fieldErrors?.defaultFormId).toBeDefined()

    const site = await updateSite({ defaultFormId: "form_freight" })
    expect(site.defaultFormId).toBe("form_freight")
    // Unpublishing the form clears it from the site.
    db.forms.update("form_freight", { status: "draft" })
    expect((await fetchSite()).defaultFormId).toBeNull()
  })

  it("lets managers read but not change the site", async () => {
    signInAs("manager")
    await expect(fetchSite()).resolves.toBeDefined()
    expect((await apiError(updateSite({ subdomain: "acme" }))).status).toBe(403)
  })
})

describe("custom domains (B5.3)", () => {
  it("TC-5.3-01 rejects invalid hostnames and apex domains", async () => {
    expect(hostnameSchema.parse(" https://Teklif.AcmeLojistik.com/ ")).toBe(
      "teklif.acmelojistik.com"
    )
    expect(hostnameSchema.safeParse("teklif.acme.com.tr").success).toBe(true)
    for (const invalid of [
      "acmelojistik.com",
      "acme.com.tr",
      "localhost",
      "teklif..acme.com",
      "-x.acme.com",
      "teklif acme.com",
    ]) {
      expect(hostnameSchema.safeParse(invalid).success).toBe(false)
    }
    expect(isApexDomain("acme.co.uk")).toBe(true)
    expect(isApexDomain("forms.acme.co.uk")).toBe(false)

    signInAs("owner")
    const error = await apiError(createDomain({ hostname: "acmelojistik.com" }))
    expect(error.status).toBe(422)
    expect(error.fieldErrors?.hostname).toBeDefined()
  })

  it("advances pending_dns → verifying → ssl_pending → active", () => {
    const start = Date.UTC(2026, 9, 8)
    const row = {
      hostname: "teklif.acmelojistik.com",
      checkStartedAt: new Date(start).toISOString(),
    }
    const at = (steps: number) =>
      domainStatusAt(row, start + steps * DOMAIN_STEP_MS).status
    expect([at(0), at(1), at(2), at(3), at(10)]).toEqual([
      "pending_dns",
      "verifying",
      "ssl_pending",
      "active",
      "active",
    ])
    expect(
      domainStatusAt(
        { ...row, hostname: "fail.acmelojistik.com" },
        start + 2 * DOMAIN_STEP_MS
      )
    ).toEqual({ status: "failed", failureReason: "dns_mismatch" })
  })

  it("TC-5.3-02 polls only while a domain is being verified", () => {
    const options = siteQueries.domains()
    const interval = options.refetchInterval as (query: {
      state: { data?: Pick<Domain, "status">[] }
    }) => number | false
    const query = (statuses: Domain["status"][]) => ({
      state: { data: statuses.map((status) => ({ status })) },
    })
    expect(interval(query(["active", "verifying"]))).toBe(DOMAIN_POLL_MS)
    expect(interval(query(["pending_dns"]))).toBe(DOMAIN_POLL_MS)
    expect(interval(query(["active", "failed"]))).toBe(false)
    expect(interval({ state: {} })).toBe(false)
  })

  it("TC-5.3-03 a failing domain fails and can be retried", async () => {
    signInAs("owner")
    const domain = await createDomain({ hostname: "fail.acmelojistik.com" })
    expect(domain.status).toBe("pending_dns")
    expect(domain.dns.cname.value).toMatch(/^cname\./)
    expect(domain.dns.txt.name).toBe("_crm-verify.fail.acmelojistik.com")

    ageDomain(domain.id, 5 * DOMAIN_STEP_MS)
    const [failed] = await fetchDomains()
    expect(failed).toMatchObject({
      status: "failed",
      failureReason: "dns_mismatch",
    })

    const retried = await verifyDomain(domain.id)
    expect(retried).toMatchObject({
      status: "pending_dns",
      failureReason: null,
    })
  })

  it("TC-5.3-04 switches the primary domain (only one primary)", async () => {
    signInAs("owner")
    const first = await createDomain({ hostname: "teklif.acmelojistik.com" })
    const second = await createDomain({ hostname: "form.acmelojistik.com" })
    expect(first.isPrimary).toBe(true)
    expect(second.isPrimary).toBe(false)

    // Not verified yet: cannot become primary, and the site keeps its subdomain.
    expect((await apiError(makeDomainPrimary(second.id))).status).toBe(409)
    expect((await fetchSite()).primaryDomain).toBeNull()

    ageDomain(first.id, 4 * DOMAIN_STEP_MS)
    ageDomain(second.id, 4 * DOMAIN_STEP_MS)
    expect((await fetchSite()).primaryDomain).toBe("teklif.acmelojistik.com")

    const domains = await makeDomainPrimary(second.id)
    expect(domains.filter((domain) => domain.isPrimary)).toEqual([
      expect.objectContaining({ hostname: "form.acmelojistik.com" }),
    ])
    expect((await fetchSite()).primaryDomain).toBe("form.acmelojistik.com")

    const taken = await apiError(
      createDomain({ hostname: "form.acmelojistik.com" })
    )
    expect(taken.code).toBe("DOMAIN_TAKEN")

    await deleteDomain(second.id)
    expect((await fetchDomains()).map((domain) => domain.hostname)).toEqual([
      "teklif.acmelojistik.com",
    ])
    expect(
      db.domains.all().every((row) => row.workspaceId === WORKSPACE_IDS.acme)
    ).toBe(true)
  })
})
