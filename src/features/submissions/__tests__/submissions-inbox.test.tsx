import { waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { db } from "@/mocks/db"
import { renderRoute, screen } from "@/test/render"

import type { SubmissionRow } from "../mocks/types"

const table = () => screen.findByRole("table", { name: "Gönderimler" })
const rows = async () =>
  within(await table())
    .getAllByRole("row")
    .slice(1)

function addSubmission(extra: Partial<SubmissionRow> = {}): SubmissionRow {
  return db.submissions.create({
    id: "sub_test",
    workspaceId: "ws_acme",
    formId: "form_contact",
    formVersion: 1,
    answers: {
      name: "Zehra Kılıç",
      companyName: "Kılıç Gıda",
      email: "zehra@kilicgida.test",
      phone: null,
      message: "Soğuk zincir taşıma",
      consent: true,
    },
    status: "new",
    record: null,
    utm: {
      source: "fuar",
      medium: null,
      campaign: null,
      term: null,
      content: null,
    },
    referrer: null,
    pageUrl: "https://acmelojistik.com/iletisim",
    embedded: true,
    language: "tr",
    error: null,
    // Newer than every seeded submission: first row.
    createdAt: new Date().toISOString(),
    ...extra,
  })
}

describe("submissions inbox (B5.6)", () => {
  it("lists submissions newest first without spam", async () => {
    addSubmission()
    await renderRoute("/submissions", { as: "owner" })
    const [first] = await rows()
    expect(first).toHaveTextContent("Zehra Kılıç · zehra@kilicgida.test")
    expect(first).toHaveTextContent("İletişim Formu")
    expect(first).toHaveTextContent("fuar")
    expect(screen.getByText("Toplam 301 kayıt")).toBeInTheDocument()
  })

  it("TC-5.6-01 marks a submission as spam", async () => {
    addSubmission()
    const { user } = await renderRoute("/submissions", { as: "owner" })
    await user.click(
      await screen.findByRole("button", {
        name: "Zehra Kılıç · zehra@kilicgida.test gönderimini aç",
      })
    )
    const sheet = await screen.findByRole("dialog")
    expect(
      await within(sheet).findByText("Soğuk zincir taşıma")
    ).toBeInTheDocument()
    expect(within(sheet).getByText("Sitenize gömülü form")).toBeInTheDocument()

    await user.click(
      within(sheet).getByRole("button", { name: "Spam olarak işaretle" })
    )
    await waitFor(() =>
      expect(db.submissions.findById("sub_test")!.status).toBe("spam")
    )
    expect(
      await within(sheet).findByRole("button", { name: "Yeni olarak işaretle" })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText("Toplam 300 kayıt")).toBeInTheDocument()
    )
  })

  it("TC-5.6-02 converts a failed submission into a lead", async () => {
    addSubmission({
      status: "failed",
      error: { code: "VALIDATION_ERROR", message: "name: Zorunlu alan" },
    })
    const { user } = await renderRoute("/submissions?status=failed", {
      as: "owner",
    })
    await user.click(
      await screen.findByRole("button", {
        name: /Zehra Kılıç .* gönderimini aç/,
      })
    )
    const sheet = await screen.findByRole("dialog")
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "name: Zorunlu alan"
    )

    await user.click(
      within(sheet).getByRole("button", { name: "Lead'e dönüştür" })
    )
    const link = await within(sheet).findByRole("link", { name: /Zehra Kılıç/ })
    const row = db.submissions.findById("sub_test")!
    expect(row).toMatchObject({
      status: "processed",
      error: null,
      record: { objectKey: "lead" },
    })
    expect(link).toHaveAttribute("href", `/o/lead/${row.record!.id}`)
    expect(db.records.findById(row.record!.id)!.values).toMatchObject({
      name: "Zehra Kılıç",
      source: "webForm",
    })
  })

  it("TC-5.6-04 keeps filters in the URL", async () => {
    const { user, router } = await renderRoute("/submissions", { as: "owner" })
    await table()
    await user.click(screen.getByRole("combobox", { name: "Durum" }))
    await user.click(await screen.findByRole("option", { name: "Spam" }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ status: "spam" })
    )
    // Seed: 2 spam per published form with submissions (4 forms).
    expect(await screen.findByText("Toplam 6 kayıt")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Form" }))
    await user.click(
      await screen.findByRole("option", { name: "Webinar Kaydı" })
    )
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        status: "spam",
        formId: "form_webinar",
      })
    )
    expect(await screen.findByText("Toplam 2 kayıt")).toBeInTheDocument()
  })

  it("shows one form's inbox under the form", async () => {
    await renderRoute("/forms/form_webinar/submissions", { as: "manager" })
    expect(
      await screen.findByRole("heading", {
        name: "Webinar Kaydı — gönderimler",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("Toplam 50 kayıt")).toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "Form" })
    ).not.toBeInTheDocument()
  })

  it("downloads the filtered list as CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:csv")
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    const { user } = await renderRoute("/forms/form_webinar/submissions", {
      as: "owner",
    })
    await table()
    await user.click(screen.getByRole("button", { name: "CSV indir" }))
    expect(await screen.findByText("50 gönderim indirildi")).toBeInTheDocument()
    expect(click).toHaveBeenCalledOnce()
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    const text = await blob.text()
    expect(text.split("\r\n")).toHaveLength(51)
    expect(text).toContain("Tarih,Form,Durum,Kişi")
  })

  it("is read-only for agents", async () => {
    addSubmission()
    const { user } = await renderRoute("/submissions", { as: "agent" })
    await user.click(
      await screen.findByRole("button", {
        name: /Zehra Kılıç .* gönderimini aç/,
      })
    )
    const sheet = await screen.findByRole("dialog")
    await within(sheet).findByText("Soğuk zincir taşıma")
    expect(
      within(sheet).queryByRole("button", { name: /işaretle|dönüştür/ })
    ).not.toBeInTheDocument()
  })
})
