import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { renderRoute, screen } from "@/test/render"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

async function openLeadSheet() {
  const utils = await renderRoute("/o/lead", { as: "owner" })
  await screen.findByRole("table")
  await utils.user.click(screen.getByRole("button", { name: "Yeni Lead" }))
  const sheet = await screen.findByRole("dialog", { name: "Yeni Lead" })
  return { ...utils, sheet }
}

describe("freight request (B3.3)", () => {
  it("TC-3.3-01 shows fields for the selected transport mode", async () => {
    const { user, sheet } = await openLeadSheet()
    const form = within(sheet)

    expect(form.getByText("Rota & yük")).toBeInTheDocument()
    // Nothing mode specific before a mode is picked.
    expect(form.queryByRole("group", { name: /Konteyner ihtiyacı/ })).toBeNull()
    expect(form.queryByRole("group", { name: /Ölçüler/ })).toBeNull()

    await user.click(form.getByRole("combobox", { name: /Taşıma modu/ }))
    await user.click(
      await screen.findByRole("option", { name: "Deniz — FCL (komple)" })
    )
    expect(
      await form.findByRole("group", { name: /Konteyner ihtiyacı/ })
    ).toBeInTheDocument()
    expect(form.queryByRole("group", { name: /Ölçüler/ })).toBeNull()

    await user.click(form.getByRole("combobox", { name: /Taşıma modu/ }))
    await user.click(await screen.findByRole("option", { name: "Hava" }))
    expect(
      await form.findByRole("group", { name: /Ölçüler/ })
    ).toBeInTheDocument()
    expect(form.queryByRole("group", { name: /Konteyner ihtiyacı/ })).toBeNull()

    // Dangerous goods details only once the lead is flagged hazardous.
    expect(form.queryByRole("group", { name: /IMO sınıfı/ })).toBeNull()
    await user.click(form.getByRole("checkbox", { name: "Tehlikeli madde" }))
    expect(
      await form.findByRole("group", { name: /IMO sınıfı/ })
    ).toBeInTheDocument()
  })

  it("TC-3.3-01 a hidden required field does not block saving; a visible one does", async () => {
    const { user, sheet } = await openLeadSheet()
    const form = within(sheet)
    await user.type(form.getByRole("textbox", { name: /Ad soyad/ }), "Selin Ak")

    await user.click(form.getByRole("combobox", { name: /Taşıma modu/ }))
    await user.click(
      await screen.findByRole("option", { name: "Deniz — FCL (komple)" })
    )
    await user.click(form.getByRole("button", { name: "Kaydet" }))
    // Containers are required for FCL.
    expect(await form.findByText("Bu alan zorunludur.")).toBeInTheDocument()

    // Switching to air hides (and drops) the requirement.
    await user.click(form.getByRole("combobox", { name: /Taşıma modu/ }))
    await user.click(await screen.findByRole("option", { name: "Hava" }))
    await user.click(form.getByRole("button", { name: "Kaydet" }))
    await waitFor(() =>
      expect(acme("lead").some((row) => row.values.name === "Selin Ak")).toBe(
        true
      )
    )
    const saved = acme("lead").find((row) => row.values.name === "Selin Ak")!
    expect(saved.values).toMatchObject({
      transportMode: "AIR",
      containers: null,
    })
  })

  it("shows the route & cargo card with the chargeable weight on the lead page", async () => {
    const lead = acme("lead").find(
      (row) => row.values.transportMode === "AIR" && row.values.dimensions
    )!
    await renderRoute(`/o/lead/${lead.id}`, { as: "owner" })
    const card = (
      await screen.findByRole("heading", { name: "Rota özeti", level: 2 })
    ).closest("[data-slot=card]") as HTMLElement
    const scope = within(card)
    expect(scope.getByText("Ücretlendirilecek ağırlık")).toBeInTheDocument()
    expect(
      scope.getByRole("group", {
        name: `${(lead.values.origin as { name: string }).name} → ${
          (lead.values.destination as { name: string }).name
        }`,
      })
    ).toBeInTheDocument()
  })
})
