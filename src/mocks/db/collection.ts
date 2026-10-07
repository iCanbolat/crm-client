export interface Entity {
  id: string
}

export interface Collection<T extends Entity> {
  readonly name: string
  all(): T[]
  findById(id: string): T | undefined
  findMany(predicate: (item: T) => boolean): T[]
  findFirst(predicate: (item: T) => boolean): T | undefined
  create(item: T): T
  update(id: string, patch: Partial<Omit<T, "id">>): T | undefined
  delete(id: string): boolean
  count(): number
  /** Restores the seeded state. */
  reset(): void
  snapshot(): T[]
  restore(items: T[]): void
}

interface CollectionOptions<T extends Entity> {
  name: string
  seed?: () => T[]
  onChange?: () => void
}

/**
 * Minimal in-memory table. Reads return clones so handlers can never
 * mutate stored records by accident.
 */
export function createCollection<T extends Entity>({
  name,
  seed = () => [],
  onChange,
}: CollectionOptions<T>): Collection<T> {
  const records = new Map<string, T>()

  const load = (items: T[]) => {
    records.clear()
    for (const item of items) records.set(item.id, structuredClone(item))
  }

  const changed = () => onChange?.()

  load(seed())

  return {
    name,
    all: () => Array.from(records.values(), (item) => structuredClone(item)),
    findById: (id) => {
      const item = records.get(id)
      return item ? structuredClone(item) : undefined
    },
    findMany(predicate) {
      return this.all().filter(predicate)
    },
    findFirst(predicate) {
      return this.all().find(predicate)
    },
    create(item) {
      if (records.has(item.id)) {
        throw new Error(`[mock-db] ${name}: duplicate id "${item.id}"`)
      }
      records.set(item.id, structuredClone(item))
      changed()
      return structuredClone(item)
    },
    update(id, patch) {
      const current = records.get(id)
      if (!current) return undefined
      const next = { ...current, ...patch, id }
      records.set(id, next)
      changed()
      return structuredClone(next)
    },
    delete(id) {
      const deleted = records.delete(id)
      if (deleted) changed()
      return deleted
    },
    count: () => records.size,
    reset() {
      load(seed())
      changed()
    },
    snapshot() {
      return this.all()
    },
    restore(items) {
      load(items)
      changed()
    },
  }
}
