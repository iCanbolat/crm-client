import { describe, expect, it } from "vitest"

import { isApiError } from "@/lib/api"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"

import {
  createForm,
  deleteForm,
  fetchForm,
  fetchForms,
  fetchFormStats,
  updateForm,
} from "../api/forms.api"

async function apiError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error
    throw error
  }
  throw new Error("expected an API error")
}

const params = { page: 1, pageSize: 20 }

describe("forms API (mock, B4.2)", () => {
  it("lists the workspace's forms with stats, search and status filter", async () => {
    signInAs("owner")
    const all = await fetchForms(params)
    expect(all.data.map((form) => form.name)).toEqual([
      "Acente Başvuru Formu",
      "Navlun Teklif Formu",
      "İletişim Formu",
      "Webinar Kaydı",
    ])
    const freight = all.data.find((form) => form.id === "form_freight")!
    expect(freight).toMatchObject({
      status: "published",
      publishedVersion: 3,
      hasUnpublishedChanges: false,
      stats: { views: 3420, submissions: 164, conversionRate: 0.048 },
    })

    expect((await fetchForms({ ...params, q: "navlun" })).data).toHaveLength(1)
    expect(
      (await fetchForms({ ...params, status: "draft" })).data.map(
        (form) => form.id
      )
    ).toEqual(["form_agent"])
    expect(await fetchFormStats("form_contact")).toEqual({
      views: 1240,
      submissions: 86,
      conversionRate: 0.0694,
    })
  })

  it("TC-4.1-03 serves forms saved in schema v1 migrated to v2", async () => {
    signInAs("owner")
    const webinar = await fetchForm("form_webinar")
    expect(webinar.content.schemaVersion).toBe(2)
    expect(webinar.content.fields.map((field) => field.key)).toEqual([
      "adSoyad",
      "eposta",
      "firma",
      "oturum",
    ])
    expect(webinar.content.theme.primaryColor).toBe("#7c3aed")
    expect(webinar.fieldCount).toBe(4)
  })

  it("creates forms with a unique link name and the starter fields", async () => {
    signInAs("manager")
    const created = await createForm({ name: "İletişim" })
    expect(created).toMatchObject({
      slug: "iletisim-2",
      status: "draft",
      publishedVersion: null,
      ownerName: "Zeynep Kaya",
    })
    expect(created.content.fields.map((field) => field.key)).toContain("email")

    const taken = await apiError(
      createForm({ name: "Başka", slug: "navlun-teklif" })
    )
    expect(taken.status).toBe(422)
    expect(taken.fieldErrors?.slug?.[0]).toMatch(/kullanılıyor/)
    const invalid = await apiError(createForm({ name: "x" }))
    expect(invalid.fieldErrors?.name).toBeDefined()
  })

  it("saves drafts and flags changes against the published version", async () => {
    signInAs("owner")
    const form = await fetchForm("form_freight")
    const content = structuredClone(form.content)
    content.fields[0]!.label.tr = "Adınız soyadınız"
    const saved = await updateForm("form_freight", {
      content,
      name: "Navlun Teklifi",
    })
    expect(saved).toMatchObject({
      name: "Navlun Teklifi",
      hasUnpublishedChanges: true,
    })
    expect(saved.content.fields[0]?.label.tr).toBe("Adınız soyadınız")

    const slug = await apiError(
      updateForm("form_freight", { slug: "iletisim" })
    )
    expect(slug.status).toBe(422)
    const bad = await apiError(
      updateForm("form_freight", { content: { ...content, steps: [] } })
    )
    expect(bad.status).toBe(422)
    expect((await apiError(fetchForm("form_marmara_quote"))).status).toBe(404)
  })

  it("deletes drafts but not published forms; viewers only read", async () => {
    signInAs("owner")
    const published = await apiError(deleteForm("form_contact"))
    expect(published).toMatchObject({ status: 409, code: "FORM_PUBLISHED" })
    await deleteForm("form_agent")
    expect(db.forms.findById("form_agent")).toBeUndefined()

    signInAs("viewer")
    expect((await fetchForms(params)).data.length).toBeGreaterThan(0)
    expect((await apiError(createForm({ name: "Yeni" }))).status).toBe(403)
    expect(
      (await apiError(updateForm("form_contact", { name: "Yeni" }))).status
    ).toBe(403)
  })

  it("keeps workspaces apart", async () => {
    signInAs("owner", { workspaceId: WORKSPACE_IDS.marmara })
    const marmara = await fetchForms(params)
    expect(marmara.data.map((form) => form.id)).toEqual(["form_marmara_quote"])
  })
})
