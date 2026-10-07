import { describe, expect, it } from "vitest"

import {
  migrateFormContent,
  suggestMapping,
  validateFormForPublish,
  type FormContent,
} from "@/engine/forms"
import { getObjectDef } from "@/features/records/mocks/store"
import { isApiError } from "@/lib/api"
import { db } from "@/mocks/db"
import { signInAs } from "@/test/auth"

import {
  fetchForm,
  fetchFormVersion,
  fetchFormVersions,
  publishForm,
  restoreFormVersion,
  unpublishForm,
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

describe("publishing & versions API (mock, B4.7)", () => {
  it("seeded forms are publishable; the v1 form needs mapping first", () => {
    const errors = (content: FormContent, workspaceId: string) =>
      validateFormForPublish(content, getObjectDef(workspaceId, "lead")).filter(
        (issue) => issue.severity === "error"
      )
    for (const row of db.forms.all()) {
      const content = migrateFormContent(row.draft)
      if (row.id !== "form_webinar") {
        expect(errors(content, row.workspaceId), row.id).toEqual([])
        continue
      }
      // Saved before mappings existed: "auto-map" finds the lead name.
      expect(errors(content, row.workspaceId)).toEqual([
        { code: "requiredTarget", severity: "error", target: "name" },
      ])
      const lead = getObjectDef(row.workspaceId, "lead")!
      content.mapping.fields = suggestMapping(content, lead)
      expect(errors(content, row.workspaceId)).toEqual([])
    }
  })

  it("TC-4.7-01 publishing freezes a version; later drafts do not change it", async () => {
    signInAs("manager")
    const published = await publishForm("form_agent")
    expect(published).toMatchObject({
      status: "published",
      publishedVersion: 1,
      hasUnpublishedChanges: false,
    })

    const draft = structuredClone(published.content)
    draft.fields[0]!.label.tr = "Yetkili kişi"
    const saved = await updateForm("form_agent", { content: draft })
    expect(saved.hasUnpublishedChanges).toBe(true)

    const v1 = await fetchFormVersion("form_agent", 1)
    expect(v1.content.fields[0]?.label.tr).toBe("Ad soyad")
    expect(v1).toMatchObject({ isLive: true, publishedByName: "Zeynep Kaya" })

    const second = await publishForm("form_agent")
    expect(second.publishedVersion).toBe(2)
    const versions = await fetchFormVersions("form_agent")
    expect(
      versions.data.map((version) => [version.version, version.isLive])
    ).toEqual([
      [2, true],
      [1, false],
    ])
  })

  it("TC-4.7-03 restoring an old version and publishing it again", async () => {
    signInAs("owner")
    const restored = await restoreFormVersion("form_freight", 1)
    expect(restored.hasUnpublishedChanges).toBe(true)
    expect(
      restored.content.fields.some((field) => field.key === "containers")
    ).toBe(false)
    // The live version is untouched until the next publish.
    expect((await fetchForm("form_freight")).publishedVersion).toBe(3)

    const republished = await publishForm("form_freight")
    expect(republished.publishedVersion).toBe(4)
    const v4 = await fetchFormVersion("form_freight", 4)
    const v1 = await fetchFormVersion("form_freight", 1)
    expect(v4.content).toEqual(v1.content)
    expect((await apiError(fetchFormVersion("form_freight", 9))).status).toBe(
      404
    )
  })

  it("TC-4.5-01 / TC-4.5-02 rejects unmapped required and mismatched fields", async () => {
    signInAs("owner")
    const form = await fetchForm("form_agent")
    const content = structuredClone(form.content)
    delete content.mapping.fields.fld_name
    content.mapping.fields.fld_email = "estimatedValue"
    await updateForm("form_agent", { content })

    const error = await apiError(publishForm("form_agent"))
    expect(error).toMatchObject({ status: 422, code: "FORM_NOT_PUBLISHABLE" })
    expect(error.details).toEqual({
      issues: [
        {
          code: "typeMismatch",
          severity: "error",
          fieldId: "fld_email",
          target: "estimatedValue",
        },
        { code: "requiredTarget", severity: "error", target: "name" },
      ],
    })
    expect((await fetchForm("form_agent")).status).toBe("draft")
  })

  it("unpublishes; agents cannot publish", async () => {
    signInAs("owner")
    const draft = await unpublishForm("form_contact")
    expect(draft).toMatchObject({ status: "draft", publishedVersion: null })
    expect((await fetchFormVersions("form_contact")).data[0]?.isLive).toBe(
      false
    )

    signInAs("agent")
    expect((await apiError(publishForm("form_contact"))).status).toBe(403)
    expect((await apiError(restoreFormVersion("form_contact", 1))).status).toBe(
      403
    )
    expect((await fetchFormVersions("form_contact")).data).toHaveLength(1)
  })
})
