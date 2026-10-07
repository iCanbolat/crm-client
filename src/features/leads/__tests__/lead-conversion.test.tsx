import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"
import { renderRoute, screen } from "@/test/render"

import { convertLead, fetchConversionSuggestions } from "../api/leads.api"
import { domainOf, matchCompanies, matchContacts } from "../lib/matching"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

/** A fresh, unconverted freight request whose email matches a company. */
function seedMatchingLead() {
  const company = acme("company").find((row) =>
    String(row.values.email ?? "").includes("@")
  )!
  const domain = String(company.values.email).split("@")[1]
  const lead = db.records.create({
    id: "led_testconvert",
    workspaceId: WORKSPACE_IDS.acme,
    objectKey: "lead",
    values: {
      name: "Deniz Kaya",
      companyName: "Bambaşka Ünvan",
      email: `deniz.kaya@${domain}`,
      stage: "qualified",
      transportMode: "SEA_FCL",
      origin: {
        code: "TRIST",
        name: "İstanbul (Ambarlı)",
        country: "TR",
        kind: "port",
      },
      destination: {
        code: "DEHAM",
        name: "Hamburg",
        country: "DE",
        kind: "port",
      },
      containers: [{ type: "40HC", count: 2 }],
      grossWeight: 24000,
      estimatedValue: { amount: 8000, currency: "USD" },
      ownerId: SEED_USERS.owner.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
  return { company, lead }
}

describe("lead matching (B3.3)", () => {
  it("extracts domains from emails and URLs", () => {
    expect(domainOf("ayse@Acme.com.tr")).toBe("acme.com.tr")
    expect(domainOf("https://www.acme.com.tr/iletisim")).toBe("acme.com.tr")
    expect(domainOf("acme.com")).toBe("acme.com")
    expect(domainOf("")).toBeNull()
    expect(domainOf(42)).toBeNull()
  })

  it("ranks tax number, domain and name matches; ignores free mail", () => {
    const companies = [
      { id: "c1", values: { name: "Acme Lojistik", email: "info@acme.com" } },
      { id: "c2", values: { name: "Başka", taxNumber: "1234567890" } },
      { id: "c3", values: { name: "Gmail Ltd", domain: "https://gmail.com" } },
    ]
    expect(
      matchCompanies(
        {
          email: "a@acme.com",
          companyName: "ACME LOJİSTİK",
          taxNumber: "1234567890",
        },
        companies
      ).map((match) => [match.id, match.reason])
    ).toEqual([
      ["c2", "taxNumber"],
      ["c1", "domain"],
    ])
    expect(matchCompanies({ email: "x@gmail.com" }, companies)).toEqual([])
    expect(
      matchContacts({ email: "a@b.com", name: "Ali Veli" }, [
        { id: "p1", values: { name: "Ali Veli" } },
        { id: "p2", values: { email: "A@B.com" } },
      ]).map((match) => match.reason)
    ).toEqual(["email", "name"])
  })
})

describe("lead conversion (B3.3)", () => {
  it("TC-3.3-02 suggests the existing company of the lead's email domain", async () => {
    signInAs("owner")
    const { company, lead } = seedMatchingLead()
    const suggestions = await fetchConversionSuggestions(lead.id)
    expect(suggestions.companies[0]).toMatchObject({
      id: company.id,
      reason: "domain",
    })

    const { user } = await renderRoute(`/o/lead/${lead.id}`, { as: "owner" })
    await user.click(await screen.findByRole("button", { name: "Dönüştür" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Lead'i dönüştür",
    })
    const suggested = await within(dialog).findByRole("radio", {
      name: new RegExp(`Mevcut: ${company.values.name}`),
    })
    expect(suggested).toBeChecked()
  })

  it("TC-3.3-03 converts into company, contact and deal and links them", async () => {
    const { company, lead } = seedMatchingLead()
    const { user, router } = await renderRoute(`/o/lead/${lead.id}`, {
      as: "owner",
    })
    await user.click(await screen.findByRole("button", { name: "Dönüştür" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Lead'i dönüştür",
    })
    await within(dialog).findByRole("radio", {
      name: new RegExp(`Mevcut: ${company.values.name}`),
    })
    // No quote draft: the conversion lands on the new deal.
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: "Ardından teklif taslağı hazırla",
      })
    )
    await user.click(within(dialog).getByRole("button", { name: "Dönüştür" }))

    await waitFor(() =>
      expect(db.records.findById(lead.id)!.values.stage).toBe("converted")
    )
    const converted = db.records.findById(lead.id)!.values
    expect(converted.convertedCompanyId).toBe(company.id)
    const contact = db.records.findById(String(converted.convertedContactId))!
    expect(contact.values).toMatchObject({
      name: "Deniz Kaya",
      companyId: company.id,
    })
    const deal = db.records.findById(String(converted.convertedDealId))!
    // Shared fields travel with the conversion (forwarding route + mode).
    expect(deal.values).toMatchObject({
      companyId: company.id,
      contactId: contact.id,
      amount: { amount: 8000, currency: "USD" },
      transportMode: "SEA_FCL",
      stage: "rate_research",
    })
    expect(deal.values.origin).toMatchObject({ code: "TRIST" })
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/o/deal/${deal.id}`)
    )
    expect(await screen.findByText("Lead dönüştürüldü.")).toBeInTheDocument()
  })

  it("creates a new company when nothing matches and refuses a second conversion", async () => {
    signInAs("owner")
    const lead = acme("lead").find(
      (row) =>
        row.values.stage === "new" &&
        !String(row.values.email).includes("@gmail")
    )!
    const result = await convertLead(lead.id, {
      company: { mode: "new", name: "Yepyeni A.Ş." },
      contact: { mode: "none" },
      deal: { create: false },
    })
    expect(result.contactId).toBeNull()
    expect(result.dealId).toBeNull()
    expect(db.records.findById(result.companyId)!.values.name).toBe(
      "Yepyeni A.Ş."
    )
    expect(result.lead.values.stage).toBe("converted")

    await expect(
      convertLead(lead.id, {
        company: { mode: "new", name: "X" },
        contact: { mode: "none" },
        deal: { create: false },
      })
    ).rejects.toMatchObject({ status: 409, code: "ALREADY_CONVERTED" })
  })

  it("validates the input and checks existing records and permissions", async () => {
    signInAs("owner")
    const lead = acme("lead").find((row) => row.values.stage === "contacted")!
    await expect(
      convertLead(lead.id, {
        company: { mode: "existing", id: "cmp_missing" },
        contact: { mode: "none" },
        deal: { create: false },
      })
    ).rejects.toMatchObject({ status: 422 })
    await expect(
      convertLead(lead.id, {
        company: { mode: "new", name: "" },
        contact: { mode: "none" },
        deal: { create: false },
      })
    ).rejects.toMatchObject({ status: 422 })

    signInAs("viewer")
    await expect(
      convertLead(lead.id, {
        company: { mode: "new", name: "X" },
        contact: { mode: "none" },
        deal: { create: false },
      })
    ).rejects.toMatchObject({ status: 403 })
  })

  it("moving a lead to “Converted” on the board opens the conversion dialog", async () => {
    const { lead } = seedMatchingLead()
    const { user } = await renderRoute("/o/lead?layout=kanban", { as: "owner" })
    await screen.findByRole("region", { name: "Lead'ler panosu" })
    await user.click(
      await screen.findByRole("button", { name: "Taşı: Deniz Kaya" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Dönüştürüldü" })
    )
    expect(
      await screen.findByRole("dialog", { name: "Lead'i dönüştür" })
    ).toBeInTheDocument()
    // Nothing moved yet: the dialog decides.
    expect(db.records.findById(lead.id)!.values.stage).toBe("qualified")
  })
})
