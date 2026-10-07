import { MAX_PAGE_SIZE, type Paginated } from "@/lib/api"

export type SortDirection = "asc" | "desc"

export interface ListParams {
  page: number
  pageSize: number
  sort?: { field: string; direction: SortDirection }
  q?: string
  /** Any non-reserved query param; comma separated values mean "in". */
  filters: Record<string, string[]>
}

const RESERVED_PARAMS = new Set(["page", "pageSize", "sort", "q"])

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Parses `?page=2&pageSize=20&sort=createdAt:desc&q=acme&status=active,archived`. */
export function parseListParams(
  url: URL,
  defaults: { pageSize?: number } = {}
): ListParams {
  const { searchParams } = url
  const [field, direction] = (searchParams.get("sort") ?? "").split(":")
  const filters: Record<string, string[]> = {}

  for (const [key, value] of searchParams) {
    if (RESERVED_PARAMS.has(key) || value === "") continue
    filters[key] = [...(filters[key] ?? []), ...value.split(",")]
  }

  return {
    page: toPositiveInt(searchParams.get("page"), 1),
    pageSize: Math.min(
      toPositiveInt(searchParams.get("pageSize"), defaults.pageSize ?? 20),
      MAX_PAGE_SIZE
    ),
    sort: field
      ? { field, direction: direction === "desc" ? "desc" : "asc" }
      : undefined,
    q: searchParams.get("q")?.trim() || undefined,
    filters,
  }
}

const normalize = (value: unknown) =>
  String(value ?? "").toLocaleLowerCase("tr")

export function applySearch<T>(
  items: T[],
  q: string | undefined,
  fields: (keyof T)[]
): T[] {
  if (!q) return items
  const needle = normalize(q)
  return items.filter((item) =>
    fields.some((field) => normalize(item[field]).includes(needle))
  )
}

export function applyFilters<T>(
  items: T[],
  filters: Record<string, string[]>,
  allowedFields: (keyof T & string)[]
): T[] {
  const active = Object.entries(filters).filter(([field]) =>
    allowedFields.includes(field as keyof T & string)
  )
  if (active.length === 0) return items

  return items.filter((item) =>
    active.every(([field, values]) =>
      values.includes(String(item[field as keyof T]))
    )
  )
}

function compareValues(a: unknown, b: unknown) {
  if (a === b) return 0
  if (a === undefined || a === null) return 1
  if (b === undefined || b === null) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "tr", { numeric: true })
}

export function applySort<T>(items: T[], sort: ListParams["sort"]): T[] {
  if (!sort) return items
  const factor = sort.direction === "desc" ? -1 : 1
  // Array#sort is stable, so equal values keep their original order.
  return [...items].sort(
    (a, b) =>
      factor * compareValues(a[sort.field as keyof T], b[sort.field as keyof T])
  )
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): Paginated<T> {
  const start = (page - 1) * pageSize
  return {
    data: items.slice(start, start + pageSize),
    meta: { page, pageSize, total: items.length },
  }
}
