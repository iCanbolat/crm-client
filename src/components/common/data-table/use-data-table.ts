import {
  getCoreRowModel,
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
}

export interface UseDataTableOptions<TData> {
  data: TData[]
  // Column value types differ per column.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  /** Total matching rows on the server. */
  rowCount: number
  getRowId: (row: TData) => string
  state: DataTableState
  /** Receives resolved values only (no updater functions). */
  onStateChange: (patch: Partial<DataTableState>) => void
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean)
}

function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(current)
    : updater
}

/**
 * Server-driven TanStack Table: pagination, sorting and filtering happen in
 * the API; the caller owns every piece of state (usually URL search params).
 */
export function useDataTable<TData>({
  data,
  columns,
  rowCount,
  getRowId,
  state,
  onStateChange,
  enableRowSelection = false,
}: UseDataTableOptions<TData>) {
  // TanStack Table returns non-memoizable functions; that is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  return useReactTable({
    data,
    columns,
    rowCount,
    getRowId,
    state,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
    enableRowSelection,
    // Selection survives paging: rows are keyed by record id.
    autoResetPageIndex: false,
    onPaginationChange: (updater) =>
      onStateChange({ pagination: resolve(updater, state.pagination) }),
    onSortingChange: (updater) =>
      onStateChange({
        sorting: resolve(updater, state.sorting),
        // A new order starts from the first page.
        pagination: { ...state.pagination, pageIndex: 0 },
      }),
    onColumnVisibilityChange: (updater) =>
      onStateChange({
        columnVisibility: resolve(updater, state.columnVisibility),
      }),
    onColumnOrderChange: (updater) =>
      onStateChange({ columnOrder: resolve(updater, state.columnOrder) }),
    onColumnPinningChange: (updater) =>
      onStateChange({ columnPinning: resolve(updater, state.columnPinning) }),
    onRowSelectionChange: (updater) =>
      onStateChange({ rowSelection: resolve(updater, state.rowSelection) }),
  })
}
