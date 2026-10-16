import type { Table } from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { DATA_VIEW_COMPACT_LABEL } from "../data-view/layout-classes"

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: readonly number[]
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation()
  const pageSizeLabelId = useId()
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = Math.max(1, table.getPageCount())
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b)

  return (
    <nav
      aria-label={t("pagination.label")}
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <span className="text-muted-foreground">
        {t("pagination.total", { count: table.getRowCount() })}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            id={pageSizeLabelId}
            className="text-muted-foreground @max-xl/data-view:sr-only"
          >
            {t("pagination.pageSize")}
          </span>
          <Select
            items={sizes.map((size) => ({ value: size, label: String(size) }))}
            value={pageSize}
            onValueChange={(next) => {
              if (typeof next === "number") {
                table.setPagination({ pageIndex: 0, pageSize: next })
              }
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-20"
              aria-labelledby={pageSizeLabelId}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={t("actions.previous")}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            <span className={DATA_VIEW_COMPACT_LABEL}>
              {t("actions.previous")}
            </span>
          </Button>
          <span aria-live="polite" className="tabular-nums">
            {t("pagination.pageOf", { page: pageIndex + 1, pageCount })}
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label={t("actions.next")}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <span className={DATA_VIEW_COMPACT_LABEL}>{t("actions.next")}</span>
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
