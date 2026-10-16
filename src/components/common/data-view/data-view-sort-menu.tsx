import type { Table } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { DATA_VIEW_COMPACT_LABEL } from "./layout-classes"

const NO_SORT = "__none"

/** Sorting without column headers (card layout). */
export function DataViewSortMenu<TData>({ table }: { table: Table<TData> }) {
  const { t } = useTranslation()
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanSort())
  if (!columns.length) return null

  const [current] = table.getState().sorting
  const active = current
    ? columns.find((column) => column.id === current.id)
    : undefined
  const activeLabel = active
    ? (active.columnDef.meta?.label ?? active.id)
    : t("dataTable.sort.label")
  const Icon = !current
    ? ArrowUpDownIcon
    : current.desc
      ? ArrowDownIcon
      : ArrowUpIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={`${t("dataTable.sort.label")}: ${activeLabel}`}
          />
        }
      >
        <Icon data-icon="inline-start" />
        <span className={DATA_VIEW_COMPACT_LABEL}>{activeLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("dataTable.sort.by")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current?.id ?? NO_SORT}
            onValueChange={(id) =>
              table.setSorting(
                id === NO_SORT
                  ? []
                  : [{ id: id as string, desc: current?.desc ?? false }]
              )
            }
          >
            <DropdownMenuRadioItem value={NO_SORT}>
              {t("dataTable.sort.none")}
            </DropdownMenuRadioItem>
            {columns.map((column) => (
              <DropdownMenuRadioItem key={column.id} value={column.id}>
                {column.columnDef.meta?.label ?? column.id}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {current ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {t("dataTable.sort.direction")}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={current.desc ? "desc" : "asc"}
                onValueChange={(direction) =>
                  table.setSorting([
                    { id: current.id, desc: direction === "desc" },
                  ])
                }
              >
                <DropdownMenuRadioItem value="asc">
                  {t("dataTable.sortAsc")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">
                  {t("dataTable.sortDesc")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
