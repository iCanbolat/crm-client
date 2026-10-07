import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ErrorState } from "@/components/common/error-state"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardWidgetProps } from "@/engine/modules"
import { formatMoney } from "@/lib/currencies"
import { formatDate, formatNumber } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import { forwardingDashboardQuery } from "../../api/dashboard.queries"
import type { ForwardingDashboard } from "../../api/dashboard.schemas"
import { MILESTONE_LABELS } from "../../lib/constants"
import { ModeIcon } from "../mode-icon"

/** Reference categorical palette (dataviz), slots 1–2, light / dark steps. */
const SERIES_1 = { light: "#2a78d6", dark: "#3987e5" }
const SERIES_2 = { light: "#eb6834", dark: "#d95926" }

function useDashboard(range: DashboardWidgetProps["range"]) {
  return useQuery(forwardingDashboardQuery(range))
}

interface WidgetProps extends DashboardWidgetProps {
  title: string
  description?: string
  isEmpty?: (data: ForwardingDashboard) => boolean
  emptyText?: string
  children: (data: ForwardingDashboard) => ReactNode
}

/** Card + loading / error / empty states shared by every widget. */
function Widget({
  range,
  title,
  description,
  isEmpty,
  emptyText,
  children,
}: WidgetProps) {
  const { t } = useTranslation("forwarding")
  const query = useDashboard(range)
  const titleId = `widget-${title.replace(/\W+/g, "-")}`
  return (
    <Card size="sm" className="h-full" role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle>
          <h2 id={titleId}>{title}</h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex-1">
        {query.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : isEmpty?.(query.data) ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyText ?? t("dashboard.empty")}
          </p>
        ) : (
          children(query.data)
        )}
      </CardContent>
    </Card>
  )
}

export function OpenRequestsWidget({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  return (
    <Widget
      range={range}
      title={t("dashboard.openRequests")}
      description={t("dashboard.openRequestsHint")}
    >
      {(data) => (
        <div className="flex flex-col gap-3">
          <p
            className="font-heading text-4xl font-semibold tabular-nums"
            data-testid="open-requests"
          >
            {formatNumber(data.openRequests.total, i18n.language)}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {data.openRequests.byStage.map((item) => (
              <li key={item.stage} className="flex justify-between">
                <span className="text-muted-foreground">
                  {t(
                    `dashboard.stage.${item.stage as "new" | "contacted" | "qualified"}`
                  )}
                </span>
                <span className="tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Widget>
  )
}

export function WinRateWidget({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  return (
    <Widget
      range={range}
      title={t("dashboard.winRate")}
      isEmpty={(data) => data.winRate.rate === null}
    >
      {(data) => (
        <div className="flex flex-col gap-2">
          <p
            className="font-heading text-4xl font-semibold tabular-nums"
            data-testid="win-rate"
          >
            {formatNumber((data.winRate.rate ?? 0) / 100, i18n.language, {
              style: "percent",
              maximumFractionDigits: 1,
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.winRateHint", {
              accepted: data.winRate.accepted,
              decided: data.winRate.decided,
            })}
          </p>
        </div>
      )}
    </Widget>
  )
}

export function RevenueWidget({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  const config = {
    cost: { label: t("dashboard.cost"), theme: SERIES_2 },
    margin: { label: t("dashboard.margin"), theme: SERIES_1 },
  } satisfies ChartConfig
  const monthLabel = (month: string) =>
    formatDate(`${month}-01`, i18n.language, {
      month: "short",
      year: "2-digit",
    })

  return (
    <Widget
      range={range}
      title={t("dashboard.revenue")}
      description={t("dashboard.revenueHint", { currency: "USD" })}
      isEmpty={(data) => data.monthly.length === 0}
    >
      {(data) => {
        const money = (value: number) =>
          formatMoney(value, data.currency, i18n.language)
        return (
          <>
            <ChartContainer config={config} className="aspect-auto h-64 w-full">
              <BarChart data={data.monthly} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={monthLabel}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(value: number) =>
                    formatNumber(value, i18n.language, { notation: "compact" })
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => monthLabel(String(value))}
                      formatter={(value, name) => (
                        <span className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">
                            {config[name as keyof typeof config]?.label}
                          </span>
                          <span className="font-medium tabular-nums">
                            {money(Number(value))}
                          </span>
                        </span>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {/* Cost + profit stack up to the revenue: one axis, no dual scale. */}
                <Bar
                  dataKey="cost"
                  stackId="revenue"
                  fill="var(--color-cost)"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="margin"
                  stackId="revenue"
                  fill="var(--color-margin)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
            <table className="sr-only">
              <caption>{t("dashboard.revenue")}</caption>
              <thead>
                <tr>
                  <th>{t("dashboard.month")}</th>
                  <th>{t("dashboard.total")}</th>
                  <th>{t("dashboard.cost")}</th>
                  <th>{t("dashboard.margin")}</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((item) => (
                  <tr key={item.month}>
                    <td>{monthLabel(item.month)}</td>
                    <td>{money(item.revenue)}</td>
                    <td>{money(item.cost)}</td>
                    <td>{money(item.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      }}
    </Widget>
  )
}

export function ShipmentStatusWidget({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  const language = i18n.language === "en" ? "en" : "tr"
  return (
    <Widget
      range={range}
      title={t("dashboard.shipments")}
      description={t("dashboard.shipmentsHint")}
      isEmpty={(data) => data.shipmentsByStatus.length === 0}
    >
      {(data) => {
        const max = Math.max(
          ...data.shipmentsByStatus.map((item) => item.count)
        )
        return (
          <ul className="flex flex-col gap-2">
            {data.shipmentsByStatus.map((item) => (
              <li
                key={item.status}
                className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2 text-sm"
              >
                <span className="truncate text-muted-foreground">
                  {resolveI18nText(MILESTONE_LABELS[item.status], language)}
                </span>
                <span className="h-3 rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-3 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        )
      }}
    </Widget>
  )
}

export function TopLanesWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("forwarding")
  return (
    <Widget
      range={range}
      title={t("dashboard.lanes")}
      isEmpty={(data) => data.topLanes.length === 0}
    >
      {(data) => (
        <ol className="flex flex-col divide-y">
          {data.topLanes.map((lane) => (
            <li
              key={`${lane.mode}:${lane.origin.code}:${lane.destination.code}`}
              className="flex items-center gap-3 py-2 text-sm"
            >
              <ModeIcon
                mode={lane.mode}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate">{lane.origin.name}</span>
                <ArrowRightIcon className="size-3.5 shrink-0" aria-label="→" />
                <span className="truncate">{lane.destination.name}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {t("dashboard.laneQuotes", { count: lane.quotes })} ·{" "}
                {t("dashboard.laneAccepted", { count: lane.accepted })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Widget>
  )
}

export function DelayedShipmentsWidget({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  return (
    <Widget
      range={range}
      title={t("dashboard.delayed")}
      isEmpty={(data) => data.delayed.length === 0}
      emptyText={t("dashboard.noDelays")}
    >
      {(data) => (
        <ul className="flex flex-col divide-y">
          {data.delayed.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  to="/o/$objectKey/$recordId"
                  params={{ objectKey: "shipment", recordId: item.id }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {item.shipmentNumber}
                </Link>
                <span className="truncate text-xs text-muted-foreground">
                  {item.customer ?? "—"} · ETA{" "}
                  {formatDate(item.eta, i18n.language)}
                </span>
              </div>
              <span className="shrink-0 text-destructive tabular-nums">
                {t("dashboard.delayedDays", { count: item.days })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}

export function RepPerformanceWidget({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  return (
    <Widget
      range={range}
      title={t("dashboard.reps")}
      isEmpty={(data) => data.reps.length === 0}
    >
      {(data) => (
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">{t("dashboard.rep")}</th>
                <th className="py-1 text-right font-medium">
                  {t("dashboard.repQuotes")}
                </th>
                <th className="py-1 text-right font-medium">
                  {t("dashboard.repAccepted")}
                </th>
                <th className="py-1 text-right font-medium">
                  {t("dashboard.repRevenue")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.reps.map((rep) => (
                <tr key={rep.userId} className="border-t">
                  <td className="py-1.5">{rep.name}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {rep.quotes}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {rep.accepted}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatMoney(rep.revenue, data.currency, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Widget>
  )
}
