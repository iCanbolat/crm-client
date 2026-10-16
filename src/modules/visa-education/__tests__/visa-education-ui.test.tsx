import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { renderRoute, screen } from "@/test/render"

const atlas = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.atlas && row.objectKey === objectKey
  )

const card = async (name: string) =>
  (await screen.findByRole("heading", { name, level: 2 })).closest(
    "[data-slot=card]"
  ) as HTMLElement

describe("visa & education screens (B8.1–B8.10)", () => {
  it("TC-8.1-06 Atlas users see the module navigation", async () => {
    await renderRoute("/", { as: "atlasOwner" })
    const nav = within(
      await screen.findByRole("navigation", { name: "Ana menü" })
    )
    for (const name of [
      "Başvuranlar",
      "Okul başvuruları",
      "Vize başvuruları",
      "Randevular",
      "Kurumlar",
      "Programlar",
    ]) {
      expect(await nav.findByRole("link", { name })).toBeInTheDocument()
    }
    expect(
      nav.queryByRole("link", { name: "Teklifler" })
    ).not.toBeInTheDocument()
  })

  it("TC-8.4-02 converts an enquiry into an applicant and a school file", async () => {
    const lead = atlas("lead").find(
      (row) =>
        row.values.stage === "new" && row.values.serviceType === "education"
    )!
    const { user, router } = await renderRoute(`/o/lead/${lead.id}`, {
      as: "atlasOwner",
    })
    expect(await card("Talep özeti")).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: "Dönüştür" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Talep kaydını dönüştür",
    })
    // Companies and deals are off in the visa sector (TC-10.2-03).
    expect(
      within(dialog).queryByRole("radiogroup", { name: "Şirket" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("checkbox", { name: "Fırsat oluştur" })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole("checkbox", { name: "Okul başvurusu aç" })
    ).toBeChecked()
    expect(
      within(dialog).getByRole("checkbox", { name: "Vize başvurusu aç" })
    ).not.toBeChecked()
    await user.click(within(dialog).getByRole("button", { name: "Dönüştür" }))

    await waitFor(() =>
      expect(db.records.findById(lead.id)!.values.stage).toBe("converted")
    )
    const enrollment = atlas("enrollment").find(
      (row) => row.values.leadId === lead.id
    )!
    expect(
      db.records.findById(String(enrollment.values.applicantId))!.values
    ).toMatchObject({ personRoles: ["applicant"], companyId: null })
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/o/enrollment/${enrollment.id}`
      )
    )
  })

  it("TC-8.5-04 / TC-8.7 school file: eligibility, checklist and status change", async () => {
    const enrollment = atlas("enrollment").find(
      (row) =>
        row.values.stage === "documents" &&
        db.checklistItems.findFirst(
          (item) => item.recordId === row.id && item.status === "missing"
        )
    )!
    const { user } = await renderRoute(`/o/enrollment/${enrollment.id}`, {
      as: "atlasOwner",
    })
    expect(await card("Uygunluk")).toBeInTheDocument()
    const checklist = within(await card("Belge kontrol listesi"))
    expect(
      await checklist.findByText(/zorunlu belge tamam/)
    ).toBeInTheDocument()

    const missing = db.checklistItems.findFirst(
      (item) => item.recordId === enrollment.id && item.status === "missing"
    )!
    const label =
      typeof missing.label === "string" ? missing.label : missing.label.tr
    await user.click(
      checklist.getByRole("combobox", { name: `${label} durumu` })
    )
    await user.click(
      await screen.findByRole("option", { name: "Gerekli değil" })
    )
    await waitFor(() =>
      expect(db.checklistItems.findById(missing.id)!.status).toBe(
        "not_applicable"
      )
    )
  })

  it("TC-8.8 creates a payment plan and records a payment", async () => {
    const visa = atlas("visaApplication").find(
      (row) =>
        !db.paymentPlans.findById(`visaApplication:${row.id}`) &&
        row.values.stage === "documents"
    )!
    const { user } = await renderRoute(`/o/visaApplication/${visa.id}`, {
      as: "atlasOwner",
    })
    const payments = within(await card("Ödeme planı"))
    await user.click(
      await payments.findByRole("button", { name: "Plan oluştur" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Ödeme planı oluştur",
    })
    await user.type(within(dialog).getByLabelText("Hizmet bedeli"), "9000")
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() =>
      expect(
        db.paymentPlans.findById(`visaApplication:${visa.id}`)?.installments
      ).toHaveLength(3)
    )
    const [first] = await payments.findAllByRole("button", {
      name: "Ödeme al",
    })
    await user.click(first!)
    const pay = await screen.findByRole("dialog", { name: /1\. taksit/ })
    await user.click(within(pay).getByRole("button", { name: "Ödeme al" }))
    await waitFor(() =>
      expect(db.records.findById(visa.id)!.values.paidAmount).toEqual({
        amount: 3000,
        currency: "TRY",
      })
    )
  })

  it("TC-8.8-05 records the school commission and adds a custom document", async () => {
    const enrollment = atlas("enrollment").find(
      (row) =>
        row.values.stage === "enrolled" &&
        row.values.commissionStatus !== "received" &&
        row.values.commissionExpected
    )!
    const { user } = await renderRoute(`/o/enrollment/${enrollment.id}`, {
      as: "atlasOwner",
    })
    const commission = within(await card("Okul komisyonu"))
    await user.click(commission.getByRole("button", { name: "Tahsilatı işle" }))
    const dialog = await screen.findByRole("dialog", { name: "Tahsilatı işle" })
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() =>
      expect(db.records.findById(enrollment.id)!.values.commissionStatus).toBe(
        "received"
      )
    )

    const checklist = within(await card("Belge kontrol listesi"))
    await user.click(checklist.getByRole("button", { name: "Belge ekle" }))
    const add = await screen.findByRole("dialog", {
      name: "Listeye belge ekle",
    })
    await user.type(within(add).getByLabelText("Belge adı"), "Denklik belgesi")
    await user.click(within(add).getByRole("button", { name: "Kaydet" }))
    expect(await checklist.findByText("Denklik belgesi")).toBeInTheDocument()
    await user.click(
      checklist.getByRole("button", { name: "Denklik belgesi kaldır" })
    )
    await waitFor(() =>
      expect(checklist.queryByText("Denklik belgesi")).not.toBeInTheDocument()
    )
  })

  it("TC-8.6 lists the appointments of a visa file", async () => {
    const appointment = atlas("appointment").find(
      (row) => row.values.status === "scheduled"
    )!
    await renderRoute(
      `/o/visaApplication/${String(appointment.values.visaApplicationId)}`,
      { as: "atlasOwner" }
    )
    const appointments = within(await card("Randevular"))
    expect(
      await appointments.findByRole("link", {
        name: String(appointment.values.title),
      })
    ).toBeInTheDocument()
  })

  it("TC-8.10-05 shows the module widgets on the dashboard", async () => {
    await renderRoute("/", { as: "atlasOwner" })
    for (const name of [
      "Açık talepler",
      "Vize onay oranı",
      "Okul başvuruları",
      "Yaklaşan randevular",
      "Eksik belgeler",
      "Dönem tahmini",
    ]) {
      expect(
        await screen.findByRole("region", { name }, { timeout: 5000 })
      ).toBeInTheDocument()
    }
    expect(await screen.findByTestId("approval-rate")).toHaveTextContent("%")
  })
})
