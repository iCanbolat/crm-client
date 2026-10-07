import { describe, expect, it } from "vitest"

import { seedExampleItems } from "@/features/_example/mocks/factory"
import { createCollection } from "@/mocks/db/collection"
import { createSeededFaker, MOCK_REFERENCE_DATE } from "@/mocks/db/faker"
import { db, onDbChange, resetDb, restoreDb, snapshotDb } from "@/mocks/db"
import {
  clearPersistedDb,
  DB_STORAGE_KEY,
  loadPersistedDb,
  savePersistedDb,
  startDbPersistence,
} from "@/mocks/db/persistence"
import { setScenarioState } from "@/mocks/scenarios/scenario-store"

describe("seeded faker", () => {
  it("TC-0.4-01 produces identical data for the same namespace and seed", () => {
    const first = seedExampleItems(createSeededFaker("examples"))
    const second = seedExampleItems(createSeededFaker("examples"))

    expect(first).toEqual(second)
    expect(first).toHaveLength(24)
  })

  it("TC-0.4-01 isolates namespaces and seeds", () => {
    const examples = seedExampleItems(createSeededFaker("examples"))

    expect(seedExampleItems(createSeededFaker("other"))).not.toEqual(examples)
    expect(seedExampleItems(createSeededFaker("examples", 7))).not.toEqual(
      examples
    )
  })

  it("TC-0.4-01 generates dates relative to the fixed reference date", () => {
    const items = seedExampleItems(createSeededFaker("examples"))

    for (const item of items) {
      expect(new Date(item.createdAt).getTime()).toBeLessThanOrEqual(
        MOCK_REFERENCE_DATE.getTime()
      )
    }
  })
})

describe("collection", () => {
  const seed = () => [
    { id: "1", name: "Bir" },
    { id: "2", name: "İki" },
  ]

  it("supports CRUD and returns defensive copies", () => {
    const collection = createCollection({ name: "items", seed })

    collection.create({ id: "3", name: "Üç" })
    expect(collection.count()).toBe(3)
    expect(() => collection.create({ id: "3", name: "x" })).toThrow(/duplicate/)

    expect(collection.update("1", { name: "Bir!" })).toEqual({
      id: "1",
      name: "Bir!",
    })
    expect(collection.update("missing", { name: "x" })).toBeUndefined()
    expect(collection.findFirst((item) => item.name === "İki")?.id).toBe("2")
    expect(collection.findMany((item) => item.id !== "2")).toHaveLength(2)

    const copy = collection.findById("1")!
    copy.name = "mutated"
    expect(collection.findById("1")?.name).toBe("Bir!")
    expect(collection.findById("missing")).toBeUndefined()

    expect(collection.delete("2")).toBe(true)
    expect(collection.delete("2")).toBe(false)
  })

  it("TC-0.4-04 reset restores the seeded state", () => {
    const collection = createCollection({ name: "items", seed })
    collection.delete("1")
    collection.create({ id: "9", name: "Dokuz" })

    collection.reset()

    expect(collection.all()).toEqual(seed())
  })

  it("notifies on every change", () => {
    let changes = 0
    const collection = createCollection({
      name: "items",
      seed,
      onChange: () => changes++,
    })

    collection.create({ id: "3", name: "Üç" })
    collection.update("3", { name: "3" })
    collection.delete("3")
    collection.delete("missing")
    collection.restore([])

    expect(changes).toBe(4)
  })
})

describe("mock db", () => {
  it("TC-0.4-04 resetDb brings every collection back to its seed", () => {
    const seeded = db.examples.all()
    db.examples.delete(seeded[0]!.id)
    db.examples.create({ ...seeded[0]!, id: "new" })

    resetDb()

    expect(db.examples.all()).toEqual(seeded)
  })

  it("snapshots and restores the database", () => {
    const snapshot = snapshotDb()
    db.examples.restore([])
    expect(db.examples.count()).toBe(0)

    restoreDb({ ...snapshot, unknown: [] } as never)

    expect(db.examples.all()).toEqual(snapshot.examples)
  })

  it("onDbChange can be unsubscribed", () => {
    let calls = 0
    const unsubscribe = onDbChange(() => calls++)
    db.examples.delete(db.examples.all()[0]!.id)
    unsubscribe()
    db.examples.delete(db.examples.all()[0]!.id)

    expect(calls).toBe(1)
  })
})

describe("persistence", () => {
  it("TC-0.4-05 persists changes only while the persist toggle is on", () => {
    const stop = startDbPersistence()
    const seeded = db.examples.count()
    const [first, second] = db.examples.all()

    db.examples.delete(first!.id)
    expect(localStorage.getItem(DB_STORAGE_KEY)).toBeNull()

    setScenarioState({ persist: true })
    db.examples.delete(second!.id)
    stop()

    const stored = JSON.parse(localStorage.getItem(DB_STORAGE_KEY)!)
    expect(stored.examples).toHaveLength(seeded - 2)
  })

  it("TC-0.4-05 restores a persisted snapshot after a reload", () => {
    db.examples.restore(db.examples.all().slice(0, 3))
    savePersistedDb()
    resetDb()

    expect(loadPersistedDb()).toBe(true)
    expect(db.examples.count()).toBe(3)

    clearPersistedDb()
    expect(loadPersistedDb()).toBe(false)
  })

  it("drops corrupted snapshots", () => {
    localStorage.setItem(DB_STORAGE_KEY, "{not json")

    expect(loadPersistedDb()).toBe(false)
    expect(localStorage.getItem(DB_STORAGE_KEY)).toBeNull()
  })
})
