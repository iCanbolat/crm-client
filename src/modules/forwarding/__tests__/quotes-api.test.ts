import { beforeEach, describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"

import {
  changeQuoteStatus,
  createQuote,
  fetchQuote,
  fetchQuoteDraft,
  reviseQuote,
  updateQuote,
} from "../api/quotes.api"
import type { QuoteInput } from "../api/quotes.schemas"
import { location } from "../mocks/reference/locations"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

function document(extra: Partial<QuoteInput> = {}): QuoteInput {
  const deal = acme("deal").find((row) => row.values.stage === "rate_research")!
  return {
    companyId: String(deal.values.companyId),
    contactId: null,
    dealId: deal.id,
    leadId: null,
    transportMode: "SEA_FCL",
    origin: location("TRIST"),
    destination: location("DEHAM"),
    incoterm: "FOB",
    currency: "USD",
    validUntil: "2099-12-31",
    cargo: { containers: [{ type: "40HC", count: 2 }], grossKg: 24000 },
    options: [
      {
        id: "o1",
        carrier: "MSC",
        transitDays: 18,
        lines: [
          {
            id: "l1",
            code: "OFR",
            basis: "container",
            quantity: 2,
            buyPrice: 1800,
            sellPrice: 2100,
            currency: "USD",
          },
          {
            id: "l2",
            code: "THC_O",
            basis: "container",
            quantity: 2,
            buyPrice: 180,
            sellPrice: 220,
            currency: "EUR",
          },
          {
            id: "l3",
            code: "DOC",
            basis: "shipment",
            quantity: 1,
            buyPrice: 50,
            sellPrice: 75,
            currency: "EUR",
          },
        ],
      },
    ],
    selectedOptionId: "o1",
    notes: null,
    ...extra,
  }
}

describe("quotes api (B3.4)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  it("TC-3.4-01 creates a numbered draft and mirrors totals on the quote record", async () => {
    const quote = await createQuote(document())
    expect(quote).toMatchObject({ status: "draft", version: 1, editable: true })
    expect(quote.quoteNumber).toMatch(/^Q-\d{4}-\d{4}$/)

    const record = db.records.findById(quote.id)!
    expect(record.values).toMatchObject({
      status: "draft",
      carrier: "MSC",
      transitDays: 18,
      totalSell: { amount: 4759.78, currency: "USD" },
      totalBuy: { amount: 4045.65, currency: "USD" },
      marginPercent: 15,
    })
  })

  it("validates the document and its relations", async () => {
    await expect(
      createQuote({ ...document(), options: [] })
    ).rejects.toMatchObject({
      status: 422,
    })
    await expect(
      createQuote(document({ companyId: "cmp_missing" }))
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: { companyId: expect.any(Array) },
    })
    await expect(
      createQuote(document({ selectedOptionId: "nope" }))
    ).rejects.toMatchObject({ status: 422 })

    signInAs("viewer")
    await expect(createQuote(document())).rejects.toMatchObject({ status: 403 })
  })

  it("TC-3.4-03 runs the status flow and refuses invalid transitions", async () => {
    const quote = await createQuote(document())
    await expect(
      changeQuoteStatus(quote.id, { action: "accept" })
    ).rejects.toMatchObject({ status: 409, code: "INVALID_TRANSITION" })

    const sent = await changeQuoteStatus(quote.id, {
      action: "send",
      email: { to: "musteri@example.com", message: "Teklifimiz ektedir." },
    })
    expect(sent.quote).toMatchObject({ status: "sent", editable: false })
    expect(sent.quote.sentAt).toBeTruthy()
    // "Send by email" is logged on the quote's timeline.
    expect(
      db.activities.findFirst(
        (row) => row.recordId === quote.id && row.type === "email"
      )?.body
    ).toContain("musteri@example.com")

    // A sent version is frozen.
    await expect(updateQuote(quote.id, document())).rejects.toMatchObject({
      status: 409,
      code: "QUOTE_NOT_EDITABLE",
    })

    const rejected = await changeQuoteStatus(quote.id, { action: "reject" })
    expect(rejected.quote.status).toBe("rejected")
    await expect(
      changeQuoteStatus(quote.id, { action: "accept" })
    ).rejects.toMatchObject({ status: 409 })
  })

  it("TC-3.4-04 a revision keeps the previous version untouched", async () => {
    const quote = await createQuote(document())
    await changeQuoteStatus(quote.id, { action: "send" })
    await expect(reviseQuote(quote.id)).resolves.toMatchObject({
      version: 2,
      status: "draft",
      editable: true,
    })

    const cheaper = document()
    cheaper.options[0]!.lines[0]!.sellPrice = 1990
    const v2 = await updateQuote(quote.id, cheaper)
    expect(v2.versions.map((item) => [item.version, item.status])).toEqual([
      [1, "sent"],
      [2, "draft"],
    ])

    const v1 = await fetchQuote(quote.id, 1)
    expect(v1).toMatchObject({ version: 1, status: "sent", editable: false })
    expect(v1.options[0]!.lines[0]!.sellPrice).toBe(2100)
    expect(v2.options[0]!.lines[0]!.sellPrice).toBe(1990)
    // The header follows the latest version.
    expect(db.records.findById(quote.id)!.values).toMatchObject({
      version: 2,
      status: "draft",
      sentAt: null,
    })
    await expect(reviseQuote(quote.id)).rejects.toMatchObject({
      status: 409,
      code: "QUOTE_NOT_REVISABLE",
    })
  })

  it("TC-3.4-05 a sent quote past its validity reads as expired", async () => {
    const quote = await createQuote(document({ validUntil: "2099-01-01" }))
    await changeQuoteStatus(quote.id, { action: "send" })
    const version = db.quoteVersions.findById(`${quote.id}:v1`)!
    db.quoteVersions.update(version.id, {
      document: { ...version.document, validUntil: "2020-01-01" },
    })

    const read = await fetchQuote(quote.id)
    expect(read.status).toBe("expired")
    expect(db.records.findById(quote.id)!.values.status).toBe("expired")
    await expect(
      changeQuoteStatus(quote.id, { action: "accept" })
    ).rejects.toMatchObject({ status: 409 })
    // Expired quotes can be revised into a new offer.
    await expect(reviseQuote(quote.id)).resolves.toMatchObject({ version: 2 })
  })

  it("TC-3.4-06 accepting creates the booking and wins the deal", async () => {
    const input = document()
    const quote = await createQuote(input)
    await changeQuoteStatus(quote.id, { action: "send" })
    const result = await changeQuoteStatus(quote.id, { action: "accept" })

    expect(result.quote.status).toBe("accepted")
    const shipment = db.records.findById(result.shipmentId!)!
    expect(shipment.objectKey).toBe("shipment")
    expect(shipment.values).toMatchObject({
      quoteId: quote.id,
      dealId: input.dealId,
      customerId: input.companyId,
      mode: "SEA_FCL",
      carrier: "MSC",
      status: "BOOKED",
      containers: [{ type: "40HC", count: 2 }],
    })
    expect(String(shipment.values.shipmentNumber)).toMatch(/^SHP-\d{4}-\d{4}$/)
    expect(
      db.milestones.findMany((row) => row.shipmentId === shipment.id)
    ).toHaveLength(1)
    expect(db.records.findById(quote.id)!.values.shipmentId).toBe(shipment.id)
    expect(db.records.findById(input.dealId!)!.values.stage).toBe("won")
  })

  it("prefills a draft from a freight request and a deal", async () => {
    const lead = acme("lead").find(
      (row) => row.values.transportMode === "SEA_FCL"
    )!
    const deal = acme("deal")[0]!
    const draft = await fetchQuoteDraft({ leadId: lead.id, dealId: deal.id })
    expect(draft).toMatchObject({
      leadId: lead.id,
      dealId: deal.id,
      companyId: deal.values.companyId,
      transportMode: "SEA_FCL",
      origin: lead.values.origin,
      cargo: { containers: lead.values.containers },
    })
    expect(draft.refs.dealId?.label).toBe(deal.values.name)

    const company = acme("company")[0]!
    expect((await fetchQuoteDraft({ companyId: company.id })).companyId).toBe(
      company.id
    )
  })

  it("TC-3.1-03 quote endpoints are gone when the module is inactive", async () => {
    db.workspaces.update(WORKSPACE_IDS.acme, { modules: [] })
    await expect(fetchQuoteDraft({})).rejects.toMatchObject({ status: 404 })
    await expect(createQuote(document())).rejects.toMatchObject({ status: 404 })
  })
})
