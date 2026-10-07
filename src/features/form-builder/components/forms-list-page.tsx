import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  EyeIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import {
  DataTable,
  DataTablePagination,
  useDataTable,
  type DataTableState,
} from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePermission } from "@/features/auth"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import { useDeleteForm } from "../api/forms.mutations"
import { formQueries } from "../api/forms.queries"
import {
  FORM_STATUSES,
  type FormListParams,
  type FormStatus,
  type FormSummary,
} from "../api/forms.schemas"
import { CreateFormDialog } from "./create-form-dialog"
import { FormStatusBadge } from "./form-status-badge"
import { FormPreviewDialog } from "./preview-dialog"

function SearchInput({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (value: string | undefined) => void
}) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, 300)

  useEffect(() => {
    if (debounced.trim() !== value.trim())
      onChange(debounced.trim() || undefined)
    // Only typing triggers a search; `value` changes come from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <InputGroup className="w-full sm:w-64">
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setText(event.target.value)}
      />
    </InputGroup>
  )
}

interface FormsListPageProps {
  search: FormListParams
  onSearchChange: (patch: Partial<FormListParams>) => void
}

/** Lead forms of the workspace with their stats (B4.2). */
export function FormsListPage({ search, onSearchChange }: FormsListPageProps) {
  const { t } = useTranslation(["forms", "common"])
  const language = getCurrentLanguage()
  const canCreate = usePermission("create", "form")
  const canEdit = usePermission("update", "form")
  const canDelete = usePermission("delete", "form")
  const { data, isFetching } = useSuspenseQuery(formQueries.list(search))
  const deleteMutation = useDeleteForm()
  const [creating, setCreating] = useState(false)
  const [previewing, setPreviewing] = useState<FormSummary | null>(null)
  const [deleting, setDeleting] = useState<FormSummary | null>(null)
  const filtered = !!search.q || !!search.status

  const columns = useMemo<ColumnDef<FormSummary>[]>(
    () => [
      {
        id: "name",
        header: t("columns.name"),
        meta: { label: t("columns.name") },
        cell: ({ row: { original: form } }) => (
          <div className="flex min-w-48 flex-col">
            {canEdit ? (
              <Link
                to="/forms/$formId/edit"
                params={{ formId: form.id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {form.name}
              </Link>
            ) : (
              <span className="font-medium">{form.name}</span>
            )}
            <span className="text-xs text-muted-foreground">
              /f/{form.slug} · {t("list.fields", { count: form.fieldCount })}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: t("columns.status"),
        meta: { label: t("columns.status") },
        cell: ({ row }) => <FormStatusBadge form={row.original} />,
      },
      {
        id: "version",
        header: t("columns.version"),
        meta: { label: t("columns.version") },
        cell: ({ row }) =>
          row.original.publishedVersion
            ? t("list.version", { version: row.original.publishedVersion })
            : "—",
      },
      {
        id: "views",
        header: t("columns.views"),
        meta: { label: t("columns.views"), numeric: true },
        cell: ({ row }) => formatNumber(row.original.stats.views, language),
      },
      {
        id: "submissions",
        header: t("columns.submissions"),
        meta: { label: t("columns.submissions"), numeric: true },
        cell: ({ row }) =>
          formatNumber(row.original.stats.submissions, language),
      },
      {
        id: "conversion",
        header: t("columns.conversion"),
        meta: { label: t("columns.conversion"), numeric: true },
        cell: ({ row }) =>
          formatNumber(row.original.stats.conversionRate, language, {
            style: "percent",
            maximumFractionDigits: 1,
          }),
      },
      {
        id: "updatedAt",
        header: t("columns.updatedAt"),
        meta: { label: t("columns.updatedAt") },
        cell: ({ row }) => (
          <time dateTime={row.original.updatedAt} className="whitespace-nowrap">
            {formatRelativeTime(row.original.updatedAt, language)}
          </time>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("columns.actions")}</span>,
        meta: { label: t("columns.actions") },
        cell: ({ row: { original: form } }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("rowActions.label", { name: form.name })}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? (
                <DropdownMenuItem
                  render={
                    <Link
                      to="/forms/$formId/edit"
                      params={{ formId: form.id }}
                    />
                  }
                >
                  <PencilIcon />
                  {t("rowActions.edit")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => setPreviewing(form)}>
                <EyeIcon />
                {t("rowActions.preview")}
              </DropdownMenuItem>
              {canDelete ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={form.status === "published"}
                  onClick={() => setDeleting(form)}
                >
                  <Trash2Icon />
                  {form.status === "published"
                    ? t("rowActions.deletePublished")
                    : t("rowActions.delete")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, language, canEdit, canDelete]
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
    getRowId: (form) => form.id,
    state,
    onStateChange: (patch) => {
      if (!patch.pagination) return
      const { pageIndex, pageSize } = patch.pagination
      onSearchChange({ page: pageIndex + 1, pageSize })
    },
  })

  const createButton = canCreate ? (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon data-icon="inline-start" />
      {t("new")}
    </Button>
  ) : null

  const statusItems = [
    { value: null, label: t("status.all") },
    ...FORM_STATUSES.map((status) => ({
      value: status,
      label: t(`status.${status}`),
    })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={createButton}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              status: (value as FormStatus | null) ?? undefined,
              page: 1,
            })
          }
        >
          <SelectTrigger
            className="w-full sm:w-44"
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
                    onSearchChange({ q: undefined, status: undefined, page: 1 })
                  }
                >
                  {t("list.clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileTextIcon}
              title={t("list.empty")}
              description={t("list.emptyDescription")}
              action={createButton}
            />
          )
        }
      />
      {data.meta.total > 0 ? <DataTablePagination table={table} /> : null}

      <CreateFormDialog open={creating} onOpenChange={setCreating} />
      <FormPreviewDialog
        formId={previewing?.id ?? null}
        name={previewing?.name ?? ""}
        onClose={() => setPreviewing(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description", {
          name: deleting?.name ?? "",
        })}
        confirmLabel={t("common:actions.delete")}
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleting) return
          await deleteMutation.mutateAsync(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}
