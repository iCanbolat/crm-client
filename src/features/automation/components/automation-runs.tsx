import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  DataTableColumnHeader,
  useDataTable,
} from "@/components/common/data-table"
import { DataView } from "@/components/common/data-view"
import { ErrorState } from "@/components/common/error-state"
import { SearchInput } from "@/components/common/search-input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/format"

import { automationQueries } from "../api/automation.queries"
import type { ActionResult, AutomationRun } from "../api/automation.schemas"
import { RunStatusBadge } from "./run-status-badge"

/** Run history of a rule: result per record and per action (B7.3). */
export function AutomationRuns({ ruleId }: { ruleId: string }) {
  const { t, i18n } = useTranslation(["automation", "common"])
  const query = useQuery(automationQueries.runs(ruleId))
  const reason = (code: string | null) =>
    code ? t(`runs.reasons.${code}` as "runs.reasons.conditions") : ""
  const actionText = (result: ActionResult) => {
    const type = t(`actions.types.${result.type}` as "actions.types.notify")
    const status = t(`runs.actionStatuses.${result.status}`)
    const detail = result.detail ?? reason(result.code)
    return `${type}: ${status}${detail ? ` — ${detail}` : ""}`
  }

  const columns = useMemo<ColumnDef<AutomationRun, string>[]>(
    () => [
      {
        id: "time",
        accessorFn: (run) => run.createdAt,
        enableHiding: false,
        meta: { label: t("runs.columns.time") },
        header: ({ table, column }) => (
          <DataTableColumnHeader
            table={table}
            column={column}
            title={t("runs.columns.time")}
          />
        ),
        cell: ({ row }) =>
          formatDate(row.original.createdAt, i18n.language, {
            dateStyle: "short",
            timeStyle: "short",
          }),
      },
      {
        id: "record",
        accessorFn: (run) => run.record?.title ?? "",
        meta: { label: t("runs.columns.record") },
        header: ({ table, column }) => (
          <DataTableColumnHeader
            table={table}
            column={column}
            title={t("runs.columns.record")}
          />
        ),
        cell: ({ row: { original: run } }) =>
          run.record ? (
            <Link
              to="/o/$objectKey/$recordId"
              params={{
                objectKey: run.record.objectKey,
                recordId: run.record.recordId,
              }}
              className="hover:underline"
            >
              {run.record.title}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        id: "status",
        accessorFn: (run) => run.status,
        meta: { label: t("runs.columns.status") },
        header: t("runs.columns.status"),
        enableSorting: false,
        cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        accessorFn: (run) =>
          run.reason
            ? reason(run.reason)
            : run.actions.map(actionText).join(" "),
        meta: { label: t("runs.columns.actions") },
        header: t("runs.columns.actions"),
        enableSorting: false,
        cell: ({ row: { original: run } }) => (
          <div className="min-w-64 whitespace-normal">
            {run.reason ? (
              reason(run.reason)
            ) : (
              <ul className="flex flex-col gap-0.5">
                {run.actions.map((result, index) => (
                  <li key={index}>{actionText(result)}</li>
                ))}
              </ul>
            )}
          </div>
        ),
      },
    ],
    // `reason` and `actionText` only depend on `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  )

  const table = useDataTable({
    data: query.data?.data ?? [],
    columns,
    getRowId: (run) => run.id,
    mode: "client",
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: "time", desc: true }],
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("runs.title")}</h2>
        </CardTitle>
        <CardDescription>{t("runs.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : query.data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("runs.empty")}</p>
        ) : (
          <DataView
            table={table}
            label={t("runs.title")}
            viewKey="automation:runs"
            card={{ title: "record", subtitle: "time", badge: "status" }}
            pageSizeOptions={[10, 20, 50]}
            emptyState={
              <p className="text-sm text-muted-foreground">
                {t("common:dataTable.noResults")}
              </p>
            }
            toolbar={{
              search: (
                <SearchInput
                  value=""
                  placeholder={t("common:dataTable.search")}
                  onChange={(q) => table.setGlobalFilter(q ?? "")}
                />
              ),
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
