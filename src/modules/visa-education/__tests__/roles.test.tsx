import { within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { getRoleLabel } from "@/engine/modules"
import { fetchReport } from "@/features/reports/api/reports.api"
import {
  fetchObjects,
  fetchRecord,
  fetchRecords,
} from "@/features/records/api/records.api"
import { updateWorkspaceSettings } from "@/features/workspace/api/workspace.api"
import { apiClient } from "@/lib/api"
import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"
import { renderRoute, screen } from "@/test/render"

import { visaEducationDashboardSchema } from "../api/dashboard.schemas"

// Registers the module manifests like the app does.
import "@/app/modules"

const ECE = SEED_USERS.atlasEducation.id
const page = { page: 1, pageSize: 200 }
const range = { from: "2020-01-01", to: "2030-12-31" }

const atlasRows = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.atlas && row.objectKey === objectKey
  )

const fieldKeys = async (objectKey: string) =>
  (await fetchObjects()).data
    .find((def) => def.key === objectKey)!
    .fields.map((field) => field.key)

const dashboard = () =>
  apiClient.get("/dashboard/visa-education", {
    query: range,
    schema: visaEducationDashboardSchema,
  })

/** Faz 10 — roles in the sector's terms, data scope, sensitive fields. */
describe("roles & data scope (B10.4)", () => {
  it("TC-10.4-01 a counsellor sees own and unassigned records only", async () => {
    signInAs("atlasEducation")
    const { data } = await fetchRecords("enrollment", page)

    expect(data.length).toBeGreaterThan(0)
    for (const record of data) {
      expect([ECE, null, undefined]).toContain(record.values.ownerId)
    }
    const others = atlasRows("enrollment").find(
      (row) => row.values.ownerId && row.values.ownerId !== ECE
    )!
    await expect(fetchRecord("enrollment", others.id)).rejects.toMatchObject({
      status: 404,
    })

    // The owner opens everything to agents…
    signInAs("atlasOwner")
    await updateWorkspaceSettings({ agentVisibility: "all" })
    signInAs("atlasEducation")
    await expect(fetchRecord("enrollment", others.id)).resolves.toMatchObject({
      id: others.id,
    })
    expect((await fetchRecords("enrollment", page)).meta.total).toBe(
      atlasRows("enrollment").length
    )

    // …agents may not change the setting themselves.
    await expect(
      updateWorkspaceSettings({ agentVisibility: "assigned" })
    ).rejects.toMatchObject({ status: 403 })
  })

  it("TC-10.4-01 managers always see every record", async () => {
    signInAs("atlasManager")
    expect((await fetchRecords("enrollment", page)).meta.total).toBe(
      atlasRows("enrollment").length
    )
  })

  it("TC-10.4-02 commissions are hidden from counsellors, not from managers", async () => {
    signInAs("atlasEducation")
    const keys = await fieldKeys("enrollment")
    expect(keys).not.toContain("commissionExpected")
    expect(keys).not.toContain("commissionRate")
    const { data } = await fetchRecords("enrollment", page)
    expect(data.some((record) => "commissionExpected" in record.values)).toBe(
      false
    )
    await expect(
      fetchReport("commissionByInstitution", range)
    ).rejects.toMatchObject({ status: 403 })
    expect((await dashboard()).commission).toEqual({
      expected: 0,
      received: 0,
    })

    signInAs("atlasManager")
    expect(await fieldKeys("enrollment")).toContain("commissionExpected")
    await expect(
      fetchReport("commissionByInstitution", range)
    ).resolves.toMatchObject({ key: "commissionByInstitution" })
    expect((await dashboard()).commission.expected).toBeGreaterThan(0)
  })

  it("TC-10.4-03 observers do not receive passports or dates of birth", async () => {
    signInAs("atlasViewer")
    const keys = await fieldKeys("contact")
    expect(keys).not.toContain("passport")
    expect(keys).not.toContain("dateOfBirth")
    const { data } = await fetchRecords("contact", page)
    expect(data.some((record) => "passport" in record.values)).toBe(false)

    signInAs("atlasEducation")
    expect(await fieldKeys("contact")).toContain("passport")
  })

  it("TC-10.4-04 role names follow the sector", () => {
    expect(getRoleLabel("visa-education", "agent")?.label.tr).toBe("Danışman")
    expect(getRoleLabel("forwarding", "agent")?.label.tr).toBe(
      "Satış temsilcisi"
    )
    expect(getRoleLabel("visa-education", "owner")).toBeUndefined()
    expect(getRoleLabel(null, "agent")).toBeUndefined()
  })

  it("TC-10.4-04 the team page speaks the sector's language", async () => {
    await renderRoute("/settings/members", { as: "atlasOwner" })

    const list = await screen.findByRole("list", { name: "Ekip üyeleri" })
    expect(within(list).getAllByText("Danışman")).toHaveLength(2)
    expect(within(list).getByText("Ekip lideri")).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: "Yalnız atanan kayıtlar" })
    ).toBeChecked()
  })
})
