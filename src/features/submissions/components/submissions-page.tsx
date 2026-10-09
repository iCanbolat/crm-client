import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { DownloadIcon, InboxIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  DataTable,
  DataTablePagination,
  useDataTable,
  type DataTableState,
} from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { SearchInput } from "@/components/common/search-input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formQueries } from "@/features/form-builder"
import { getErrorMessage } from "@/lib/api"
import { downloadText } from "@/lib/csv"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import { fetchAllSubmissions } from "../api/submissions.api"
import { submissionQueries } from "../api/submissions.queries"
import {
  SUBMISSION_STATUSES,
  type SubmissionListParams,
  type SubmissionStatus,
  type SubmissionSummary,
} from "../api/submissions.schemas"
import { SUBMISSION_CSV_COLUMNS, submissionsToCsv } from "../lib/csv"
import { SubmissionSheet } from "./submission-sheet"
import { SubmissionStatusBadge } from "./submission-status-badge"

interface SubmissionsPageProps {
  search: SubmissionListParams
  onSearchChange: (patch: Partial<SubmissionListParams>) => void
  /** Inbox of a single form (`/forms/:formId/submissions`). */
  form?: { id: string; name: string }
}

/** Form submissions inbox (B5.6): filters in the URL, detail sheet, CSV. */
export function SubmissionsPage({
  search,
  onSearchChange,
  form,
}: SubmissionsPageProps) {
  const { t } = useTranslation("submissions")
  const language = getCurrentLanguage()
  const params = form ? { ...search, formId: form.id } : search
  const { data, isFetching } = useSuspenseQuery(submissionQueries.list(params))
  const forms = useQuery({
    ...formQueries.list({ page: 1, pageSize: 100 }),
    enabled: !form,
  })
  const [openId, setOpenId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const filtered = !!search.q || !!search.status || (!form && !!search.formId)

  const columns = useMemo<ColumnDef<SubmissionSummary>[]>(
    () => [
      {
        id: "createdAt",
        header: t("columns.createdAt"),
        meta: { label: t("columns.createdAt") },
        cell: ({ row }) => (
          <time
            dateTime={row.original.createdAt}
            title={formatDate(row.original.createdAt, language, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            className="whitespace-nowrap"
          >
            {formatRelativeTime(row.original.createdAt, language)}
          </time>
        ),
      },
      {
        id: "contact",
        header: t("columns.contact"),
        meta: { label: t("columns.contact") },
        cell: ({ row: { original: item } }) => {
          const name = item.contactLabel ?? t("list.anonymous")
          return (
            <button
              type="button"
              className="min-w-40 cursor-pointer text-left font-medium underline-offset-4 hover:underline"
              aria-label={t("open", { name })}
              onClick={() => setOpenId(item.id)}
            >
              {name}
            </button>
          )
        },
      },
      ...(form
        ? []
        : [
            {
              id: "form",
              header: t("columns.form"),
              meta: { label: t("columns.form") },
              cell: ({ row }) => row.original.formName,
            } satisfies ColumnDef<SubmissionSummary>,
          ]),
      {
        id: "status",
        header: t("columns.status"),
        meta: { label: t("columns.status") },
        cell: ({ row }) => (
          <SubmissionStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "source",
        header: t("columns.source"),
        meta: { label: t("columns.source") },
        cell: ({ row }) =>
          row.original.utm.source ?? (
            <span className="text-muted-foreground">{t("list.direct")}</span>
          ),
      },
      {
        id: "record",
        header: t("columns.record"),
        meta: { label: t("columns.record") },
        cell: ({ row }) =>
          row.original.record ? (
            <Link
              to="/o/$objectKey/$recordId"
              params={{
                objectKey: row.original.record.objectKey,
                recordId: row.original.record.id,
              }}
              className="underline-offset-4 hover:underline"
            >
              {row.original.record.title}
            </Link>
          ) : (
            "—"
          ),
      },
    ],
    [t, language, form]
  )

  const state: DataTableState = {
    pagination: { pageIndex: search.page - 1, pageSize: search.pageSize },
    sorting: [],
    columnVisibility: {},
    columnOrder: [],
    columnPinning: { left: [], right: [] },
    rowSelection: {},
  }

  const table = useDataTable({
    data: data.data,
    columns,
    rowCount: data.meta.total,
    getRowId: (item) => item.id,
    state,
    onStateChange: (patch) => {
      if (!patch.pagination) return
      const { pageIndex, pageSize } = patch.pagination
      onSearchChange({ page: pageIndex + 1, pageSize })
    },
  })

  async function exportCsv() {
    setExporting(true)
    try {
      const { page: _page, pageSize: _pageSize, ...filters } = params
      const rows = await fetchAllSubmissions(filters)
      const headers = Object.fromEntries(
        SUBMISSION_CSV_COLUMNS.map((column) => [column, t(`csv.${column}`)])
      ) as Record<(typeof SUBMISSION_CSV_COLUMNS)[number], string>
      const csv = submissionsToCsv(rows, headers, (status) =>
        t(`status.${status}`)
      )
      const date = new Date().toISOString().slice(0, 10)
      downloadText(`gonderimler-${date}.csv`, csv)
      toast.success(t("toast.exported", { count: rows.length }))
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const statusItems = [
    { value: null, label: t("status.all") },
    ...SUBMISSION_STATUSES.map((status) => ({
      value: status,
      label: t(`status.${status}`),
    })),
  ]
  const formItems = [
    { value: null, label: t("filters.allForms") },
    ...(forms.data?.data ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={form ? t("formTitle", { name: form.name }) : t("title")}
        description={t("description")}
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={exporting || data.meta.total === 0}
            onClick={() => void exportCsv()}
          >
            <DownloadIcon data-icon="inline-start" />
            {exporting ? t("exporting") : t("export")}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={search.q ?? ""}
          placeholder={t("searchPlaceholder")}
          onChange={(q) => onSearchChange({ q, page: 1 })}
        />
        <Select
          items={statusItems}
          value={search.status ?? null}
          onValueChange={(value) =>
            onSearchChange({
              status: (value as SubmissionStatus | null) ?? undefined,
              page: 1,
            })
          }
        >
          <SelectTrigger
            className="w-full sm:w-52"
            aria-label={t("status.label")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map((item) => (
              <SelectItem key={item.value ?? "all"} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form ? null : (
          <Select
            items={formItems}
            value={search.formId ?? null}
            onValueChange={(value) =>
              onSearchChange({
                formId: (value as string | null) ?? undefined,
                page: 1,
              })
            }
          >
            <SelectTrigger
              className="w-full sm:w-56"
              aria-label={t("filters.form")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formItems.map((item) => (
                <SelectItem key={item.value ?? "all"} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DataTable
        table={table}
        label={t("list.label")}
        isFetching={isFetching}
        emptyState={
          filtered ? (
            <EmptyState
              icon={SearchIcon}
              title={t("list.noMatch")}
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    onSearchChange({
                      q: undefined,
                      status: undefined,
                      formId: undefined,
                      page: 1,
                    })
                  }
                >
                  {t("list.clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={InboxIcon}
              title={t("list.empty")}
              description={t("list.emptyDescription")}
            />
          )
        }
      />
      {data.meta.total > 0 ? <DataTablePagination table={table} /> : null}

      <SubmissionSheet submissionId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
