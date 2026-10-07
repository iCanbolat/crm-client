import type { ColumnDef, Table } from "@tanstack/react-table"
import { XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

export const SELECT_COLUMN_ID = "__select"

/** Leading checkbox column; `getRowLabel` names each row for screen readers. */
export function createSelectColumn<TData>(
  getRowLabel: (row: TData) => string
): ColumnDef<TData> {
  return {
    id: SELECT_COLUMN_ID,
    size: 44,
    enableSorting: false,
    enableHiding: false,
    enablePinning: false,
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row }) => (
      <RowCheckbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        label={getRowLabel(row.original)}
        onChange={(checked) => row.toggleSelected(checked)}
      />
    ),
  }
}

function SelectAllCheckbox<TData>({ table }: { table: Table<TData> }) {
  const { t } = useTranslation()
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={
        !table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()
      }
      disabled={table.getRowModel().rows.length === 0}
      onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
      aria-label={t("dataTable.selectAll")}
    />
  )
}

function RowCheckbox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label={t("dataTable.selectRow", { name: label })}
    />
  )
}

interface SelectionBarProps {
  count: number
  onClear: () => void
  /** Bulk action buttons. */
  children: ReactNode
}

export function DataTableSelectionBar({
  count,
  onClear,
  children,
}: SelectionBarProps) {
  const { t } = useTranslation()
  if (count === 0) return null

  return (
    <div
      role="region"
      aria-label={t("dataTable.bulkActions")}
      className="flex flex-wrap items-center gap-2 rounded-3xl border bg-muted/60 px-3 py-2 text-sm"
    >
      <span aria-live="polite" className="font-medium">
        {t("dataTable.selected", { count })}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        <XIcon data-icon="inline-start" />
        {t("dataTable.clearSelection")}
      </Button>
    </div>
  )
}
