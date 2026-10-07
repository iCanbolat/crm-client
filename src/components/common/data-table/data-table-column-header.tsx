import type { Column, Table } from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  EyeOffIcon,
  PinIcon,
  PinOffIcon,
  XIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface DataTableColumnHeaderProps<TData> {
  table: Table<TData>
  column: Column<TData>
  title: string
}

/** Moves a column one step within the visible order. */
export function moveColumn<TData>(
  table: Table<TData>,
  columnId: string,
  offset: -1 | 1
) {
  const order = table.getState().columnOrder.length
    ? [...table.getState().columnOrder]
    : table.getAllLeafColumns().map((column) => column.id)
  const index = order.indexOf(columnId)
  const target = index + offset
  if (index < 0 || target < 0 || target >= order.length) return
  ;[order[index], order[target]] = [order[target]!, order[index]!]
  table.setColumnOrder(order)
}

/**
 * Header cell with a column menu: sorting, pinning, ordering and hiding.
 * Static headers (nothing to configure) render plain text.
 */
export function DataTableColumnHeader<TData>({
  table,
  column,
  title,
}: DataTableColumnHeaderProps<TData>) {
  const { t } = useTranslation()
  const sorted = column.getIsSorted()
  const pinned = column.getIsPinned()
  const ids = table
    .getVisibleLeafColumns()
    .filter((item) => item.getCanHide() || item.getCanPin())
    .map((item) => item.id)
  const position = ids.indexOf(column.id)

  if (!column.getCanSort() && !column.getCanHide() && !column.getCanPin()) {
    return <span>{title}</span>
  }

  const SortIcon =
    sorted === "asc"
      ? ArrowUpIcon
      : sorted === "desc"
        ? ArrowDownIcon
        : ArrowUpDownIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "-ml-3 h-8 gap-1.5 px-3 data-popup-open:bg-muted",
              column.columnDef.meta?.numeric && "-mr-3 ml-0"
            )}
            aria-label={t("dataTable.columnMenu", { column: title })}
          />
        }
      >
        <span>{title}</span>
        {column.getCanSort() ? (
          <SortIcon
            className={cn("size-3.5", !sorted && "text-muted-foreground")}
            aria-hidden
          />
        ) : null}
        {pinned ? <PinIcon className="size-3" aria-hidden /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {column.getCanSort() ? (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
              <ArrowUpIcon aria-hidden />
              {t("dataTable.sortAsc")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
              <ArrowDownIcon aria-hidden />
              {t("dataTable.sortDesc")}
            </DropdownMenuItem>
            {sorted ? (
              <DropdownMenuItem onClick={() => column.clearSorting()}>
                <XIcon aria-hidden />
                {t("dataTable.clearSort")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        ) : null}
        {column.getCanSort() && (column.getCanPin() || column.getCanHide()) ? (
          <DropdownMenuSeparator />
        ) : null}
        <DropdownMenuGroup>
          {column.getCanPin() ? (
            <DropdownMenuItem
              onClick={() => column.pin(pinned ? false : "left")}
            >
              {pinned ? <PinOffIcon aria-hidden /> : <PinIcon aria-hidden />}
              {pinned ? t("dataTable.unpin") : t("dataTable.pin")}
            </DropdownMenuItem>
          ) : null}
          {position > 0 ? (
            <DropdownMenuItem onClick={() => moveColumn(table, column.id, -1)}>
              <ArrowLeftIcon aria-hidden />
              {t("dataTable.moveLeft")}
            </DropdownMenuItem>
          ) : null}
          {position >= 0 && position < ids.length - 1 ? (
            <DropdownMenuItem onClick={() => moveColumn(table, column.id, 1)}>
              <ArrowRightIcon aria-hidden />
              {t("dataTable.moveRight")}
            </DropdownMenuItem>
          ) : null}
          {column.getCanHide() ? (
            <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
              <EyeOffIcon aria-hidden />
              {t("dataTable.hide")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
