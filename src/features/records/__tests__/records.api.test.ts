import { beforeEach, describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"

import {
  createField,
  createRecord,
  createView,
  deleteField,
  deleteRecord,
  deleteView,
  fetchAttachments,
  fetchObjects,
  fetchRecord,
  fetchRecords,
  fetchUserDirectory,
  fetchViews,
  moveRecordStage,
  runBulkAction,
  setDefaultView,
  updateObject,
  updateRecord,
  updateView,
  uploadAttachments,
  uploadFile,
} from "../api/records.api"
import { SEED_VIEW_IDS } from "../mocks/factory"

const acme = (objectKey: string) =>
  db.records.findMany(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === objectKey
  )

const page = { page: 1, pageSize: 20 }

describe("records api (contract with MSW)", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  it("serves the workspace's object metadata", async () => {
    const { data } = await fetchObjects()
    // Acme uses the forwarding module: its objects follow the core ones.
    expect(data.map((def) => def.key)).toEqual([
      "company",
      "contact",
      "lead",
      "deal",
      "quote",
      "shipment",
    ])
    const lead = data.find((def) => def.key === "lead")!
    expect(lead.pluralLabel.tr).toBe("Lead'ler")
    expect(lead.pipeline?.stages.map((stage) => stage.key)).toEqual([
      "new",
      "contacted",
      "qualified",
      "converted",
      "lost",
    ])
  })

  it("seeds the planned volume (Acme) with valid values", async () => {
    // 60 customers + 20 overseas agents of the forwarding network.
    expect(acme("company")).toHaveLength(80)
    expect(acme("contact")).toHaveLength(150)
    expect(acme("lead")).toHaveLength(200)
    expect(acme("deal")).toHaveLength(80)
    const result = await fetchRecords("deal", { ...page, pageSize: 100 })
    expect(result.meta.total).toBe(80)
  })

  it("paginates and sorts on the server (newest first by default)", async () => {
    const first = await fetchRecords("company", page)
    expect(first.meta).toEqual({ page: 1, pageSize: 20, total: 80 })
    const created = first.data.map((record) => String(record.values.createdAt))
    expect(created).toEqual([...created].sort().reverse())

    const byName = await fetchRecords("company", { ...page, sort: "name:asc" })
    const names = byName.data.map((record) => String(record.values.name))
    expect(names).toEqual(
      [...names].sort((a, b) =>
        a.localeCompare(b, "tr", { sensitivity: "base" })
      )
    )
  })

  it("filters with typed conditions and searches the search fields", async () => {
    const qualified = await fetchRecords("lead", {
      ...page,
      pageSize: 100,
      filters: [{ field: "stage", op: "in", value: ["qualified"] }],
    })
    expect(qualified.meta.total).toBe(
      acme("lead").filter((row) => row.values.stage === "qualified").length
    )
    expect(
      qualified.data.every((record) => record.values.stage === "qualified")
    ).toBe(true)

    const target = acme("company")[5]!
    const found = await fetchRecords("company", {
      ...page,
      q: String(target.values.taxNumber),
    })
    expect(found.data.map((record) => record.id)).toContain(target.id)
  })

  it("joins labels of relation and user values", async () => {
    const contact = acme("contact")[0]!
    const record = await fetchRecord("contact", contact.id)
    const company = db.records.findById(String(contact.values.companyId))!

    expect(record.refs.companyId).toMatchObject({
      id: company.id,
      label: company.values.name,
      objectKey: "company",
    })
    expect(record.refs.ownerId?.label).toBeTruthy()
  })

  it("creates records with server defaults (owner, first stage, timestamps)", async () => {
    const created = await createRecord("lead", { name: "Ayşe Demir" })

    expect(created.values).toMatchObject({
      name: "Ayşe Demir",
      stage: "new",
      ownerId: SEED_USERS.owner.id,
    })
    expect(created.values.createdAt).toEqual(expect.any(String))
    expect(db.records.findById(created.id)).toBeDefined()
  })

  it("validates with the same metadata rules as the form (422 fieldErrors)", async () => {
    await expect(
      createRecord("lead", { name: "", email: "x@" })
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: {
        name: ["Bu alan zorunludur."],
        email: [expect.any(String)],
      },
    })
    await expect(
      createRecord("contact", { name: "Ali", companyId: "cmp_missing" })
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: { companyId: ["Seçilen ilişkili kayıt bulunamadı."] },
    })
  })

  it("enforces the stage gate on create, update and stage moves", async () => {
    await expect(
      createRecord("deal", { name: "Kayıp iş", stage: "lost" })
    ).rejects.toMatchObject({
      status: 422,
      code: "STAGE_GATE",
      fieldErrors: { lostReason: ["Bu alan zorunludur."] },
    })

    const deal = acme("deal").find((row) => row.values.stage === "quote_sent")!
    await expect(
      moveRecordStage("deal", deal.id, { stage: "lost" })
    ).rejects.toMatchObject({
      code: "STAGE_GATE",
    })
    await expect(
      updateRecord("deal", deal.id, { stage: "lost" })
    ).rejects.toMatchObject({
      code: "STAGE_GATE",
    })

    const moved = await moveRecordStage("deal", deal.id, {
      stage: "lost",
      values: { lostReason: "price" },
    })
    expect(moved.values).toMatchObject({ stage: "lost", lostReason: "price" })

    await expect(
      moveRecordStage("deal", deal.id, { stage: "nope" })
    ).rejects.toMatchObject({
      status: 422,
    })
  })

  it("applies the RBAC policy (viewer read-only, agent only own records)", async () => {
    signInAs("viewer")
    await expect(createRecord("lead", { name: "X" })).rejects.toMatchObject({
      status: 403,
    })

    signInAs("agent")
    const foreign = acme("lead").find(
      (row) => row.values.ownerId !== SEED_USERS.agent.id
    )!
    const own = acme("lead").find(
      (row) => row.values.ownerId === SEED_USERS.agent.id
    )!
    await expect(
      updateRecord("lead", foreign.id, { name: "X" })
    ).rejects.toMatchObject({
      status: 403,
    })
    await expect(deleteRecord("lead", foreign.id)).rejects.toMatchObject({
      status: 403,
    })
    await expect(
      updateRecord("lead", own.id, { name: "Kendi kaydım" })
    ).resolves.toMatchObject({
      values: { name: "Kendi kaydım" },
    })
  })

  it("bulk actions assign, tag and delete — skipping records the agent may not change", async () => {
    const [a, b] = acme("company")
    const assigned = await runBulkAction("company", {
      action: "assign",
      ids: [a!.id, b!.id],
      ownerId: SEED_USERS.agent.id,
    })
    expect(assigned).toEqual({ updated: 2, skipped: [] })
    expect(db.records.findById(a!.id)!.values.ownerId).toBe(SEED_USERS.agent.id)

    await runBulkAction("company", {
      action: "addTag",
      ids: [a!.id],
      tag: "vip",
    })
    expect(db.records.findById(a!.id)!.values.tags).toContain("vip")

    signInAs("agent")
    const foreign = acme("company").find(
      (row) => row.values.ownerId !== SEED_USERS.agent.id
    )!
    const result = await runBulkAction("company", {
      action: "delete",
      ids: [a!.id, foreign.id],
    })
    expect(result).toEqual({ updated: 1, skipped: [foreign.id] })
    expect(db.records.findById(a!.id)).toBeUndefined()
    expect(db.records.findById(foreign.id)).toBeDefined()
  })

  it("scopes records to the active workspace", async () => {
    signInAs("owner", { workspaceId: WORKSPACE_IDS.marmara })
    const result = await fetchRecords("company", page)
    expect(result.meta.total).toBe(16)
    await expect(
      fetchRecord("company", acme("company")[0]!.id)
    ).rejects.toMatchObject({
      status: 404,
    })
  })

  it("returns 404 for unknown objects", async () => {
    await expect(fetchRecords("vendor", page)).rejects.toMatchObject({
      status: 404,
    })
  })

  it("lists workspace users for every role", async () => {
    signInAs("viewer")
    const { data } = await fetchUserDirectory()
    expect(data.map((user) => user.id)).toContain(SEED_USERS.owner.id)
    expect(data.find((user) => user.id === SEED_USERS.viewer.id)?.role).toBe(
      "viewer"
    )
  })

  it("uploads attachments and file field values", async () => {
    const record = acme("deal")[0]!
    const file = new File(["teklif"], "teklif.pdf", { type: "application/pdf" })

    // jsdom's File crosses into Node's fetch here, which drops the file
    // name (browsers keep it); size and type survive the round trip.
    const uploaded = await uploadAttachments("deal", record.id, [file])
    expect(uploaded.data[0]).toMatchObject({
      size: 6,
      uploadedBy: SEED_USERS.owner.id,
    })
    expect((await fetchAttachments("deal", record.id)).data).toHaveLength(1)

    await expect(uploadFile(file)).resolves.toMatchObject({ size: 6 })
  })
})

describe("saved views api", () => {
  beforeEach(() => {
    signInAs("owner")
  })

  it("lists shared and own views with the user's default", async () => {
    const leads = await fetchViews("lead")
    expect(leads.data.map((view) => view.id)).toEqual([
      SEED_VIEW_IDS.qualifiedLeads,
    ])
    expect(leads.defaultViewId).toBeNull()

    await setDefaultView("lead", SEED_VIEW_IDS.qualifiedLeads)
    expect((await fetchViews("lead")).defaultViewId).toBe(
      SEED_VIEW_IDS.qualifiedLeads
    )
  })

  it("creates, updates and deletes personal views; sharing needs manage rights", async () => {
    signInAs("agent")
    const view = await createView({
      objectKey: "lead",
      name: "Benim lead'lerim",
      state: {
        filters: [{ field: "ownerId", op: "in", value: [SEED_USERS.agent.id] }],
      },
    })
    expect(view).toMatchObject({ shared: false, ownerId: SEED_USERS.agent.id })

    await expect(updateView(view.id, { shared: true })).rejects.toMatchObject({
      status: 403,
    })
    await expect(
      updateView(view.id, { name: "Yeni ad" })
    ).resolves.toMatchObject({
      name: "Yeni ad",
    })
    // Not visible to others.
    signInAs("manager")
    expect(
      (await fetchViews("lead")).data.map((item) => item.id)
    ).not.toContain(view.id)
    await expect(deleteView(view.id)).rejects.toMatchObject({ status: 403 })

    signInAs("agent")
    await deleteView(view.id)
    expect(db.views.findById(view.id)).toBeUndefined()
  })
})

describe("metadata administration api (B2.7)", () => {
  beforeEach(() => {
    signInAs("admin")
  })

  it("TC-2.7-01 adds a custom field to the fields, a custom section and the list", async () => {
    const def = await createField("company", {
      key: "segment",
      label: { tr: "Segment", en: "Segment" },
      type: "select",
      options: [{ value: "a", label: { tr: "A", en: "A" } }],
    })
    expect(def.fields.find((field) => field.key === "segment")).toMatchObject({
      custom: true,
      type: "select",
    })
    expect(def.layouts.list.columns.at(-1)).toBe("segment")
    expect(def.layouts.detail.sections.at(-1)).toMatchObject({
      key: "custom",
      fields: ["segment"],
    })

    await expect(
      createField("company", {
        key: "segment",
        label: { tr: "X", en: "" },
        type: "text",
      })
    ).rejects.toMatchObject({
      fieldErrors: { key: ["Bu anahtarla bir alan zaten var."] },
    })
    await expect(
      createField("company", {
        key: "kind",
        label: { tr: "Tür", en: "" },
        type: "select",
      })
    ).rejects.toMatchObject({ fieldErrors: { options: [expect.any(String)] } })
  })

  it("TC-2.7-02 refuses to delete system fields (409) but deletes custom ones", async () => {
    await expect(deleteField("company", "name")).rejects.toMatchObject({
      status: 409,
      code: "SYSTEM_FIELD",
    })
    await expect(deleteField("company", "ownerId")).rejects.toMatchObject({
      status: 409,
    })

    const def = await deleteField("company", "taxNumber")
    expect(def.fields.some((field) => field.key === "taxNumber")).toBe(false)
    expect(acme("company").some((row) => "taxNumber" in row.values)).toBe(false)
  })

  it("TC-2.7-03 reorders pipeline stages and keeps the stage options in sync", async () => {
    const { data } = await fetchObjects()
    const deal = data.find((def) => def.key === "deal")!
    const stages = [...deal.pipeline!.stages].reverse()

    const updated = await updateObject("deal", {
      pipeline: { ...deal.pipeline!, stages },
    })
    expect(updated.pipeline!.stages.map((stage) => stage.key)).toEqual(
      stages.map((stage) => stage.key)
    )
    expect(
      updated.fields
        .find((field) => field.key === "stage")!
        .options!.map((o) => o.value)
    ).toEqual(stages.map((stage) => stage.key))
  })

  it("refuses to remove a stage that still has records (409)", async () => {
    const { data } = await fetchObjects()
    const deal = data.find((def) => def.key === "deal")!
    await expect(
      updateObject("deal", {
        pipeline: {
          ...deal.pipeline!,
          stages: deal.pipeline!.stages.filter((stage) => stage.key !== "won"),
        },
      })
    ).rejects.toMatchObject({ status: 409, code: "STAGE_IN_USE" })
  })

  it("rejects layouts that reference unknown fields and non-admin changes", async () => {
    const { data } = await fetchObjects()
    const company = data.find((def) => def.key === "company")!
    await expect(
      updateObject("company", {
        layouts: {
          ...company.layouts,
          list: { columns: ["name", "ghost"] },
        },
      })
    ).rejects.toMatchObject({ status: 422 })

    signInAs("manager")
    await expect(
      createField("company", {
        key: "x",
        label: { tr: "X", en: "" },
        type: "text",
      })
    ).rejects.toMatchObject({ status: 403 })
  })
})
