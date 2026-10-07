import type { Condition } from "@/engine/logic"
import type { ObjectDef } from "@/engine/metadata"

import {
  formatSort,
  parseSort,
  RECORD_LIST_DEFAULTS,
  type RecordListParams,
  type RecordListSearch,
  type SavedView,
  type ViewState,
} from "../api/records.schemas"

/** API query derived from the URL (layout-only params are dropped). */
export function toListParams(search: RecordListSearch): RecordListParams {
  return {
    page: search.page,
    pageSize: search.pageSize,
    sort: search.sort,
    q: search.q?.trim() || undefined,
    filters: search.filters?.length ? search.filters : undefined,
  }
}

/** Columns the table may show: every field, list layout columns first. */
export function getAvailableColumns(objectDef: ObjectDef) {
  const listed = objectDef.layouts.list.columns.filter((key) =>
    objectDef.fields.some((field) => field.key === key)
  )
  const rest = objectDef.fields
    .map((field) => field.key)
    .filter((key) => !listed.includes(key))
  return [...listed, ...rest]
}

/** Visible columns in order: URL `cols`, else the object's list layout. */
export function getVisibleColumns(
  objectDef: ObjectDef,
  search: Pick<RecordListSearch, "cols">
) {
  const available = getAvailableColumns(objectDef)
  const source = search.cols?.length
    ? search.cols
    : objectDef.layouts.list.columns
  const visible = source.filter((key) => available.includes(key))
  // The primary field can never be hidden.
  return visible.includes(objectDef.primaryField)
    ? visible
    : [objectDef.primaryField, ...visible]
}

export function viewStateFromSearch(search: RecordListSearch): ViewState {
  return {
    columns: search.cols,
    pinned: search.pin,
    sort: parseSort(search.sort),
    filters: search.filters ?? [],
    q: search.q?.trim() || undefined,
    pageSize: search.pageSize,
    density: search.density,
    layout: search.layout,
  }
}

/** URL of a saved view (starts on page 1). */
export function searchFromView(view: SavedView): RecordListSearch {
  const { state } = view
  return {
    page: 1,
    pageSize: state.pageSize ?? RECORD_LIST_DEFAULTS.pageSize,
    sort: formatSort(state.sort),
    q: state.q,
    filters: state.filters.length ? state.filters : undefined,
    view: view.id,
    cols: state.columns?.length ? state.columns : undefined,
    pin: state.pinned?.length ? state.pinned : undefined,
    density: state.density ?? RECORD_LIST_DEFAULTS.density,
    layout: state.layout ?? RECORD_LIST_DEFAULTS.layout,
  }
}

/** Nothing chosen yet: the default view may be applied. */
export function isPristineSearch(search: RecordListSearch) {
  return (
    !search.view &&
    !search.q &&
    !search.sort &&
    !search.filters?.length &&
    !search.cols?.length &&
    !search.pin?.length
  )
}

const normalizeList = (list: readonly unknown[] | undefined) =>
  JSON.stringify(list ?? [])

function sameConditions(a: Condition[], b: Condition[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The URL differs from what the active view stores. */
export function isViewDirty(view: SavedView, search: RecordListSearch) {
  const current = viewStateFromSearch(search)
  const saved = view.state
  return (
    !sameConditions(current.filters, saved.filters) ||
    formatSort(current.sort) !== formatSort(saved.sort) ||
    (current.q ?? "") !== (saved.q ?? "") ||
    normalizeList(current.columns) !== normalizeList(saved.columns) ||
    normalizeList(current.pinned) !== normalizeList(saved.pinned) ||
    current.pageSize !== (saved.pageSize ?? RECORD_LIST_DEFAULTS.pageSize) ||
    current.density !== (saved.density ?? RECORD_LIST_DEFAULTS.density) ||
    current.layout !== (saved.layout ?? RECORD_LIST_DEFAULTS.layout)
  )
}
