import { useQuery } from "@tanstack/react-query"
import { BarChart3Icon, DownloadIcon } from "lucide-react"
import { lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  ReportCell,
  ReportColumnKind,
  ReportDef,
  ReportResult,
} from "@/engine/reports"
import { useSession } from "@/features/auth"
import { DateRangeFilter } from "@/features/dashboard"
import { directoryQueries } from "@/features/records"
import { downloadText } from "@/lib/csv"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import { reportQueries } from "../api/reports.queries"
import type { ReportSearch } from "../api/reports.schemas"
import { reportToCsv } from "../lib/csv"
import { formatReportCell } from "../lib/format"
import { toReportParams } from "../lib/reports"

/** recharts loads with the chart, not with the shell (B7.4). */
const ReportChart = lazy(() =>
  import("./report-chart").then((module) => ({ default: module.ReportChart }))
)

const ALL_OWNERS = "__all"

interface ReportPageProps {
  def: ReportDef
  search: ReportSearch
  onSearchChange: (search: Partial<ReportSearch>) => void
}

/** One ready-made report: filters, chart, table and CSV export (B7.1). */
export function ReportPage({ def, search, onSearchChange }: ReportPageProps) {
  const { t } = useTranslation("reports")
  const language = getCurrentLanguage()
  const { role } = useSession()
  const params = toReportParams(search)
  const query = useQuery(reportQueries.detail(def.key, params))
  const title = resolveI18nText(def.label, language)
  const result = query.data

  function exportCsv() {
    if (!result) return
    downloadText(
      `${def.key}-${params.from}-${params.to}.csv`,
      reportToCsv(def, result, language)
    )
    toast.success(t("exported"))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={resolveI18nText(def.description, language)}
        actions={
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!result?.rows.length}
          >
            <DownloadIcon aria-hidden />
            {t("exportCsv")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <DateRangeFilter
          search={search}
          range={{ from: params.from, to: params.to }}
          onChange={onSearchChange}
        />
        {role === "agent" ? (
          <p className="pb-2 text-sm text-muted-foreground">{t("ownOnly")}</p>
        ) : (
          <OwnerFilter
            value={search.ownerId}
            onChange={(ownerId) => onSearchChange({ ownerId })}
          />
        )}
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : result!.rows.length === 0 ? (
        <EmptyState
          icon={BarChart3Icon}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <ReportBody def={def} result={result!} language={language} />
      )}
    </div>
  )
}

function OwnerFilter({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (ownerId: string | undefined) => void
}) {
  const { t } = useTranslation("reports")
  const users = useQuery(directoryQueries.users())
  const items = [
    { value: ALL_OWNERS, label: t("allOwners") },
    ...(users.data?.data ?? [])
      .filter((user) => user.role !== "viewer")
      .map((user) => ({ value: user.id, label: user.name })),
  ]
  return (
    <Select
      items={items}
      value={value ?? ALL_OWNERS}
      onValueChange={(next) =>
        onChange(next === ALL_OWNERS || !next ? undefined : String(next))
      }
    >
      <SelectTrigger aria-label={t("owner")} className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ReportBody({
  def,
  result,
  language,
}: {
  def: ReportDef
  result: ReportResult
  language: ReturnType<typeof getCurrentLanguage>
}) {
  const { t, i18n } = useTranslation("reports")
  const locale = i18n.language
  const title = resolveI18nText(def.label, language)
  const hasMoney = def.columns.some((column) => column.kind === "currency")
  const chart = def.chart
  const valueColumn = chart
    ? def.columns.find((column) => column.key === chart.valueKey)
    : undefined
  const format = (value: ReportCell | undefined, kind: ReportColumnKind) =>
    formatReportCell(value ?? null, kind, { locale, currency: result.currency })
  const alignEnd = (kind: string) => kind !== "text"

  return (
    <>
      {chart && valueColumn ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              <h2>{t("chart")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              <ReportChart
                def={{ ...def, chart }}
                result={result}
                valueColumn={valueColumn}
                valueLabel={resolveI18nText(valueColumn.label, language)}
                locale={locale}
              />
            </Suspense>
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>{t("table")}</h2>
          </CardTitle>
          {hasMoney ? (
            <p className="text-sm text-muted-foreground">
              {t("currencyHint", { currency: result.currency })}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table containerLabel={t("table")}>
            <TableCaption className="sr-only">{title}</TableCaption>
            <TableHeader>
              <TableRow>
                {def.columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(alignEnd(column.kind) && "text-right")}
                  >
                    {resolveI18nText(column.label, language)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row, index) => (
                <TableRow key={index}>
                  {def.columns.map((column, columnIndex) => {
                    const Cell = columnIndex === 0 ? "th" : TableCell
                    return (
                      <Cell
                        key={column.key}
                        scope={columnIndex === 0 ? "row" : undefined}
                        className={cn(
                          columnIndex === 0 &&
                            "p-2 text-left align-middle font-medium whitespace-nowrap",
                          alignEnd(column.kind) && "text-right tabular-nums"
                        )}
                      >
                        {format(row[column.key], column.kind)}
                      </Cell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
            {result.totals ? (
              <TableFooter>
                <TableRow>
                  {def.columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        alignEnd(column.kind) && "text-right tabular-nums"
                      )}
                    >
                      {result.totals![column.key] === null
                        ? null
                        : format(result.totals![column.key], column.kind)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
