import type { Table } from "@tanstack/react-table"
import { useRef, type ReactNode } from "react"

import {
  DataTable,
  DataTablePagination,
  DataTableViewOptions,
  type Density,
} from "@/components/common/data-table"
import { cn } from "@/lib/utils"

import type { DataCardConfig } from "./data-card"
import { CARD_MIN_WIDTH, DataGrid } from "./data-grid"
import {
  DataViewLayoutToggle,
  type DataViewLayoutOption,
} from "./data-view-layout-toggle"
import { DataViewSortMenu } from "./data-view-sort-menu"
import { DataViewToolbar, type DataViewToolbarSlots } from "./data-view-toolbar"
import { DATA_VIEW_CONTAINER } from "./layout-classes"
import { useElementWidth } from "./use-element-width"
import {
  setDataViewLayout,
  useDataViewLayout,
  type DataViewLayout,
} from "./view-preference"

/** Below this container width (px) tables switch to cards. */
export const FORCE_GRID_BELOW = 640

export interface DataViewExtraLayout extends DataViewLayoutOption {
  /**
   * Replaces the table/grid (and its pagination) while active. Leave it out
   * when the page renders that layout itself (`onLayoutChange`).
   */
  render?: () => ReactNode
}

export interface DataViewProps<TData> {
  table: Table<TData>
  /** Accessible name of the table / card list. */
  label: string
  /** Remembers the table/grid choice of this list (localStorage). */
  viewKey: string
  defaultLayout?: DataViewLayout
  /** Controlled layout (e.g. a URL param); overrides the stored choice. */
  layout?: string
  onLayoutChange?: (layout: string) => void
  extraLayouts?: readonly DataViewExtraLayout[]
  /** Card mapping of a row; defaults to the visible columns. */
  card?: DataCardConfig<TData>
  cardMinWidth?: number
  /** Container width (px) under which the table is forced into cards. */
  forceGridBelow?: number
  toolbar?: DataViewToolbarSlots
  /** Bulk actions bar (shown while rows are selected). */
  selectionBar?: ReactNode
  density?: Density
  onDensityChange?: (density: Density) => void
  /** Column visibility menu (on by default). */
  viewOptions?: boolean
  isFetching?: boolean
  emptyState?: ReactNode
  pageSizeOptions?: readonly number[]
  /** Pagination footer (default: whenever there are rows). */
  pagination?: boolean
  className?: string
}

/**
 * List screen body: toolbar, table ⇄ card grid, pagination. Works with both
 * server and client tables from `useDataTable`.
 */
export function DataView<TData>({
  table,
  label,
  viewKey,
  defaultLayout = "table",
  layout: controlledLayout,
  onLayoutChange,
  extraLayouts = [],
  card,
  cardMinWidth = CARD_MIN_WIDTH,
  forceGridBelow = FORCE_GRID_BELOW,
  toolbar,
  selectionBar,
  density = "comfortable",
  onDensityChange,
  viewOptions = true,
  isFetching = false,
  emptyState,
  pageSizeOptions,
  pagination,
  className,
}: DataViewProps<TData>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(containerRef)
  const storedLayout = useDataViewLayout(viewKey, defaultLayout)
  const requested = controlledLayout ?? storedLayout
  const extra = extraLayouts.find((option) => option.value === requested)
  // An unknown layout (e.g. kanban of an object without a pipeline) falls back.
  const layout =
    extra || requested === "table" || requested === "grid"
      ? requested
      : storedLayout
  const narrow = width > 0 && width < forceGridBelow
  const effective = extra ? layout : narrow ? "grid" : layout

  const changeLayout = (next: string) => {
    if (next === "table" || next === "grid") setDataViewLayout(viewKey, next)
    onLayoutChange?.(next)
  }

  const hasHideable = table
    .getAllLeafColumns()
    .some((column) => column.getCanHide())
  const showPagination = pagination ?? table.getRowCount() > 0

  const controls = (
    <>
      {effective === "grid" ? <DataViewSortMenu table={table} /> : null}
      {!extra && viewOptions && (hasHideable || onDensityChange) ? (
        <DataTableViewOptions
          table={table}
          density={density}
          onDensityChange={effective === "table" ? onDensityChange : undefined}
        />
      ) : null}
      <DataViewLayoutToggle
        value={effective}
        onValueChange={changeLayout}
        extraLayouts={extraLayouts}
        hideTable={narrow}
      />
    </>
  )

  return (
    <div
      ref={containerRef}
      data-slot="data-view"
      data-layout={effective}
      className={cn(
        DATA_VIEW_CONTAINER,
        "flex min-w-0 flex-col gap-3",
        className
      )}
    >
      <DataViewToolbar {...toolbar} controls={controls} />
      {extra ? (
        extra.render?.()
      ) : (
        <>
          {selectionBar}
          {effective === "grid" ? (
            <DataGrid
              table={table}
              label={label}
              card={card}
              cardMinWidth={cardMinWidth}
              isFetching={isFetching}
              emptyState={emptyState}
            />
          ) : (
            <DataTable
              table={table}
              label={label}
              density={density}
              isFetching={isFetching}
              emptyState={emptyState}
            />
          )}
          {showPagination ? (
            <DataTablePagination
              table={table}
              pageSizeOptions={pageSizeOptions}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
