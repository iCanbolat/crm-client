import { waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  fetchObjects,
  fetchRecords,
  moveRecordStage,
} from "@/features/records/api/records.api"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"
import { renderRoute, screen } from "@/test/render"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

describe("partners & forwarding pipeline (B3.6)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  it("TC-3.6-01 filters companies by type (agent network)", async () => {
    const agents = await fetchRecords("company", {
      page: 1,
      pageSize: 100,
      filters: [{ field: "companyTypes", op: "in", value: ["overseas_agent"] }],
    })
    expect(agents.meta.total).toBe(20)
    expect(
      agents.data.every((record) =>
        (record.values.companyTypes as string[]).includes("overseas_agent")
      )
    ).toBe(true)

    const { user, router } = await renderRoute("/dashboard", { as: "owner" })
    const menu = await screen.findByRole("navigation", { name: "Ana menü" })
    await user.click(within(menu).getByRole("link", { name: "Acente ağı" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/o/company")
    )
    expect(await screen.findByText("Toplam 20 kayıt")).toBeInTheDocument()
    // A saved-filter link is active on its own list only.
    expect(
      within(menu).getByRole("link", { name: "Acente ağı" })
    ).toHaveAttribute("data-active")
    expect(
      within(menu).getByRole("link", { name: "Şirketler" })
    ).not.toHaveAttribute("data-active")
  })

  it("uses the forwarding deal pipeline with its own lost reasons", async () => {
    const { data } = await fetchObjects()
    const deal = data.find((def) => def.key === "deal")!
    expect(deal.pipeline?.stages.map((stage) => stage.key)).toEqual([
      "rate_research",
      "quote_sent",
      "negotiation",
      "won",
      "lost",
    ])
    expect(
      deal.fields
        .find((field) => field.key === "lostReason")
        ?.options?.map((option) => option.value)
    ).toContain("transitTime")
    // Seeded deals were migrated onto the new stages.
    expect(
      acme("deal").every((row) =>
        ["rate_research", "quote_sent", "negotiation", "won", "lost"].includes(
          String(row.values.stage)
        )
      )
    ).toBe(true)
  })

  it("TC-3.6-02 losing a deal needs a lost reason (stage gate)", async () => {
    const target = acme("deal").find(
      (row) => row.values.stage === "negotiation"
    )!
    await expect(
      moveRecordStage("deal", target.id, { stage: "lost" })
    ).rejects.toMatchObject({ status: 422, code: "STAGE_GATE" })

    const { user } = await renderRoute(`/o/deal/${target.id}`, { as: "owner" })
    await user.click(
      await screen.findByRole("button", { name: "Aşamaya taşı: Kaybedildi" })
    )
    const dialog = await screen.findByRole("dialog")
    await user.click(
      within(dialog).getByRole("combobox", { name: /Kayıp nedeni/ })
    )
    await user.click(
      await screen.findByRole("option", { name: "Transit süre" })
    )
    await user.click(
      within(dialog).getByRole("button", { name: /Taşı|Kaydet|Onayla/ })
    )
    await waitFor(() =>
      expect(db.records.findById(target.id)!.values).toMatchObject({
        stage: "lost",
        lostReason: "transitTime",
      })
    )
  })

  it("activating forwarding later migrates deals and seeds module objects", async () => {
    // Marmara without the module: core metadata only.
    db.workspaces.update(WORKSPACE_IDS.marmara, { modules: [] })
    signInAs("owner", { workspaceId: WORKSPACE_IDS.marmara })
    expect((await fetchObjects()).data.map((def) => def.key)).toEqual([
      "company",
      "contact",
      "lead",
      "deal",
    ])
    const { activateModule } = await import("@/features/workspace")
    await activateModule("forwarding")
    expect((await fetchObjects()).data.map((def) => def.key)).toContain(
      "shipment"
    )
  })
})
