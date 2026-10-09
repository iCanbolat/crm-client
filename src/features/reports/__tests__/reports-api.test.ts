import { describe, expect, it } from "vitest"

import { isApiError } from "@/lib/api"
import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"

import { fetchReport } from "../api/reports.api"

const YEAR = { from: "2025-10-10", to: "2026-10-09" }

async function apiError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error
    throw error
  }
  throw new Error("expected an API error")
}

const leadsOf = (ownerId?: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme &&
      row.objectKey === "lead" &&
      String(row.values.createdAt).slice(0, 10) >= YEAR.from &&
      String(row.values.createdAt).slice(0, 10) <= YEAR.to &&
      (!ownerId || row.values.ownerId === ownerId)
  ).length

describe("reports API (B7.1)", () => {
  it("TC-7.1-02 lead sources honour the date range and owner filter", async () => {
    signInAs("owner")
    const all = await fetchReport("leadSources", YEAR)
    expect(all.currency).toBe("USD")
    expect(all.totals!.leads).toBe(leadsOf())
    expect(all.rows.map((row) => row.source)).toContain("Web formu")

    const owner = SEED_USERS.manager.id
    const mine = await fetchReport("leadSources", { ...YEAR, ownerId: owner })
    expect(mine.totals!.leads).toBe(leadsOf(owner))
    expect(mine.totals!.leads).toBeLessThan(all.totals!.leads as number)

    const empty = await fetchReport("leadSources", {
      from: "2020-01-01",
      to: "2020-01-31",
    })
    expect(empty).toMatchObject({ rows: [], totals: null })
  })

  it("TC-7.1-03 agents only get their own numbers", async () => {
    signInAs("agent")
    const report = await fetchReport("repPerformance", {
      ...YEAR,
      ownerId: SEED_USERS.owner.id,
    })
    expect(report.rows.map((row) => row.name)).toEqual([SEED_USERS.agent.name])
  })

  it("rejects viewers, inactive modules, unknown keys and bad ranges", async () => {
    signInAs("viewer")
    expect((await apiError(fetchReport("leadSources", YEAR))).status).toBe(403)

    signInAs("newcomer")
    expect((await apiError(fetchReport("quoteFunnel", YEAR))).status).toBe(404)

    signInAs("owner")
    expect((await apiError(fetchReport("nope", YEAR))).status).toBe(404)
    expect(
      (
        await apiError(
          fetchReport("quoteFunnel", { from: "2026-10-09", to: "2026-01-01" })
        )
      ).status
    ).toBe(422)
  })
})
