import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"

import {
  activateModule,
  createInvite,
  fetchInvites,
  fetchMembers,
  fetchWorkspace,
  saveOnboardingProgress,
} from "../api/workspace.api"
import { getResumeStep } from "../lib/onboarding"

const company = {
  name: "Kuzey Lojistik",
  logoUrl: null,
  country: "TR",
  currency: "TRY",
  timezone: "Europe/Istanbul",
  language: "tr",
} as const

describe("workspace api (contract with MSW)", () => {
  it("returns the workspace of the X-Tenant-Id header", async () => {
    signInAs("owner", { workspaceId: WORKSPACE_IDS.marmara })

    await expect(fetchWorkspace()).resolves.toMatchObject({
      id: WORKSPACE_IDS.marmara,
      name: "Marmara Forwarding",
    })
  })

  it("rejects workspaces the user is not a member of", async () => {
    signInAs("viewer", { workspaceId: WORKSPACE_IDS.marmara })

    await expect(fetchWorkspace()).rejects.toMatchObject({
      status: 403,
      code: "NOT_MEMBER",
    })
  })

  it("TC-1.2-02 refuses coming-soon modules on the server too", async () => {
    signInAs("newcomer")

    await expect(
      saveOnboardingProgress({
        step: 2,
        draft: { company, modules: ["health-tourism"] },
      })
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: { modules: ["Bu modül henüz kullanılamıyor."] },
    })
    await expect(activateModule("visa-education")).rejects.toMatchObject({
      status: 422,
      code: "MODULE_UNAVAILABLE",
    })
  })

  it("activates an available module once (idempotent)", async () => {
    signInAs("newcomer")

    await activateModule("forwarding")
    const workspace = await activateModule("forwarding")

    expect(workspace.modules).toEqual(["forwarding"])
  })

  it("only lets owners/admins drive onboarding and modules", async () => {
    signInAs("manager")

    await expect(activateModule("forwarding")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    })
  })

  it("rejects onboarding changes once the workspace is set up", async () => {
    signInAs("owner")

    await expect(
      saveOnboardingProgress({ step: 1, draft: { company } })
    ).rejects.toMatchObject({ status: 409 })
  })

  it("lists members for managers but not for agents", async () => {
    signInAs("manager")
    const members = await fetchMembers()
    expect(members.data.map((member) => member.role)).toEqual([
      "owner",
      "admin",
      "manager",
      "agent",
      "viewer",
    ])

    signInAs("agent")
    await expect(fetchMembers()).rejects.toMatchObject({ status: 403 })
  })

  it("creates invitations and rejects duplicates and existing members", async () => {
    signInAs("admin")

    await expect(
      createInvite({ email: "yeni@acme.test", role: "viewer" })
    ).resolves.toMatchObject({ email: "yeni@acme.test", status: "pending" })
    expect((await fetchInvites()).data).toHaveLength(2)

    await expect(
      createInvite({ email: "yeni@acme.test", role: "agent" })
    ).rejects.toMatchObject({
      fieldErrors: { email: ["Bu e-postaya zaten davet gönderildi."] },
    })
    await expect(
      createInvite({ email: "agent@acme.test", role: "agent" })
    ).rejects.toMatchObject({
      fieldErrors: { email: ["Bu kişi zaten ekipte."] },
    })

    signInAs("manager")
    await expect(
      createInvite({ email: "x@acme.test", role: "agent" })
    ).rejects.toMatchObject({ status: 403 })
    expect(db.invites.count()).toBe(2)
  })
})

describe("getResumeStep", () => {
  it("TC-1.2-04 resumes at the saved step when its prerequisites exist", () => {
    expect(
      getResumeStep({
        status: "pending",
        step: 2,
        draft: { company, modules: ["forwarding"] },
      })
    ).toBe(2)
  })

  it("never skips a step whose data is missing", () => {
    expect(getResumeStep({ status: "pending", step: 3, draft: {} })).toBe(0)
    expect(
      getResumeStep({ status: "pending", step: 3, draft: { company } })
    ).toBe(1)
  })
})
