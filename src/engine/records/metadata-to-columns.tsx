import type { ColumnDef } from "@tanstack/react-table"
import type { ReactNode } from "react"

import { DataTableColumnHeader } from "@/components/common/data-table"
import type { Language } from "@/lib/i18n"

import { getFieldType } from "../field-types/registry"
import { label, pickFields } from "../metadata/helpers"
import type { CrmRecord, FieldDef, ObjectDef } from "../metadata/schemas"

const NUMERIC_TYPES = new Set(["number", "currency", "percent"])

export interface MetadataToColumnsOptions {
  language: Language
  /** Renders the primary field (usually a link to the record). */
  renderPrimary?: (record: CrmRecord) => ReactNode
}

export function fieldColumnSize(field: FieldDef, objectDef: ObjectDef) {
  if (field.key === objectDef.primaryField) return 240
  if (field.type === "textarea" || field.type === "multiselect") return 220
  return 170
}

/**
 * Table columns generated from metadata (B2.1). `columnKeys` lists every
 * field the table may show — visibility and order are table state.
 */
export function metadataToColumns(
  objectDef: ObjectDef,
  columnKeys: readonly string[],
  { language, renderPrimary }: MetadataToColumnsOptions
): ColumnDef<CrmRecord, unknown>[] {
  return pickFields(objectDef, columnKeys).map((field) => {
    const definition = getFieldType(field.type)
    const title = label(field.label, language)
    const isPrimary = field.key === objectDef.primaryField

    return {
      id: field.key,
      accessorFn: (record) => record.values[field.key],
      size: fieldColumnSize(field, objectDef),
      enableSorting: definition.sortable,
      enableHiding: !isPrimary,
      enablePinning: true,
      meta: { label: title, numeric: NUMERIC_TYPES.has(field.type) },
      header: ({ table, column }) => (
        <DataTableColumnHeader table={table} column={column} title={title} />
      ),
      cell: ({ row }) =>
        isPrimary && renderPrimary ? (
          renderPrimary(row.original)
        ) : (
          <definition.Cell
            field={field}
            value={row.original.values[field.key]}
            refValue={row.original.refs[field.key]}
          />
        ),
    }
  })
}
