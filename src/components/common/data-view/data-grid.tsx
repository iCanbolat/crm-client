import type { Table } from "@tanstack/react-table"
import type { CSSProperties, ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  SELECT_COLUMN_ID,
  SelectAllCheckbox,
} from "@/components/common/data-table"
import { cn } from "@/lib/utils"

import { DataCard, type DataCardConfig } from "./data-card"

/** Default minimum card width (px) before the grid drops a column. */
export const CARD_MIN_WIDTH = 280

interface DataGridProps<TData> {
  table: Table<TData>
  /** Accessible name of the list. */
  label: string
  card?: DataCardConfig<TData>
  cardMinWidth?: number
  isFetching?: boolean
  emptyState?: ReactNode
  className?: string
}

/**
 * Card layout of a table's current rows. `auto-fill` fits as many columns as
 * the container allows, so it adapts to the sidebar and page width.
 */
export function DataGrid<TData>({
  table,
  label,
  card,
  cardMinWidth = CARD_MIN_WIDTH,
  isFetching = false,
  emptyState,
  className,
}: DataGridProps<TData>) {
  const { t } = useTranslation()
  const rows = table.getRowModel().rows
  const selectable = table
    .getVisibleLeafColumns()
    .some((column) => column.id === SELECT_COLUMN_ID)

  return (
    <div
      data-slot="data-grid"
      className={cn("relative flex flex-col gap-3", className)}
    >
      {isFetching ? (
        <div
          role="status"
          className="absolute inset-x-0 -top-1.5 z-20 h-0.5 animate-pulse rounded-full bg-primary"
        >
          <span className="sr-only">{t("dataTable.loading")}</span>
        </div>
      ) : null}
      {selectable && rows.length ? (
        <div className="flex w-fit items-center gap-2 px-4 text-sm text-muted-foreground">
          <SelectAllCheckbox table={table} />
          <span aria-hidden>{t("dataTable.selectPage")}</span>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <div className="rounded-3xl border p-4">{emptyState}</div>
      ) : (
        <ul
          aria-label={label}
          aria-busy={isFetching || undefined}
          style={
            {
              "--card-min": `${cardMinWidth}px`,
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, var(--card-min)), 1fr))",
            } as CSSProperties
          }
          className={cn(
            "grid gap-3",
            isFetching && "opacity-70 transition-opacity"
          )}
        >
          {rows.map((row) => (
            <li key={row.id} className="min-w-0">
              <DataCard row={row} config={card} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
