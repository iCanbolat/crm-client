import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { BarList, DashboardWidget } from "@/components/common/dashboard"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { DashboardWidgetProps } from "@/engine/modules"
import { formatMoney } from "@/lib/currencies"
import { formatDate, formatNumber } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import { forwardingDashboardQuery } from "../../api/dashboard.queries"
import { MILESTONE_LABELS } from "../../lib/constants"
import { ModeIcon } from "../mode-icon"

/** Reference categorical palette (dataviz), slots 1–2, light / dark steps. */
const SERIES_1 = { light: "#2a78d6", dark: "#3987e5" }
const SERIES_2 = { light: "#eb6834", dark: "#d95926" }

function useDashboard(range: DashboardWidgetProps["range"]) {
  return useQuery(forwardingDashboardQuery(range))
}

export function RevenueWidget({ range }: DashboardWidgetProps) {
  const query = useDashboard(range)
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
    <DashboardWidget
      query={query}
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
    </DashboardWidget>
  )
}

export function ShipmentStatusWidget({ range }: DashboardWidgetProps) {
  const query = useDashboard(range)
  const { t, i18n } = useTranslation("forwarding")
  const language = i18n.language === "en" ? "en" : "tr"
  return (
    <DashboardWidget
      query={query}
      title={t("dashboard.shipments")}
      description={t("dashboard.shipmentsHint")}
      isEmpty={(data) => data.shipmentsByStatus.length === 0}
    >
      {(data) => (
        <BarList
          label={t("dashboard.shipments")}
          items={data.shipmentsByStatus.map((item) => ({
            key: item.status,
            label: resolveI18nText(MILESTONE_LABELS[item.status], language),
            count: item.count,
          }))}
        />
      )}
    </DashboardWidget>
  )
}

export function TopLanesWidget({ range }: DashboardWidgetProps) {
  const query = useDashboard(range)
  const { t } = useTranslation("forwarding")
  return (
    <DashboardWidget
      query={query}
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
    </DashboardWidget>
  )
}

export function DelayedShipmentsWidget({ range }: DashboardWidgetProps) {
  const query = useDashboard(range)
  const { t, i18n } = useTranslation("forwarding")
  return (
    <DashboardWidget
      query={query}
      title={t("dashboard.delayed")}
      action={
        <Link
          to="/o/$objectKey"
          params={{ objectKey: "shipment" }}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("dashboard.seeAll")}
        </Link>
      }
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
    </DashboardWidget>
  )
}

export function RepPerformanceWidget({ range }: DashboardWidgetProps) {
  const query = useDashboard(range)
  const { t, i18n } = useTranslation("forwarding")
  return (
    <DashboardWidget
      query={query}
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
    </DashboardWidget>
  )
}
