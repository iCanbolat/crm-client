import { beforeEach, describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { resetSessionStore } from "@/features/auth"
import { signInAs } from "@/test/auth"

import { createExample, deleteExample, fetchExamples } from "../api/example.api"
import { exampleKeys } from "../api/example.keys"
import { exampleListSearchSchema } from "../api/example.schemas"

const params = exampleListSearchSchema.parse({})

const acmeExamples = () =>
  db.examples.findMany((item) => item.workspaceId === WORKSPACE_IDS.acme)

describe("example api (contract with MSW)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  it("lists newest first with server-side pagination", async () => {
    const page = await fetchExamples(params)

    expect(page.meta).toEqual({ page: 1, pageSize: 5, total: 24 })
    const dates = page.data.map((item) => item.createdAt)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it("filters by status and searches by name", async () => {
    const archived = await fetchExamples({
      ...params,
      status: "archived",
      pageSize: 50,
    })
    expect(archived.data.every((item) => item.status === "archived")).toBe(true)
    expect(archived.meta.total).toBe(
      acmeExamples().filter((item) => item.status === "archived").length
    )

    const target = acmeExamples()[3]!
    const found = await fetchExamples({ ...params, q: target.name })
    expect(found.data.map((item) => item.id)).toContain(target.id)
  })

  it("creates a record and rejects duplicates with field errors", async () => {
    const created = await createExample({ name: "Yeni Kayıt" })

    expect(created).toMatchObject({
      name: "Yeni Kayıt",
      status: "active",
      ownerId: SEED_USERS.owner.id,
      ownerName: SEED_USERS.owner.name,
    })
    expect(db.examples.findById(created.id)).toBeDefined()

    await expect(createExample({ name: "yeni kayıt" })).rejects.toMatchObject({
      status: 422,
      fieldErrors: { name: ["Bu isimde bir kayıt zaten var."] },
    })
  })

  it("validates the payload on the server as well", async () => {
    await expect(createExample({ name: "" })).rejects.toMatchObject({
      status: 422,
      fieldErrors: { name: [expect.any(String)] },
    })
  })

  it("deletes records and returns 404 for unknown ids", async () => {
    const target = acmeExamples()[0]!

    await expect(deleteExample(target.id)).resolves.toBeUndefined()
    expect(db.examples.findById(target.id)).toBeUndefined()

    await expect(deleteExample(target.id)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    })
  })

  it("scopes records to the active workspace (X-Tenant-Id)", async () => {
    signInAs("owner", { workspaceId: WORKSPACE_IDS.marmara })

    const page = await fetchExamples({ ...params, pageSize: 50 })

    expect(page.meta.total).toBe(6)
    const foreign = acmeExamples()[0]!
    await expect(deleteExample(foreign.id)).rejects.toMatchObject({
      status: 404,
    })
  })

  it("TC-1.4-02 rejects an agent deleting someone else's record (403)", async () => {
    signInAs("agent")
    const others = acmeExamples().find(
      (item) => item.ownerId !== SEED_USERS.agent.id
    )!
    const own = acmeExamples().find(
      (item) => item.ownerId === SEED_USERS.agent.id
    )!

    await expect(deleteExample(others.id)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    })
    expect(db.examples.findById(others.id)).toBeDefined()
    await expect(deleteExample(own.id)).resolves.toBeUndefined()
  })

  it("TC-1.4-01 rejects record creation for viewers (403)", async () => {
    signInAs("viewer")

    await expect(
      createExample({ name: "İzleyici kaydı" })
    ).rejects.toMatchObject({ status: 403 })
  })

  it("rejects requests without a session (401)", async () => {
    resetSessionStore()

    await expect(fetchExamples(params)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    })
  })

  it("builds hierarchical query keys", () => {
    expect(exampleKeys.list(params)).toEqual(["examples", "list", params])
    expect(exampleKeys.list(params).slice(0, 2)).toEqual(exampleKeys.lists())
  })
})
