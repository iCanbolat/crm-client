import { describe, expect, it } from "vitest"

import { convertLead } from "@/features/leads/api/leads.api"
import {
  createRecord,
  fetchObjects,
  moveRecordStage,
  updateRecord,
} from "@/features/records/api/records.api"
import { activateModule } from "@/features/workspace/api/workspace.api"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"

import {
  addChecklistItem,
  deleteChecklistItem,
  fetchChecklist,
  fetchPaymentPlan,
  recordPayment,
  requestMissingDocuments,
  savePaymentPlan,
  startVisaApplication,
  updateChecklistItem,
} from "../api/visa-education.api"
import { syncChecklistSummary } from "../mocks/store"

const rows = (workspaceId: string, objectKey: string) =>
  db.records.findMany(
    (row) => row.workspaceId === workspaceId && row.objectKey === objectKey
  )
const atlas = (objectKey: string) => rows(WORKSPACE_IDS.atlas, objectKey)

const PASSPORT = {
  number: "U12345678",
  issuingCountry: "TR",
  issuedAt: "2024-01-10",
  expiresAt: "2034-01-09",
}

async function newApplicant(extra: Record<string, unknown> = {}) {
  return createRecord("contact", {
    name: "Deniz Test",
    email: "deniz.test@example.com",
    personRoles: ["applicant"],
    passport: PASSPORT,
    ...extra,
  })
}

/** Approves every checklist item (uploads a file first, as the API requires). */
function completeChecklist(objectKey: string, recordId: string) {
  for (const item of db.checklistItems.findMany(
    (row) => row.recordId === recordId
  )) {
    const attachment = db.attachments.create({
      id: `att_${item.id}`,
      workspaceId: WORKSPACE_IDS.atlas,
      objectKey,
      recordId,
      name: `${item.key}.pdf`,
      size: 100,
      mimeType: "application/pdf",
      uploadedBy: "usr_atlas_owner",
      uploadedAt: new Date().toISOString(),
      category: item.category,
    })
    db.checklistItems.update(item.id, {
      status: "approved",
      attachmentId: attachment.id,
      documentDate: new Date().toISOString().slice(0, 10),
    })
  }
  syncChecklistSummary(WORKSPACE_IDS.atlas, objectKey, recordId)
}

describe("module activation & seed (B8.1, B8.3)", () => {
  it("TC-8.1-01 Atlas gets the module objects; forwarding tenants do not", async () => {
    signInAs("atlasOwner")
    const { data } = await fetchObjects()
    const keys = data.map((def) => def.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        "institution",
        "program",
        "enrollment",
        "visaApplication",
        "appointment",
      ])
    )
    expect(keys).not.toContain("quote")
    const lead = data.find((def) => def.key === "lead")!
    expect(lead.fields.map((field) => field.key)).toContain("serviceType")
    expect(lead.fields.map((field) => field.key)).not.toContain("transportMode")

    signInAs("owner")
    const acme = (await fetchObjects()).data
    expect(acme.map((def) => def.key)).not.toContain("enrollment")
    expect(
      acme.find((def) => def.key === "lead")!.fields.map((field) => field.key)
    ).not.toContain("serviceType")
  })

  it("TC-8.3-03 seeds the catalogue and demo files of Atlas", () => {
    expect(atlas("institution")).toHaveLength(40)
    expect(atlas("program")).toHaveLength(120)
    expect(atlas("enrollment")).toHaveLength(90)
    expect(atlas("visaApplication")).toHaveLength(110)
    expect(db.checklistItems.count()).toBeGreaterThan(1000)
    const program = atlas("program")[0]!
    const institution = db.records.findById(
      String(program.values.institutionId)
    )!
    expect(program.values.country).toBe(institution.values.country)
  })

  it("TC-8.1-04 activating on a forwarding tenant adds the module once", async () => {
    signInAs("owner")
    await activateModule("visa-education")
    const workspace = await activateModule("visa-education")
    expect(workspace.modules).toEqual(["forwarding", "visa-education"])
    expect(rows(WORKSPACE_IDS.acme, "institution")).toHaveLength(40)

    const lead = (await fetchObjects()).data.find((def) => def.key === "lead")!
    const keys = lead.fields.map((field) => field.key)
    expect(keys).toEqual(
      expect.arrayContaining(["transportMode", "serviceType"])
    )
  })

  it("TC-8.3-01 a programme takes its country from the institution", async () => {
    signInAs("atlasOwner")
    const institution = atlas("institution").find(
      (row) => row.values.country === "CA"
    )!
    const program = await createRecord("program", {
      name: "MSc Test",
      institutionId: institution.id,
      studyLevel: "master",
    })
    expect(program.values.country).toBe("CA")
  })
})

describe("stage guards (B8.1, B8.6, B8.7)", () => {
  it("TC-8.1-02 / TC-8.6-02 an appointment is required before 'booked'", async () => {
    signInAs("atlasOwner")
    const applicant = await newApplicant()
    const visa = await createRecord("visaApplication", {
      applicantId: applicant.id,
      destinationCountry: "FR",
      visaCategory: "tourist_schengen",
    })
    expect(visa.values.applicationNumber).toMatch(/^VSA-\d{4}-\d{4}$/)

    await expect(
      moveRecordStage("visaApplication", visa.id, {
        stage: "appointment_booked",
      })
    ).rejects.toMatchObject({ status: 422, code: "APPOINTMENT_REQUIRED" })

    const at = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const appointment = await createRecord("appointment", {
      visaApplicationId: visa.id,
      provider: "VFS_GLOBAL",
      city: "istanbul",
      scheduledAt: at,
      kind: "biometrics",
      status: "scheduled",
    })
    // TC-8.6-01 / -03: title, applicant and next appointment are derived.
    expect(appointment.values).toMatchObject({
      title: "VFS Global · İstanbul",
      applicantId: applicant.id,
      country: "FR",
    })
    expect(db.records.findById(visa.id)!.values.nextAppointmentAt).toBe(at)

    const moved = await moveRecordStage("visaApplication", visa.id, {
      stage: "appointment_booked",
    })
    expect(moved.values.stage).toBe("appointment_booked")

    await updateRecord("appointment", appointment.id, { status: "cancelled" })
    expect(db.records.findById(visa.id)!.values.nextAppointmentAt).toBeNull()
  })

  it("TC-8.7-03 submission waits for a complete checklist and passport", async () => {
    signInAs("atlasOwner")
    const applicant = await newApplicant()
    const visa = await createRecord("visaApplication", {
      applicantId: applicant.id,
      destinationCountry: "DE",
      visaCategory: "tourist_schengen",
    })
    const checklist = await fetchChecklist("visaApplication", visa.id)
    expect(checklist.templateKey).toBe("visa:DE:tourist_schengen")
    expect(checklist.items.length).toBeGreaterThan(5)
    expect(checklist.summary.ready).toBe(false)

    db.records.create({
      id: "app_test",
      workspaceId: WORKSPACE_IDS.atlas,
      objectKey: "appointment",
      values: { visaApplicationId: visa.id, status: "attended" },
    })
    const error = await moveRecordStage("visaApplication", visa.id, {
      stage: "submitted",
      values: { submissionDate: "2026-10-10" },
    }).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ status: 422, code: "CHECKLIST_INCOMPLETE" })
    expect((error as Error).message).toMatch(/zorunlu belge/)

    completeChecklist("visaApplication", visa.id)
    // TC-8.7-05: an expired passport still blocks the submission.
    db.records.update(applicant.id, {
      values: {
        ...db.records.findById(applicant.id)!.values,
        passport: { ...PASSPORT, expiresAt: "2026-01-01" },
      },
    })
    await expect(
      moveRecordStage("visaApplication", visa.id, {
        stage: "submitted",
        values: { submissionDate: "2026-10-10" },
      })
    ).rejects.toMatchObject({ code: "PASSPORT_VALIDITY" })

    await updateRecord("contact", applicant.id, { passport: PASSPORT })
    const submitted = await moveRecordStage("visaApplication", visa.id, {
      stage: "submitted",
      values: { submissionDate: "2026-10-10" },
    })
    expect(submitted.values.stage).toBe("submitted")
    expect(submitted.values.checklistProgress).toBe(100)
  })

  it("rejected / withdrawn school applications skip the checklist gate", async () => {
    signInAs("atlasOwner")
    const applicant = await newApplicant()
    const enrollment = await createRecord("enrollment", {
      applicantId: applicant.id,
      programId: atlas("program")[0]!.id,
    })
    await expect(
      moveRecordStage("enrollment", enrollment.id, {
        stage: "applied",
        values: { appliedAt: "2026-10-01" },
      })
    ).rejects.toMatchObject({ code: "CHECKLIST_INCOMPLETE" })
    const withdrawn = await moveRecordStage("enrollment", enrollment.id, {
      stage: "withdrawn",
      values: { withdrawReason: "budget" },
    })
    expect(withdrawn.values.stage).toBe("withdrawn")
  })
})

describe("school applications (B8.5)", () => {
  it("TC-8.5-01 numbers the file and derives programme values", async () => {
    signInAs("atlasOwner")
    const applicant = await newApplicant()
    const program = atlas("program").find(
      (row) => row.values.country === "GB" && row.values.studyLevel === "master"
    )!
    const institution = db.records.findById(
      String(program.values.institutionId)
    )!
    const enrollment = await createRecord("enrollment", {
      applicantId: applicant.id,
      programId: program.id,
      intake: { year: 2027, month: 9 },
    })
    expect(enrollment.values).toMatchObject({
      enrollmentNumber: expect.stringMatching(/^ENR-\d{4}-\d{4}$/),
      institutionId: institution.id,
      country: "GB",
      studyLevel: "master",
      tuitionFee: program.values.tuitionFee,
      confirmationDocType: "CAS",
      commissionStatus: "none",
    })
    if (institution.values.commissionBasis === "first_year_tuition") {
      expect(enrollment.values.commissionRate).toBe(
        institution.values.commissionRate
      )
      expect(enrollment.values.commissionExpected).not.toBeNull()
    }
    const checklist = await fetchChecklist("enrollment", enrollment.id)
    expect(checklist.templateKey).toBe("edu:GB:postgraduate")
  })

  it("TC-8.5-05 starts a prefilled student visa only once", async () => {
    signInAs("atlasOwner")
    const notReady = atlas("enrollment").find(
      (row) => row.values.stage === "applied"
    )!
    await expect(startVisaApplication(notReady.id)).rejects.toMatchObject({
      status: 409,
      code: "ENROLLMENT_NOT_READY",
    })

    const ready = atlas("enrollment").find(
      (row) => row.values.stage === "confirmation"
    )!
    db.records.update(ready.id, {
      values: { ...ready.values, visaApplicationId: null },
    })
    const visa = await startVisaApplication(ready.id)
    expect(visa.values).toMatchObject({
      applicantId: ready.values.applicantId,
      destinationCountry: ready.values.country,
      visaCategory: "student",
      enrollmentId: ready.id,
      stage: "consultation",
    })
    expect(db.records.findById(ready.id)!.values.visaApplicationId).toBe(
      visa.id
    )
    await expect(startVisaApplication(ready.id)).rejects.toMatchObject({
      code: "VISA_ALREADY_STARTED",
    })
  })
})

describe("B2C lead conversion (B8.4)", () => {
  function enquiry(serviceType: string) {
    return createRecord("lead", {
      name: "Mira Kaya",
      email: "mira.kaya@example.com",
      serviceType,
      targetCountries: ["GB", "IE"],
      visaCategory: serviceType === "education" ? null : "student",
      desiredIntake: serviceType === "visa" ? null : { year: 2027, month: 9 },
      passport: PASSPORT,
      languageScores: [{ exam: "IELTS", overall: 7 }],
    })
  }

  it("TC-8.4-02 creates an applicant without a company plus the school file", async () => {
    signInAs("atlasOwner")
    const lead = await enquiry("education")
    const result = await convertLead(lead.id, {
      company: { mode: "none" },
      contact: { mode: "new", name: "Mira Kaya" },
      deal: { create: false },
      targets: ["enrollment"],
    })
    expect(result.companyId).toBeNull()
    expect(result.targets).toHaveLength(1)
    const contact = db.records.findById(result.contactId!)!
    expect(contact.values).toMatchObject({
      personRoles: ["applicant"],
      passport: PASSPORT,
      languageScores: [{ exam: "IELTS", overall: 7 }],
      companyId: null,
    })
    const enrollment = db.records.findById(result.targets[0]!.id)!
    expect(enrollment.values).toMatchObject({
      applicantId: contact.id,
      leadId: lead.id,
      intake: { year: 2027, month: 9 },
      stage: "counselling",
    })
    expect(result.lead.values.stage).toBe("converted")
  })

  it("TC-8.4-03 'both' opens two files; invalid combinations are refused", async () => {
    signInAs("atlasOwner")
    const lead = await enquiry("both")
    await expect(
      convertLead(lead.id, {
        company: { mode: "none" },
        contact: { mode: "none" },
        deal: { create: false },
        targets: [],
      })
    ).rejects.toMatchObject({ status: 422, code: "CONTACT_REQUIRED" })

    const result = await convertLead(lead.id, {
      company: { mode: "none" },
      contact: { mode: "new", name: "Mira Kaya" },
      deal: { create: false },
      targets: ["enrollment", "visaApplication"],
    })
    const visa = db.records.findById(
      result.targets.find((item) => item.objectKey === "visaApplication")!.id
    )!
    expect(visa.values).toMatchObject({
      destinationCountry: "GB",
      visaCategory: "student",
      applicantId: result.contactId,
    })

    // Forwarding tenants keep the B2B conversion.
    signInAs("owner")
    const freight = rows(WORKSPACE_IDS.acme, "lead").find(
      (row) => row.values.stage === "new"
    )!
    await expect(
      convertLead(freight.id, {
        company: { mode: "none" },
        contact: { mode: "new", name: "X" },
        deal: { create: false },
      })
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe("checklist API (B8.7)", () => {
  async function visaFile() {
    signInAs("atlasOwner")
    const applicant = await newApplicant({ sponsorId: null })
    return createRecord("visaApplication", {
      applicantId: applicant.id,
      destinationCountry: "GB",
      visaCategory: "student",
    })
  }

  it("TC-8.7-04 approving needs a file; uploads fill the matching item", async () => {
    const visa = await visaFile()
    const { items } = await fetchChecklist("visaApplication", visa.id)
    const cas = items.find((item) => item.key === "confirmation_letter")!
    await expect(
      updateChecklistItem("visaApplication", visa.id, cas.id, {
        status: "approved",
      })
    ).rejects.toMatchObject({ code: "ATTACHMENT_REQUIRED" })

    const attachment = db.attachments.create({
      id: "att_cas",
      workspaceId: WORKSPACE_IDS.atlas,
      objectKey: "visaApplication",
      recordId: visa.id,
      name: "cas.pdf",
      size: 10,
      mimeType: "application/pdf",
      uploadedBy: "usr_atlas_owner",
      uploadedAt: new Date().toISOString(),
      category: "confirmation_letter",
    })
    const received = await updateChecklistItem(
      "visaApplication",
      visa.id,
      cas.id,
      { attachmentId: attachment.id }
    )
    expect(received.items.find((item) => item.id === cas.id)).toMatchObject({
      status: "received",
      attachmentId: "att_cas",
    })
    const approved = await updateChecklistItem(
      "visaApplication",
      visa.id,
      cas.id,
      {
        status: "approved",
      }
    )
    expect(approved.summary.complete).toBe(1)
    expect(db.records.findById(visa.id)!.values.missingDocuments).toBe(
      approved.summary.missing
    )
  })

  it("an uploaded document of a category fills the open item", async () => {
    const visa = await visaFile()
    const { notifyAttachmentAdded } =
      await import("@/features/records/mocks/store")
    notifyAttachmentAdded({
      workspaceId: WORKSPACE_IDS.atlas,
      objectKey: "visaApplication",
      recordId: visa.id,
      attachmentId: "att_photo",
      category: "photo",
    })
    const { items } = await fetchChecklist("visaApplication", visa.id)
    expect(items.find((item) => item.key === "photo")).toMatchObject({
      status: "received",
      attachmentId: "att_photo",
    })
    await expect(
      addChecklistItem("visaApplication", visa.id, {
        label: "",
        category: "other",
      })
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" })
  })

  it("TC-8.7-06 custom items can be removed, template items cannot", async () => {
    const visa = await visaFile()
    const added = await addChecklistItem("visaApplication", visa.id, {
      label: "Askerlik durum belgesi",
      category: "other",
      required: true,
    })
    const custom = added.items.find((item) => item.custom)!
    const template = added.items.find((item) => !item.custom)!
    await expect(
      deleteChecklistItem("visaApplication", visa.id, template.id)
    ).rejects.toMatchObject({ status: 409, code: "TEMPLATE_ITEM" })
    const after = await deleteChecklistItem(
      "visaApplication",
      visa.id,
      custom.id
    )
    expect(after.items.some((item) => item.id === custom.id)).toBe(false)

    const requested = await requestMissingDocuments("visaApplication", visa.id)
    expect(
      requested.items
        .filter((item) => item.required)
        .every((item) => item.status === "requested")
    ).toBe(true)
  })

  it("TC-8.7-07 agents cannot edit other counsellors' files", async () => {
    const visa = await visaFile()
    signInAs("atlasEducation")
    const { items } = await fetchChecklist("visaApplication", visa.id)
    await expect(
      updateChecklistItem("visaApplication", visa.id, items[0]!.id, {
        status: "not_applicable",
      })
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe("payment plans (B8.8)", () => {
  it("TC-8.8-03 paid instalments are locked; overpayments are refused", async () => {
    signInAs("atlasOwner")
    const applicant = await newApplicant()
    const visa = await createRecord("visaApplication", {
      applicantId: applicant.id,
      destinationCountry: "IT",
      visaCategory: "tourist_schengen",
    })
    const empty = await fetchPaymentPlan("visaApplication", visa.id)
    expect(empty).toMatchObject({ plan: null, summary: { status: "none" } })

    await expect(
      savePaymentPlan("visaApplication", visa.id, {
        serviceFee: { amount: 9000, currency: "TRY" },
        installments: [{ label: "1", dueDate: "2026-11-01", amount: 5000 }],
      })
    ).rejects.toMatchObject({ code: "PLAN_TOTAL_MISMATCH" })

    const saved = await savePaymentPlan("visaApplication", visa.id, {
      serviceFee: { amount: 9000, currency: "TRY" },
      installments: [
        { label: "1", dueDate: "2026-11-01", amount: 4500 },
        { label: "2", dueDate: "2026-12-01", amount: 4500 },
      ],
    })
    const first = saved.plan!.installments[0]!
    await expect(
      recordPayment("visaApplication", visa.id, first.id, {
        amount: 5000,
        paidAt: "2026-10-20",
        method: "card",
      })
    ).rejects.toMatchObject({ code: "OVERPAID" })
    const paid = await recordPayment("visaApplication", visa.id, first.id, {
      amount: 4500,
      paidAt: "2026-10-20",
      method: "card",
    })
    expect(paid.summary).toMatchObject({ paid: 4500, outstanding: 4500 })
    expect(db.records.findById(visa.id)!.values).toMatchObject({
      paidAmount: { amount: 4500, currency: "TRY" },
      outstandingAmount: { amount: 4500, currency: "TRY" },
      nextDueDate: "2026-12-01",
    })

    await expect(
      savePaymentPlan("visaApplication", visa.id, {
        serviceFee: { amount: 9000, currency: "TRY" },
        installments: [{ label: "1", dueDate: "2026-11-01", amount: 9000 }],
      })
    ).rejects.toMatchObject({ status: 409, code: "INSTALLMENT_PAID" })
  })
})
