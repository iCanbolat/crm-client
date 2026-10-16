import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table"
import { useState } from "react"

declare module "@tanstack/react-table" {
  // Generic parameters must match the library's declaration.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Plain text name (menus, accessible labels). */
    label?: string
    /** Right aligned, tabular figures. */
    numeric?: boolean
  }
}

export type Density = "comfortable" | "compact"

export interface DataTableState {
  pagination: PaginationState
  sorting: SortingState
  columnVisibility: VisibilityState
  columnOrder: ColumnOrderState
  columnPinning: ColumnPinningState
  rowSelection: RowSelectionState
  /** Free text search over all columns (client mode only). */
  globalFilter?: string
}

/**
 * `server`: the API pages, sorts and filters; `rowCount` is the server total.
 * `client`: every row is loaded and TanStack does it in memory.
 */
export type DataTableMode = "server" | "client"

export const DEFAULT_DATA_TABLE_STATE: DataTableState = {
  pagination: { pageIndex: 0, pageSize: 20 },
  sorting: [],
  columnVisibility: {},
  columnOrder: [],
  columnPinning: { left: [], right: [] },
  rowSelection: {},
  globalFilter: "",
}

export interface UseDataTableOptions<TData> {
  data: TData[]
  // Column value types differ per column.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  /** Total matching rows on the server (defaults to `data.length`). */
  rowCount?: number
  getRowId: (row: TData) => string
  mode?: DataTableMode
  /**
   * Controlled pieces of state (usually URL search params). Anything left
   * out is kept inside the hook, seeded from `initialState`.
   */
  state?: Partial<DataTableState>
  initialState?: Partial<DataTableState>
  /** Receives resolved values only (no updater functions). */
  onStateChange?: (patch: Partial<DataTableState>) => void
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean)
}

function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(current)
    : updater
}

/**
 * TanStack Table with fully resolved state. In `server` mode pagination,
 * sorting and filtering happen in the API; in `client` mode in memory.
 */
export function useDataTable<TData>({
  data,
  columns,
  rowCount,
  getRowId,
  mode = "server",
  state: controlled,
  initialState,
  onStateChange,
  enableRowSelection = false,
}: UseDataTableOptions<TData>) {
  const [internal, setInternal] = useState<DataTableState>(() => ({
    ...DEFAULT_DATA_TABLE_STATE,
    ...initialState,
  }))
  const state: DataTableState = { ...internal, ...controlled }
  const manual = mode === "server"

  const change = (patch: Partial<DataTableState>) => {
    setInternal((current) => ({ ...current, ...patch }))
    onStateChange?.(patch)
  }

  // TanStack Table returns non-memoizable functions; that is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  return useReactTable({
    data,
    columns,
    rowCount: manual ? (rowCount ?? data.length) : undefined,
    getRowId,
    state,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manual ? undefined : getPaginationRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
    getFilteredRowModel: manual ? undefined : getFilteredRowModel(),
    manualPagination: manual,
    manualSorting: manual,
    manualFiltering: manual,
    enableMultiSort: false,
    enableRowSelection,
    // Selection survives paging: rows are keyed by record id.
    autoResetPageIndex: false,
    onPaginationChange: (updater) =>
      change({ pagination: resolve(updater, state.pagination) }),
    onSortingChange: (updater) =>
      change({
        sorting: resolve(updater, state.sorting),
        // A new order starts from the first page.
        pagination: { ...state.pagination, pageIndex: 0 },
      }),
    onGlobalFilterChange: (updater) =>
      change({
        globalFilter: resolve(updater, state.globalFilter ?? ""),
        pagination: { ...state.pagination, pageIndex: 0 },
      }),
    onColumnVisibilityChange: (updater) =>
      change({ columnVisibility: resolve(updater, state.columnVisibility) }),
    onColumnOrderChange: (updater) =>
      change({ columnOrder: resolve(updater, state.columnOrder) }),
    onColumnPinningChange: (updater) =>
      change({ columnPinning: resolve(updater, state.columnPinning) }),
    onRowSelectionChange: (updater) =>
      change({ rowSelection: resolve(updater, state.rowSelection) }),
  })
}
