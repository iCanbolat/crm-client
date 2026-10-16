import { describe, expect, it } from "vitest"

import { buildChecklist, templateKeyFor } from "../lib/checklist-templates"
import { isChecklistReady, summarizeChecklist } from "../lib/checklist"
import { computeCommission } from "../lib/commission"
import { checkEligibility } from "../lib/eligibility"
import { compareIntake, formatIntake, intakeKey } from "../lib/intake"
import {
  isScoreExpired,
  meetsLanguageRequirement,
  toCefr,
  validateScore,
} from "../lib/language"
import { nextFileNumber } from "../lib/numbering"
import { maskPassportNumber, passportValidity } from "../lib/passport"
import { planSummary, splitEvenly, validatePlan } from "../lib/payments"

const TODAY = "2026-10-15"

describe("language scores (B8.2)", () => {
  it("TC-8.2-01 validates ranges and steps per exam", () => {
    expect(validateScore({ exam: "IELTS", overall: 6.5 })).toBeNull()
    expect(validateScore({ exam: "IELTS", overall: 7.25 })).toMatchObject({
      code: "step",
      step: 0.5,
    })
    expect(validateScore({ exam: "IELTS", overall: 9.5 })).toMatchObject({
      code: "outOfRange",
    })
    expect(
      validateScore({ exam: "TOEFL", overall: 100, reading: 31 })
    ).toMatchObject({ code: "outOfRange", key: "reading", max: 30 })
    expect(validateScore({ exam: "TOEFL", overall: null })).toMatchObject({
      code: "overallRequired",
    })
    expect(validateScore({ exam: "GOETHE" })).toMatchObject({
      code: "levelRequired",
    })
    expect(validateScore({ exam: "GOETHE", level: "B2" })).toBeNull()
  })

  it("TC-8.2-02 maps results to CEFR and expires them after two years", () => {
    expect(toCefr({ exam: "IELTS", overall: 6.5 })).toBe("B2")
    expect(toCefr({ exam: "IELTS", overall: 7 })).toBe("C1")
    expect(toCefr({ exam: "TOEFL", overall: 100 })).toBe("C1")
    expect(toCefr({ exam: "PTE", overall: 58 })).toBe("B1")
    expect(toCefr({ exam: "DUOLINGO", overall: 120 })).toBe("B2")
    expect(toCefr({ exam: "TESTDAF", overall: 4 })).toBe("C1")
    expect(toCefr({ exam: "DELF", level: "B1" })).toBe("B1")
    expect(toCefr({ exam: "IELTS", overall: 2 })).toBeNull()

    expect(
      isScoreExpired(
        { exam: "IELTS", overall: 7, testDate: "2024-10-14" },
        TODAY
      )
    ).toBe(true)
    expect(
      isScoreExpired(
        { exam: "IELTS", overall: 7, testDate: "2024-10-16" },
        TODAY
      )
    ).toBe(false)
    expect(
      isScoreExpired(
        { exam: "GOETHE", level: "B2", testDate: "2015-01-01" },
        TODAY
      )
    ).toBe(false)
  })

  it("prefers a direct minimum of the same exam over the CEFR fallback", () => {
    const requirement = { minIelts: 6.5, minCefr: "B2" as const }
    expect(
      meetsLanguageRequirement(
        [{ exam: "IELTS", overall: 6 }],
        requirement,
        TODAY
      )
    ).toMatchObject({ status: "below", required: "IELTS 6.5 / CEFR B2" })
    expect(
      meetsLanguageRequirement(
        [{ exam: "TOEFL", overall: 95 }],
        requirement,
        TODAY
      )
    ).toMatchObject({ status: "met" })
    expect(meetsLanguageRequirement([], requirement, TODAY)).toEqual({
      status: "missing",
    })
    expect(meetsLanguageRequirement([], {}, TODAY)).toEqual({ status: "none" })
  })
})

describe("passport validity (B8.2)", () => {
  const passport = {
    number: "U12345678",
    issuingCountry: "TR",
    issuedAt: "2020-01-10",
    expiresAt: "2027-02-01",
  }

  it("TC-8.2-03 applies the Schengen 3-month and the 6-month rule", () => {
    // Schengen: 3 months after the return date.
    expect(
      passportValidity(passport, {
        today: TODAY,
        destination: "FR",
        returnDate: "2026-10-30",
      })
    ).toBe("expiresSoon")
    expect(
      passportValidity(
        { ...passport, expiresAt: "2030-01-01" },
        { today: TODAY, destination: "FR", returnDate: "2026-10-30" }
      )
    ).toBe("ok")
    expect(
      passportValidity(passport, {
        today: TODAY,
        destination: "FR",
        returnDate: "2026-11-15",
      })
    ).toBe("insufficient")
    // UK / US: 6 months beyond the stay.
    expect(
      passportValidity(passport, {
        today: TODAY,
        destination: "GB",
        returnDate: "2026-10-30",
      })
    ).toBe("insufficient")
    expect(
      passportValidity(
        { ...passport, expiresAt: "2026-10-01" },
        { today: TODAY }
      )
    ).toBe("expired")
    expect(passportValidity(null, { today: TODAY })).toBe("missing")
    // Schengen also needs an issue date within the last 10 years.
    expect(
      passportValidity(
        { ...passport, issuedAt: "2016-09-01", expiresAt: "2030-01-01" },
        { today: TODAY, destination: "DE" }
      )
    ).toBe("insufficient")
    expect(
      passportValidity(
        { ...passport, expiresAt: "2027-03-01" },
        { today: TODAY, destination: "US" }
      )
    ).toBe("insufficient")
  })

  it("masks the number", () => {
    expect(maskPassportNumber("U12345678")).toBe("U••••••78")
  })
})

describe("intake (B8.2)", () => {
  it("TC-8.2-04 compares and formats terms in both languages", () => {
    const fall = { year: 2027, month: 9 }
    const spring = { year: 2028, month: 1 }
    expect(compareIntake(fall, spring)).toBeLessThan(0)
    expect(intakeKey(fall)).toBe(202709)
    expect(formatIntake(fall, "tr")).toBe("Eylül 2027")
    expect(formatIntake(spring, "en")).toBe("January 2028")
  })
})

describe("eligibility (B8.3)", () => {
  const program = {
    minIelts: 6.5,
    minGpa: 3,
    applicationDeadline: "2027-01-15",
    intakeMonths: ["9"],
  }

  it("TC-8.3-02 warns about language, GPA, deadline and intake", () => {
    const findings = checkEligibility(
      {
        languageScores: [{ exam: "IELTS", overall: 6, testDate: "2026-05-01" }],
        educationHistory: [
          {
            level: "bachelor",
            institution: "Ege Üniversitesi",
            gpa: 70,
            gpaScale: 100,
            graduationYear: 2025,
          },
        ],
      },
      program,
      { today: "2027-02-01", intake: { year: 2027, month: 1 } }
    )
    expect(findings.map((finding) => finding.code)).toEqual([
      "LANGUAGE_BELOW_MIN",
      "GPA_BELOW_MIN",
      "DEADLINE_PASSED",
      "INTAKE_NOT_OFFERED",
    ])
    expect(findings[1]!.params).toMatchObject({ actual: 2.8, required: 3 })
  })

  it("flags expired results and passes a strong applicant", () => {
    expect(
      checkEligibility(
        {
          languageScores: [
            { exam: "IELTS", overall: 7.5, testDate: "2023-01-01" },
          ],
        },
        program,
        { today: TODAY }
      ).map((finding) => finding.code)
    ).toEqual(["LANGUAGE_EXPIRED"])
    expect(
      checkEligibility(
        {
          languageScores: [
            { exam: "IELTS", overall: 7, testDate: "2026-06-01" },
          ],
          educationHistory: [
            { level: "bachelor", institution: "ODTÜ", gpa: 3.4, gpaScale: 4 },
          ],
        },
        program,
        { today: TODAY, intake: { year: 2027, month: 9 } }
      )
    ).toEqual([])
  })
})

describe("commission (B8.5)", () => {
  const tuition = { amount: 20000, currency: "GBP" }

  it("TC-8.5-02 nets scholarships, scales by programme length, rounds", () => {
    expect(
      computeCommission({ tuition, rate: 15, basis: "first_year_tuition" })
    ).toEqual({ amount: 3000, currency: "GBP" })
    expect(
      computeCommission({
        tuition,
        scholarship: { amount: 2500, currency: "GBP" },
        rate: 15,
        basis: "first_year_tuition",
      })
    ).toEqual({ amount: 2625, currency: "GBP" })
    expect(
      computeCommission({
        tuition,
        rate: 10,
        basis: "full_tuition",
        durationMonths: 36,
      })
    ).toEqual({ amount: 6000, currency: "GBP" })
    expect(
      computeCommission({
        tuition,
        basis: "flat",
        flat: { amount: 1500, currency: "EUR" },
      })
    ).toEqual({ amount: 1500, currency: "EUR" })
    expect(
      computeCommission({
        tuition: { amount: 12345.67, currency: "EUR" },
        rate: 12.5,
      })
    ).toEqual({ amount: 1543.21, currency: "EUR" })
    expect(computeCommission({ tuition, rate: null })).toBeNull()
  })

  it("numbers files per prefix and year", () => {
    expect(
      nextFileNumber("ENR", ["ENR-2026-0007", "VSA-2026-0100", null], 2026)
    ).toBe("ENR-2026-0008")
    expect(nextFileNumber("ENR", ["ENR-2025-0042"], 2026)).toBe("ENR-2026-0001")
  })
})

describe("checklist templates (B8.7)", () => {
  const keys = (templateKey: string, context = {}) =>
    buildChecklist(templateKey, context).map((item) => item.key)

  it("TC-8.7-01 picks the template by destination, category and level", () => {
    expect(
      templateKeyFor("visaApplication", {
        destinationCountry: "FR",
        visaCategory: "tourist_schengen",
      })
    ).toBe("visa:SCHENGEN:tourist_schengen")
    expect(
      templateKeyFor("visaApplication", {
        destinationCountry: "GB",
        visaCategory: "student",
      })
    ).toBe("visa:GB:student")
    expect(
      templateKeyFor("enrollment", { studyLevel: "master", country: "DE" })
    ).toBe("edu:DE:postgraduate")
    expect(templateKeyFor("enrollment", {})).toBeNull()

    const schengen = keys("visa:SCHENGEN:tourist_schengen")
    expect(schengen).toEqual(
      expect.arrayContaining(["passport", "travel_insurance", "bank_statement"])
    )
    expect(schengen).not.toContain("sponsor_documents")
    expect(
      keys("visa:SCHENGEN:tourist_schengen", { hasSponsor: true })
    ).toContain("sponsor_documents")

    const uk = buildChecklist("visa:GB:student")
    expect(
      uk.find((item) => item.key === "confirmation_letter")!.label.tr
    ).toBe("CAS")
    expect(uk.map((item) => item.key)).toContain("medical")
    expect(keys("visa:GB:student")).not.toContain("travel_insurance")

    expect(keys("edu:GB:postgraduate")).toEqual(
      expect.arrayContaining(["reference_letter_1", "reference_letter_2", "cv"])
    )
    expect(keys("edu:GB:postgraduate")).not.toContain("portfolio")
    expect(
      keys("edu:IT:postgraduate", { fieldOfStudy: "architecture_design" })
    ).toContain("portfolio")
  })

  it("TC-8.7-02 only approved or not applicable items complete it", () => {
    const items = [
      { key: "a", label: "A", required: true, status: "approved" as const },
      { key: "b", label: "B", required: true, status: "received" as const },
      {
        key: "c",
        label: "C",
        required: true,
        status: "not_applicable" as const,
      },
      { key: "d", label: "D", required: false, status: "missing" as const },
    ]
    const summary = summarizeChecklist(items, TODAY)
    expect(summary).toMatchObject({ required: 3, complete: 2 })
    expect(summary.missing.map((item) => item.key)).toEqual(["b"])
    expect(isChecklistReady(items, TODAY)).toBe(false)
    items[1]!.status = "approved"
    expect(isChecklistReady(items, TODAY)).toBe(true)
  })

  it("TC-8.7-05 flags too old and expired documents", () => {
    const statement = {
      key: "bank_statement",
      label: "Banka dökümü",
      required: true,
      status: "approved" as const,
      maxAgeDays: 30,
      documentDate: "2026-09-01",
    }
    expect(summarizeChecklist([statement], TODAY).outdated).toHaveLength(1)
    expect(isChecklistReady([statement], TODAY)).toBe(false)
    expect(
      summarizeChecklist([{ ...statement, documentDate: "2026-10-01" }], TODAY)
        .outdated
    ).toHaveLength(0)
  })
})

describe("payment plans (B8.8)", () => {
  const fee = { amount: 10000, currency: "TRY" }

  it("TC-8.8-01 splits evenly and validates the total", () => {
    const installments = splitEvenly(fee, 3, "2026-11-01").map(
      (item, index) => ({
        ...item,
        id: `i${index}`,
      })
    )
    expect(installments.map((item) => item.amount)).toEqual([
      3333.33, 3333.33, 3333.34,
    ])
    expect(installments.map((item) => item.dueDate)).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
    ])
    expect(validatePlan({ serviceFee: fee, installments })).toBeNull()
    expect(
      validatePlan({
        serviceFee: fee,
        installments: installments.slice(0, 2),
      })
    ).toMatchObject({ code: "PLAN_TOTAL_MISMATCH", actual: 6666.66 })
    expect(
      validatePlan({
        serviceFee: fee,
        installments: [...installments].reverse(),
      })
    ).toMatchObject({ code: "DUE_DATES_ORDER" })
  })

  it("TC-8.8-02 summarizes paid, outstanding and overdue amounts", () => {
    const plan = {
      serviceFee: fee,
      installments: [
        {
          id: "1",
          label: "1",
          dueDate: "2026-09-01",
          amount: 4000,
          paidAmount: 4000,
          paidAt: "2026-09-01",
          method: "card" as const,
        },
        {
          id: "2",
          label: "2",
          dueDate: "2026-10-01",
          amount: 3000,
          paidAmount: 1000,
          paidAt: "2026-10-02",
          method: "cash" as const,
        },
        {
          id: "3",
          label: "3",
          dueDate: "2026-11-01",
          amount: 3000,
          paidAmount: 0,
          paidAt: null,
          method: null,
        },
      ],
    }
    expect(planSummary(plan, TODAY)).toEqual({
      currency: "TRY",
      total: 10000,
      paid: 5000,
      outstanding: 5000,
      overdueAmount: 2000,
      overdueCount: 1,
      nextDueDate: "2026-10-01",
      status: "overdue",
    })
    expect(planSummary(plan, "2026-09-15").status).toBe("on_track")
    expect(planSummary(null, TODAY).status).toBe("none")
  })
})
