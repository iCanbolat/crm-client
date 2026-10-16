import { describe, expect, it } from "vitest"

import { convertLead } from "@/features/leads/api/leads.api"
import {
  createRecord,
  fetchObjects,
  fetchRecords,
} from "@/features/records/api/records.api"
import { searchRecords } from "@/features/shell/api/search.api"
import { signInAs } from "@/test/auth"

/** Faz 10 — a sector owns the core CRM objects (B10.2). */
describe("core objects per sector", () => {
  it("TC-10.2-02 the visa sector has no companies or deals", async () => {
    signInAs("atlasOwner")
    const objects = (await fetchObjects()).data
    const keys = objects.map((def) => def.key)

    expect(keys).not.toContain("company")
    expect(keys).not.toContain("deal")
    expect(objects.find((def) => def.key === "lead")).toMatchObject({
      label: { tr: "Talep", en: "Enquiry" },
      pluralLabel: { tr: "Talepler", en: "Enquiries" },
    })
    const contact = objects.find((def) => def.key === "contact")!
    expect(contact.pluralLabel).toEqual({ tr: "Başvuranlar", en: "Applicants" })
    const contactFields = contact.fields.map((field) => field.key)
    expect(contactFields).not.toContain("companyId")
    expect(contactFields).not.toContain("title")
    expect(contact.layouts.detail.related).not.toContainEqual(
      expect.objectContaining({ objectKey: "deal" })
    )
    const leadFields = objects
      .find((def) => def.key === "lead")!
      .fields.map((field) => field.key)
    expect(leadFields).not.toContain("companyName")
    expect(leadFields).not.toContain("convertedDealId")

    await expect(
      fetchRecords("company", { page: 1, pageSize: 10 })
    ).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      fetchRecords("deal", { page: 1, pageSize: 10 })
    ).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      createRecord("deal", { name: "Gizli fırsat" })
    ).rejects.toMatchObject({ status: 404 })

    const hits = (await searchRecords("a")).data
    expect(
      hits.filter(
        (hit) => hit.objectKey === "company" || hit.objectKey === "deal"
      )
    ).toEqual([])
  })

  it("TC-10.2-03 a visa enquiry converts without company or deal", async () => {
    signInAs("atlasOwner")
    const lead = await createRecord("lead", {
      name: "Mira Kaya",
      email: "mira.kaya@example.com",
      serviceType: "visa",
      targetCountries: ["GB"],
      visaCategory: "student",
    })

    await expect(
      convertLead(lead.id, {
        company: { mode: "new", name: "Kaya Ailesi" },
        contact: { mode: "new", name: "Mira Kaya" },
        deal: { create: false },
        targets: [],
      })
    ).rejects.toMatchObject({ status: 422, code: "OBJECT_DISABLED" })
    await expect(
      convertLead(lead.id, {
        company: { mode: "none" },
        contact: { mode: "new", name: "Mira Kaya" },
        deal: { create: true, name: "Mira — vize" },
        targets: [],
      })
    ).rejects.toMatchObject({ status: 422, code: "OBJECT_DISABLED" })

    const result = await convertLead(lead.id, {
      company: { mode: "none" },
      contact: { mode: "new", name: "Mira Kaya" },
      deal: { create: false },
      targets: ["visaApplication"],
    })
    expect(result).toMatchObject({ companyId: null, dealId: null })
  })

  it("TC-10.2-04 forwarding keeps companies and deals under its own terms", async () => {
    signInAs("owner")
    const objects = (await fetchObjects()).data
    const keys = objects.map((def) => def.key)

    expect(keys).toEqual(expect.arrayContaining(["company", "deal", "quote"]))
    expect(objects.find((def) => def.key === "lead")).toMatchObject({
      label: { tr: "Navlun talebi", en: "Freight enquiry" },
    })
    expect(
      objects
        .find((def) => def.key === "contact")!
        .fields.map((field) => field.key)
    ).toContain("companyId")
  })
})
