import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { RowSelectionState } from "@tanstack/react-table"
import { FilterXIcon, InboxIcon } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  createSelectColumn,
  DataTable,
  DataTablePagination,
  DataTableSelectionBar,
  DataTableViewOptions,
  SELECT_COLUMN_ID,
  useDataTable,
  type DataTableState,
} from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { Button } from "@/components/ui/button"
import {
  getRecordTitle,
  label,
  type CrmRecord,
  type ObjectDef,
} from "@/engine/metadata"
import { metadataToColumns } from "@/engine/records"
import { usePermission } from "@/features/auth"
import { getPageCount } from "@/lib/api"
import { getCurrentLanguage } from "@/lib/i18n"

import { recordQueries } from "../api/records.queries"
import {
  formatSort,
  parseSort,
  type RecordListSearch,
} from "../api/records.schemas"
import {
  getAvailableColumns,
  getVisibleColumns,
  toListParams,
} from "../lib/list-state"
import { BulkActions } from "./bulk-actions"

interface RecordTableProps {
  objectDef: ObjectDef
  search: RecordListSearch
  onSearchChange: (patch: Partial<RecordListSearch>) => void
  /** Rendered in the empty state of an unfiltered, empty list. */
  emptyAction?: ReactNode
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index])

export function RecordTable({
  objectDef,
  search,
  onSearchChange,
  emptyAction,
}: RecordTableProps) {
  const { t } = useTranslation("records")
  const language = getCurrentLanguage()
  const canSelect = usePermission("create", "record")
  const { data, isFetching } = useSuspenseQuery(
    recordQueries.list(objectDef.key, toListParams(search))
  )
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const available = useMemo(() => getAvailableColumns(objectDef), [objectDef])
  const visible = getVisibleColumns(objectDef, search)
  const sort = parseSort(search.sort)
  const pageCount = getPageCount(data.meta)

  const columns = useMemo(() => {
    const fieldColumns = metadataToColumns(objectDef, available, {
      language,
      renderPrimary: (record: CrmRecord) => (
        <Link
          to="/o/$objectKey/$recordId"
          params={{ objectKey: objectDef.key, recordId: record.id }}
          className="block max-w-xs truncate font-medium underline-offset-4 hover:underline"
        >
          {getRecordTitle(objectDef, record)}
        </Link>
      ),
    })
    return canSelect
      ? [
          createSelectColumn<CrmRecord>((record) =>
            getRecordTitle(objectDef, record)
          ),
          ...fieldColumns,
        ]
      : fieldColumns
  }, [objectDef, available, language, canSelect])

  const state: DataTableState = {
    pagination: { pageIndex: search.page - 1, pageSize: search.pageSize },
    sorting: sort ? [{ id: sort.field, desc: sort.direction === "desc" }] : [],
    columnVisibility: Object.fromEntries(
      available.map((key) => [key, visible.includes(key)])
    ),
    columnOrder: [
      SELECT_COLUMN_ID,
      ...visible,
      ...available.filter((key) => !visible.includes(key)),
    ],
    columnPinning: {
      left: search.pin?.length ? [SELECT_COLUMN_ID, ...search.pin] : [],
      right: [],
    },
    rowSelection,
  }

  /** Default list layout columns are not written to the URL. */
  const toCols = (keys: string[]) =>
    sameList(keys, objectDef.layouts.list.columns) ? undefined : keys

  const table = useDataTable({
    data: data.data,
    columns,
    rowCount: data.meta.total,
    getRowId: (record) => record.id,
    state,
    enableRowSelection: canSelect,
    onStateChange: (patch) => {
      if (patch.rowSelection) setRowSelection(patch.rowSelection)
      if (patch.sorting) {
        const [first] = patch.sorting
        onSearchChange({
          page: 1,
          sort: formatSort(
            first
              ? { field: first.id, direction: first.desc ? "desc" : "asc" }
              : undefined
          ),
        })
      } else if (patch.pagination) {
        const { pageIndex, pageSize } = patch.pagination
        onSearchChange({
          // A new page size starts over from the first page.
          page: pageSize === search.pageSize ? pageIndex + 1 : 1,
          pageSize,
        })
      }
      if (patch.columnVisibility) {
        const order = state.columnOrder.filter(
          (key) => key !== SELECT_COLUMN_ID
        )
        onSearchChange({
          cols: toCols(
            order.filter((key) => patch.columnVisibility![key] !== false)
          ),
        })
      }
      if (patch.columnOrder) {
        onSearchChange({
          cols: toCols(
            patch.columnOrder.filter(
              (key) => key !== SELECT_COLUMN_ID && visible.includes(key)
            )
          ),
        })
      }
      if (patch.columnPinning) {
        const pinned = (patch.columnPinning.left ?? []).filter(
          (key) => key !== SELECT_COLUMN_ID
        )
        onSearchChange({ pin: pinned.length ? pinned : undefined })
      }
    },
  })

  // Deleting the last records of the last page leaves an empty page behind.
  useEffect(() => {
    if (data.data.length === 0 && search.page > pageCount) {
      onSearchChange({ page: pageCount })
    }
  }, [data.data.length, search.page, pageCount, onSearchChange])

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const isFiltered = !!(search.filters?.length || search.q)
  const plural = label(objectDef.pluralLabel, language)
  const singular = label(objectDef.label, language).toLocaleLowerCase(language)

  const emptyState = isFiltered ? (
    <EmptyState
      icon={FilterXIcon}
      title={t("list.noMatchesTitle")}
      description={t("list.noMatchesDescription")}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onSearchChange({ filters: undefined, q: undefined, page: 1 })
          }
        >
          {t("filters.clear")}
        </Button>
      }
      className="border-none"
    />
  ) : (
    <EmptyState
      icon={InboxIcon}
      title={t("list.emptyTitle")}
      description={t("list.emptyDescription", { object: singular })}
      action={emptyAction}
      className="border-none"
    />
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <DataTableViewOptions
          table={table}
          density={search.density}
          onDensityChange={(density) => onSearchChange({ density })}
        />
      </div>
      <DataTableSelectionBar
        count={selectedIds.length}
        onClear={() => setRowSelection({})}
      >
        <BulkActions
          objectDef={objectDef}
          ids={selectedIds}
          onDone={() => setRowSelection({})}
        />
      </DataTableSelectionBar>
      <DataTable
        table={table}
        label={plural}
        density={search.density}
        isFetching={isFetching}
        emptyState={emptyState}
      />
      {data.meta.total > 0 ? <DataTablePagination table={table} /> : null}
    </div>
  )
}
