import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { migrateFormContent, type FormContent } from "@/engine/forms"
import { configureApiClient, isApiError } from "@/lib/api"
import { fetchFormStats } from "@/features/form-builder/api/forms.api"
import { db } from "@/mocks/db"
import { signInAs } from "@/test/auth"

import {
  fetchPublicForm,
  fetchPublicSite,
  submitPublicForm,
  trackPublicEvent,
} from "../api/public.api"
import type { SubmitFormInput } from "../api/public.schemas"

const ACME = "acme-lojistik.forms.localhost"

async function apiError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error
    throw error
  }
  throw new Error("expected an API error")
}

/** Edits the live version of the contact form (v1). */
function editContactForm(edit: (content: FormContent) => void) {
  const version = db.formVersions.findFirst(
    (row) => row.formId === "form_contact" && row.version === 1
  )!
  const content = migrateFormContent(version.content)
  edit(content)
  db.formVersions.update(version.id, { content })
}

const contactInput = (
  answers: Record<string, unknown> = {},
  meta: Partial<SubmitFormInput["meta"]> = {}
): SubmitFormInput => ({
  answers: {
    name: "Ayşe Demir",
    companyName: "Demir Tekstil",
    email: "ayse@demirtekstil.test",
    phone: null,
    message: "Konteyner fiyatı rica ederim.",
    consent: true,
    ...answers,
  },
  meta: {
    pageUrl: `http://${ACME}/f/iletisim?utm_source=google&utm_campaign=ekim`,
    referrer: "https://www.google.com/",
    embedded: false,
    language: "tr",
    ...meta,
  },
})

const contactSubmissions = () =>
  db.submissions.findMany((row) => row.formId === "form_contact")

describe("public site API (B5.4)", () => {
  beforeEach(() => configureApiClient({ publicHost: ACME }))
  afterEach(() => configureApiClient({ publicHost: undefined }))

  it("resolves a site by platform subdomain without leaking internals", async () => {
    const site = await fetchPublicSite(ACME)
    expect(site).toEqual({
      brand: expect.objectContaining({ name: "Acme Lojistik" }),
      seo: expect.objectContaining({ title: "Acme Lojistik — Navlun teklifi" }),
      legal: expect.objectContaining({
        kvkkUrl: "https://acmelojistik.com/kvkk",
      }),
      defaultFormSlug: null,
    })
  })

  it("TC-5.4-01 unknown hosts and pending custom domains are 404", async () => {
    configureApiClient({ publicHost: "nope.forms.localhost" })
    expect(
      (await apiError(fetchPublicSite("nope.forms.localhost"))).status
    ).toBe(404)

    db.domains.create({
      id: "dom_t",
      workspaceId: "ws_acme",
      hostname: "teklif.acmelojistik.com",
      status: "pending_dns",
      isPrimary: true,
      verifyToken: "x",
      failureReason: null,
      checkStartedAt: new Date().toISOString(),
      verifiedAt: null,
      createdAt: new Date().toISOString(),
    })
    configureApiClient({ publicHost: "teklif.acmelojistik.com" })
    expect((await apiError(fetchPublicForm("iletisim"))).status).toBe(404)

    db.domains.update("dom_t", { status: "active" })
    expect((await fetchPublicForm("iletisim")).name).toBe("İletişim Formu")
  })

  it("TC-5.4-02 serves only the live version of published forms", async () => {
    expect((await apiError(fetchPublicForm("acente-basvuru"))).code).toBe(
      "FORM_NOT_FOUND"
    )
    // Another tenant's form is not reachable through this host.
    expect((await apiError(fetchPublicForm("freight-quote"))).status).toBe(404)

    const freight = await fetchPublicForm("navlun-teklif")
    expect(freight.version).toBe(3)
    // The draft (not published yet) never shows.
    const draft = migrateFormContent(db.forms.findById("form_freight")!.draft)
    draft.steps[0]!.title = { tr: "Taslak başlık", en: "Draft" }
    db.forms.update("form_freight", { draft })
    expect(
      (await fetchPublicForm("navlun-teklif")).content.steps[0]!.title.tr
    ).not.toBe("Taslak başlık")
  })

  it("counts page views", async () => {
    const before = db.forms.findById("form_contact")!.views
    await trackPublicEvent({ type: "view", formSlug: "iletisim" })
    expect(db.forms.findById("form_contact")!.views).toBe(before + 1)
  })
})

describe("submission → lead (B5.5)", () => {
  beforeEach(() => configureApiClient({ publicHost: ACME }))
  afterEach(() => configureApiClient({ publicHost: undefined }))

  it("TC-5.5-02 creates a lead with the mapped values", async () => {
    const before = contactSubmissions().length
    await submitPublicForm("iletisim", contactInput())

    const submissions = contactSubmissions()
    expect(submissions).toHaveLength(before + 1)
    const submission = submissions.find(
      (row) =>
        row.status === "new" &&
        row.utm.source === "google" &&
        row.answers.email === "ayse@demirtekstil.test"
    )!
    expect(submission).toMatchObject({
      formVersion: 1,
      utm: { source: "google", campaign: "ekim", medium: null },
      referrer: "https://www.google.com/",
      record: { objectKey: "lead" },
      error: null,
    })

    const lead = db.records.findById(submission.record!.id)!
    expect(lead.values).toMatchObject({
      name: "Ayşe Demir",
      companyName: "Demir Tekstil",
      email: "ayse@demirtekstil.test",
      message: "Konteyner fiyatı rica ederim.",
      source: "webForm",
      stage: "new",
      // Mapping owner is empty → the form's creator.
      ownerId: "usr_admin",
    })
    const activity = db.activities.findFirst((row) => row.recordId === lead.id)
    expect(activity).toMatchObject({
      type: "note",
      direction: "inbound",
      subject: "Form gönderimi: İletişim Formu",
    })
    expect(activity!.body).toContain("Ad soyad: Ayşe Demir")
  })

  it("TC-5.5-02 rejects invalid answers like the renderer does", async () => {
    const error = await apiError(
      submitPublicForm("iletisim", contactInput({ email: "x", consent: false }))
    )
    expect(error.status).toBe(422)
    expect(Object.keys(error.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["email", "consent"])
    )
  })

  it("TC-5.5-03 a filled honeypot is accepted silently and stores nothing", async () => {
    const before = db.submissions.all().length
    const leads = db.records.findMany((row) => row.objectKey === "lead").length
    await expect(
      submitPublicForm(
        "iletisim",
        contactInput({}, { honeypot: "http://spam" })
      )
    ).resolves.toEqual({ ok: true })
    expect(db.submissions.all()).toHaveLength(before)
    expect(db.records.findMany((row) => row.objectKey === "lead")).toHaveLength(
      leads
    )
  })

  it("TC-5.5-04 links an existing contact by e-mail instead of a new lead", async () => {
    const contact = db.records.findFirst(
      (row) =>
        row.workspaceId === "ws_acme" &&
        row.objectKey === "contact" &&
        typeof row.values.email === "string"
    )!
    editContactForm((content) => {
      content.mapping.duplicate = "linkContactByEmail"
    })
    const leads = db.records.findMany((row) => row.objectKey === "lead").length

    await submitPublicForm(
      "iletisim",
      contactInput({ email: String(contact.values.email).toUpperCase() })
    )
    const submission = contactSubmissions().find(
      (row) => row.record?.objectKey === "contact"
    )!
    expect(submission.record).toEqual({ objectKey: "contact", id: contact.id })
    expect(db.records.findMany((row) => row.objectKey === "lead")).toHaveLength(
      leads
    )
    expect(
      db.activities.findFirst(
        (row) => row.recordId === contact.id && row.direction === "inbound"
      )
    ).toBeDefined()

    // Unknown e-mail: a new lead after all.
    await submitPublicForm(
      "iletisim",
      contactInput({ email: "yeni@kisi.test" })
    )
    expect(db.records.findMany((row) => row.objectKey === "lead")).toHaveLength(
      leads + 1
    )
  })

  it("TC-5.5-05 closes the form at its submission limit", async () => {
    const count = contactSubmissions().filter(
      (row) => row.status !== "spam"
    ).length
    editContactForm((content) => {
      content.settings.maxSubmissions = count + 1
    })
    await submitPublicForm("iletisim", contactInput())
    const error = await apiError(submitPublicForm("iletisim", contactInput()))
    expect(error.code).toBe("FORM_CLOSED")
  })

  it("a record that fails validation leaves the submission failed", async () => {
    editContactForm((content) => {
      delete content.mapping.fields.fld_name
    })
    await submitPublicForm(
      "iletisim",
      contactInput({ email: "eksik@isim.test" })
    )
    const submission = contactSubmissions().find(
      (row) => row.answers.email === "eksik@isim.test"
    )!
    expect(submission).toMatchObject({
      status: "failed",
      record: null,
      error: { code: "VALIDATION_ERROR" },
    })
    expect(submission.error!.message).toMatch(/^name: /)
  })

  it("TC-5.5-06 form stats come from submissions and views", async () => {
    signInAs("owner")
    const adminStats = () => {
      configureApiClient({ publicHost: undefined })
      const stats = fetchFormStats("form_contact")
      configureApiClient({ publicHost: ACME })
      return stats
    }
    const before = await adminStats()
    // Seed: 86 counted submissions (+2 spam that do not count).
    expect(before.submissions).toBe(86)
    expect(
      contactSubmissions().filter((row) => row.status === "spam")
    ).toHaveLength(2)

    await trackPublicEvent({ type: "view", formSlug: "iletisim" })
    await submitPublicForm("iletisim", contactInput())
    const after = await adminStats()
    expect(after.views).toBe(before.views + 1)
    expect(after.submissions).toBe(87)
    expect(after.conversionRate).toBeCloseTo(87 / (before.views + 1), 4)
  })
})
