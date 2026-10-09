import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ReportColumn, ReportDef, ReportResult } from "@/engine/reports"
import { formatNumber } from "@/lib/format"

import { formatReportCell } from "../lib/format"

/** Reference categorical palette (dataviz), slot 1, light / dark steps. */
const SERIES_1 = { light: "#2a78d6", dark: "#3987e5" }
const MAX_BARS = 10
const ROW_HEIGHT = 36

interface ReportChartProps {
  def: ReportDef & { chart: NonNullable<ReportDef["chart"]> }
  result: ReportResult
  valueColumn: ReportColumn
  valueLabel: string
  locale: string
}

/**
 * Horizontal bars of one value column. Funnel steps keep their order; other
 * reports show the top rows. The table below carries the same numbers, so
 * the chart is hidden from assistive technology.
 */
export function ReportChart({
  def,
  result,
  valueColumn,
  valueLabel,
  locale,
}: ReportChartProps) {
  const { labelKey, valueKey, kind } = def.chart
  const data = result.rows
    .map((row) => ({
      label: String(row[labelKey] ?? "—"),
      value: typeof row[valueKey] === "number" ? row[valueKey] : 0,
    }))
    .slice(0, kind === "funnel" ? undefined : MAX_BARS)
  const config = {
    value: { label: valueLabel, theme: SERIES_1 },
  } satisfies ChartConfig

  return (
    <div aria-hidden>
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height: data.length * ROW_HEIGHT + 32 }}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 16 }}
          // Hidden from assistive tech (the table has the numbers): no
          // keyboard focus stop inside an aria-hidden region.
          accessibilityLayer={false}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              formatNumber(value, locale, { notation: "compact" })
            }
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={180}
            tickFormatter={(value: string) =>
              value.length > 26 ? `${value.slice(0, 25)}…` : value
            }
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{valueLabel}</span>
                    <span className="font-medium tabular-nums">
                      {formatReportCell(Number(value), valueColumn.kind, {
                        locale,
                        currency: result.currency,
                      })}
                    </span>
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
