import { describe, expect, it } from "vitest"

import { toCsv } from "@/lib/csv"

import type { SubmissionSummary } from "../api/submissions.schemas"
import { SUBMISSION_CSV_COLUMNS, submissionsToCsv } from "../lib/csv"

const summary = (
  extra: Partial<SubmissionSummary> = {}
): SubmissionSummary => ({
  id: "sub_1",
  formId: "form_contact",
  formName: "İletişim Formu",
  formVersion: 1,
  status: "new",
  contactLabel: "Ayşe Demir · ayse@firma.test",
  utm: {
    source: "google",
    medium: "cpc",
    campaign: null,
    term: null,
    content: null,
  },
  record: { objectKey: "lead", id: "lead_1", title: "Ayşe Demir" },
  createdAt: "2026-10-08T10:00:00.000Z",
  ...extra,
})

describe("submissions CSV (B5.6)", () => {
  it("escapes delimiters, quotes, newlines and formulas", () => {
    expect(toCsv([["a,b", 'say "hi"', "x\ny", "=SUM(A1)", "ok"]])).toBe(
      '"a,b","say ""hi""","x\ny",\'=SUM(A1),ok'
    )
  })

  it("TC-5.6-03 has one header row and the expected columns", () => {
    const headers = Object.fromEntries(
      SUBMISSION_CSV_COLUMNS.map((column) => [column, column.toUpperCase()])
    ) as Record<(typeof SUBMISSION_CSV_COLUMNS)[number], string>
    const csv = submissionsToCsv(
      [
        summary(),
        summary({
          id: "sub_2",
          record: null,
          contactLabel: null,
          status: "failed",
        }),
      ],
      headers,
      (status) => `status:${status}`
    )
    const lines = csv.split("\r\n")
    expect(lines[0]).toBe(
      "CREATEDAT,FORM,STATUS,CONTACT,UTMSOURCE,UTMMEDIUM,UTMCAMPAIGN,RECORD,RECORDID"
    )
    expect(lines[1]).toBe(
      "2026-10-08T10:00:00.000Z,İletişim Formu,status:new,Ayşe Demir · ayse@firma.test,google,cpc,,Ayşe Demir,lead_1"
    )
    expect(lines[2]).toBe(
      "2026-10-08T10:00:00.000Z,İletişim Formu,status:failed,,google,cpc,,,"
    )
    expect(lines).toHaveLength(3)
  })
})
