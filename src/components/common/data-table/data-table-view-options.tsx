import type { Table } from "@tanstack/react-table"
import { Settings2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { Density } from "./use-data-table"

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
  density: Density
  onDensityChange: (density: Density) => void
}

/** Column visibility + row density. */
export function DataTableViewOptions<TData>({
  table,
  density,
  onDensityChange,
}: DataTableViewOptionsProps<TData>) {
  const { t } = useTranslation()
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide())

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Settings2Icon data-icon="inline-start" />
        {t("dataTable.viewOptions")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("dataTable.columns")}</DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(checked) => column.toggleVisibility(checked)}
            >
              {column.columnDef.meta?.label ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("dataTable.density")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={density}
            onValueChange={(value) => onDensityChange(value as Density)}
          >
            <DropdownMenuRadioItem value="comfortable">
              {t("dataTable.comfortable")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="compact">
              {t("dataTable.compact")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
