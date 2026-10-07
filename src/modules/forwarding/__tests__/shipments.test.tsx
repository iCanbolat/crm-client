import { waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  createRecord,
  uploadAttachments,
} from "@/features/records/api/records.api"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"
import { renderRoute, screen } from "@/test/render"

import { fetchMilestones, recordMilestone } from "../api/shipments.api"
import {
  dayDiff,
  getDelay,
  nextMilestones,
  validateMilestone,
  type MilestoneEvent,
} from "../lib/milestones"
import { location } from "../mocks/reference/locations"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

const event = (
  milestone: MilestoneEvent["milestone"],
  at: string
): MilestoneEvent => ({
  milestone,
  at,
})

const NOW = new Date("2026-10-06T12:00:00Z")

describe("milestone rules (B3.5)", () => {
  it("TC-3.5-01 keeps the order; transshipment is optional", () => {
    expect(nextMilestones([])).toEqual(["BOOKED"])
    const departed = [
      event("BOOKED", "2026-09-01T09:00:00Z"),
      event("CARGO_READY", "2026-09-05T09:00:00Z"),
      event("PICKED_UP", "2026-09-06T09:00:00Z"),
      event("DEPARTED", "2026-09-07T09:00:00Z"),
    ]
    expect(nextMilestones(departed)).toEqual(["TRANSSHIPMENT", "ARRIVED"])
    expect(
      validateMilestone(departed, "ARRIVED", new Date("2026-09-20"), NOW)
    ).toBeNull()
    expect(
      validateMilestone(departed, "DELIVERED", new Date("2026-09-20"), NOW)
    ).toBe("ORDER")
    expect(
      validateMilestone(departed, "DEPARTED", new Date("2026-09-20"), NOW)
    ).toBe("DUPLICATE")
    expect(
      validateMilestone(departed, "BOOKED", new Date("2026-09-20"), NOW)
    ).toBe("DUPLICATE")
  })

  it("TC-3.5-01 refuses future dates and dates before the previous milestone", () => {
    const booked = [event("BOOKED", "2026-09-01T09:00:00Z")]
    expect(
      validateMilestone(
        booked,
        "CARGO_READY",
        new Date("2026-10-07T09:00:00Z"),
        NOW
      )
    ).toBe("FUTURE")
    expect(
      validateMilestone(
        booked,
        "CARGO_READY",
        new Date("2026-08-30T09:00:00Z"),
        NOW
      )
    ).toBe("BEFORE_PREVIOUS")
  })

  it("TC-3.5-02 flags a shipment whose ETA passed without arrival", () => {
    expect(dayDiff("2026-09-28", "2026-10-02")).toBe(4)
    expect(
      getDelay({ etd: "2026-09-01", eta: "2026-10-01" }, "2026-10-04")
    ).toEqual({
      departure: 33,
      arrival: 3,
      delayed: true,
    })
    expect(
      getDelay(
        {
          etd: "2026-09-01",
          eta: "2026-10-01",
          atd: "2026-09-02",
          ata: "2026-09-30",
        },
        "2026-10-04"
      )
    ).toEqual({ departure: 1, arrival: -1, delayed: false })
    expect(getDelay({ eta: "2026-10-10" }, "2026-10-04").delayed).toBe(false)
  })
})

describe("shipments (B3.5)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  async function newShipment(extra: Record<string, unknown> = {}) {
    const customer = acme("company")[0]!
    return createRecord("shipment", {
      mode: "AIR",
      origin: location("IST"),
      destination: location("FRA"),
      etd: "2026-09-20",
      eta: "2026-09-22",
      customerId: customer.id,
      awbNumber: "235-12345678",
      ...extra,
    })
  }

  it("numbers manual bookings and starts them as booked", async () => {
    const shipment = await newShipment()
    expect(shipment.values).toMatchObject({ status: "BOOKED" })
    expect(String(shipment.values.shipmentNumber)).toMatch(/^SHP-\d{4}-\d{4}$/)
    // The ETA passed without arrival: delayed.
    expect(shipment.values.delayed).toBe(true)
  })

  it("TC-3.5-01 records milestones in order and updates ATD/ATA", async () => {
    const shipment = await newShipment({ etd: "2026-01-10", eta: "2026-01-12" })
    const at = (day: string) => `2026-01-${day}T10:00:00.000Z`

    await recordMilestone(shipment.id, { milestone: "BOOKED", at: at("05") })
    await expect(
      recordMilestone(shipment.id, { milestone: "DEPARTED", at: at("10") })
    ).rejects.toMatchObject({ status: 422, code: "MILESTONE_ORDER" })
    await expect(
      recordMilestone(shipment.id, {
        milestone: "CARGO_READY",
        at: "2099-01-01T10:00:00.000Z",
      })
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: { at: expect.any(Array) },
    })
    await expect(
      recordMilestone(shipment.id, { milestone: "CARGO_READY", at: at("01") })
    ).rejects.toMatchObject({ code: "MILESTONE_BEFORE_PREVIOUS" })

    await recordMilestone(shipment.id, {
      milestone: "CARGO_READY",
      at: at("08"),
    })
    await recordMilestone(shipment.id, { milestone: "PICKED_UP", at: at("09") })
    await recordMilestone(shipment.id, { milestone: "DEPARTED", at: at("11") })
    // Transshipment may be skipped.
    const list = await recordMilestone(shipment.id, {
      milestone: "ARRIVED",
      at: at("13"),
      note: "Gümrüğe girdi",
    })
    expect(list.next).toEqual(["CUSTOMS_CLEARED"])
    expect(db.records.findById(shipment.id)!.values).toMatchObject({
      status: "ARRIVED",
      atd: "2026-01-11",
      ata: "2026-01-13",
      delayed: false,
    })
    expect((await fetchMilestones(shipment.id)).data.at(-1)?.note).toBe(
      "Gümrüğe girdi"
    )

    signInAs("viewer")
    await expect(
      recordMilestone(shipment.id, {
        milestone: "CUSTOMS_CLEARED",
        at: at("14"),
      })
    ).rejects.toMatchObject({ status: 403 })
  })

  it("TC-3.5-03 uploads typed documents (B/L, AWB…)", async () => {
    const shipment = acme("shipment")[0]!
    const file = new File(["awb"], "awb.pdf", { type: "application/pdf" })
    const uploaded = await uploadAttachments(
      "shipment",
      shipment.id,
      [file],
      "awb"
    )
    expect(uploaded.data[0]).toMatchObject({ category: "awb", size: 3 })
    await expect(
      uploadAttachments("shipment", shipment.id, [file], "selfie")
    ).rejects.toMatchObject({ status: 422 })

    const { user } = await renderRoute(`/o/shipment/${shipment.id}?tab=files`, {
      as: "owner",
    })
    const list = await screen.findByRole("list", { name: "Dosyalar" })
    expect(within(list).getByText("Hava yolu senedi (AWB)")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Belge türü" }))
    await user.click(await screen.findByRole("option", { name: "CMR" }))
    const input = screen.getByLabelText("Dosya yükle")
    await user.upload(
      input,
      new File(["cmr"], "cmr.pdf", { type: "application/pdf" })
    )
    await waitFor(() =>
      expect(within(list).getByText("CMR")).toBeInTheDocument()
    )
  })

  it("TC-3.5-02 shows the milestone timeline, the delay badge and records the next step", async () => {
    const shipment = acme("shipment").find(
      (row) => row.values.delayed === true && row.values.status === "DEPARTED"
    )!
    const { user } = await renderRoute(`/o/shipment/${shipment.id}`, {
      as: "owner",
    })
    const timeline = await screen.findByRole("list", {
      name: "Sevkiyat aşamaları",
    })
    expect(
      within(timeline).getByText("Yola çıktı (ATD)").closest("li")
    ).toHaveAttribute("aria-current", "step")
    expect(screen.getAllByText("Gecikmede").length).toBeGreaterThan(0)

    await user.click(
      screen.getByRole("button", { name: "Sonraki aşamayı kaydet" })
    )
    const dialog = await screen.findByRole("dialog", { name: "Aşama kaydet" })
    expect(
      within(dialog).getByRole("combobox", { name: "Aşama" })
    ).toHaveTextContent("Vardı (ATA)")
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() =>
      expect(db.records.findById(shipment.id)!.values.status).toBe("ARRIVED")
    )
    expect(db.records.findById(shipment.id)!.values.delayed).toBe(false)
  })
})
