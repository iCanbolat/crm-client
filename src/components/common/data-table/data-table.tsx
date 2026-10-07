import {
  flexRender,
  type Column,
  type Row,
  type Table as TanstackTable,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef, type CSSProperties, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

import type { Density } from "./use-data-table"

/** Above this many rows the body is virtualized. */
export const VIRTUALIZE_THRESHOLD = 50

const ROW_HEIGHT: Record<Density, number> = { comfortable: 49, compact: 37 }

const CELL_PADDING: Record<Density, string> = {
  comfortable: "px-3 py-3",
  compact: "px-3 py-1.5",
}

function pinnedStyle<TData>(column: Column<TData>): CSSProperties | undefined {
  if (column.getIsPinned() !== "left") return undefined
  const width = column.getSize()
  return {
    position: "sticky",
    left: column.getStart("left"),
    width,
    minWidth: width,
    maxWidth: width,
    zIndex: 1,
  }
}

interface DataTableProps<TData> {
  table: TanstackTable<TData>
  /** Accessible name of the grid. */
  label: string
  density?: Density
  /** Background refetch (previous rows stay visible). */
  isFetching?: boolean
  emptyState?: ReactNode
  virtualizeThreshold?: number
  className?: string
}

export function DataTable<TData>({
  table,
  label,
  density = "comfortable",
  isFetching = false,
  emptyState,
  virtualizeThreshold = VIRTUALIZE_THRESHOLD,
  className,
}: DataTableProps<TData>) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  const virtualize = rows.length > virtualizeThreshold

  // TanStack Virtual returns non-memoizable functions; that is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT[density],
    overscan: 10,
    enabled: virtualize,
  })

  const virtualRows = virtualize ? virtualizer.getVirtualItems() : []
  const paddingTop = virtualRows[0]?.start ?? 0
  const paddingBottom = virtualize
    ? virtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0)
    : 0
  const visibleRows: Row<TData>[] = virtualize
    ? virtualRows.flatMap((item) => rows[item.index] ?? [])
    : rows
  const columnCount = table.getVisibleLeafColumns().length

  return (
    <div
      ref={scrollRef}
      data-slot="data-table"
      data-density={density}
      className={cn(
        "relative w-full overflow-auto rounded-3xl border",
        virtualize && "max-h-[70vh]",
        className
      )}
    >
      {isFetching ? (
        <div
          role="status"
          className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-primary"
        >
          <span className="sr-only">{t("dataTable.loading")}</span>
        </div>
      ) : null}
      <table
        aria-label={label}
        aria-rowcount={table.getRowCount() + 1}
        aria-busy={isFetching || undefined}
        className="w-full caption-bottom text-sm"
      >
        <thead className="sticky top-0 z-10 bg-background [&_tr]:border-b">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    scope="col"
                    colSpan={header.colSpan}
                    aria-sort={
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : undefined
                    }
                    style={pinnedStyle(header.column)}
                    className={cn(
                      "h-11 bg-background px-3 text-left align-middle font-medium whitespace-nowrap text-foreground",
                      header.column.columnDef.meta?.numeric && "text-right"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody
          className={cn(
            "[&_tr:last-child]:border-0",
            isFetching && "opacity-70 transition-opacity"
          )}
        >
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="p-4">
                {emptyState}
              </td>
            </tr>
          ) : null}
          {paddingTop > 0 ? (
            <tr aria-hidden>
              <td colSpan={columnCount} style={{ height: paddingTop }} />
            </tr>
          ) : null}
          {visibleRows.map((row) => (
            <tr
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
              className="group/row border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={pinnedStyle(cell.column)}
                  className={cn(
                    "align-middle whitespace-nowrap",
                    CELL_PADDING[density],
                    cell.column.getIsPinned() &&
                      "bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted",
                    cell.column.columnDef.meta?.numeric && "text-right"
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {paddingBottom > 0 ? (
            <tr aria-hidden>
              <td colSpan={columnCount} style={{ height: paddingBottom }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
