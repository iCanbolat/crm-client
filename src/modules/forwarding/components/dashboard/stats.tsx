import { useQuery } from "@tanstack/react-query"
import {
  AlarmClockIcon,
  BanknoteIcon,
  InboxIcon,
  TrophyIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { StatCard } from "@/components/common/dashboard"
import type { DashboardWidgetProps } from "@/engine/modules"
import { formatMoney } from "@/lib/currencies"
import { formatNumber } from "@/lib/format"

import { forwardingDashboardQuery } from "../../api/dashboard.queries"

export function OpenRequestsStat({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  const query = useQuery(forwardingDashboardQuery(range))
  return (
    <StatCard
      query={query}
      label={t("dashboard.openRequests")}
      icon={InboxIcon}
      testId="open-requests"
      link={{ to: "/o/$objectKey", params: { objectKey: "lead" } }}
      value={(data) => formatNumber(data.openRequests.total, i18n.language)}
      hint={(data) => {
        const fresh = data.openRequests.byStage.find(
          (item) => item.stage === "new"
        )
        return t("dashboard.openRequestsNew", { count: fresh?.count ?? 0 })
      }}
    />
  )
}

export function WinRateStat({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  const query = useQuery(forwardingDashboardQuery(range))
  return (
    <StatCard
      query={query}
      label={t("dashboard.winRate")}
      icon={TrophyIcon}
      testId="win-rate"
      isEmpty={(data) => data.winRate.rate === null}
      tone={(data) => ((data.winRate.rate ?? 0) >= 50 ? "positive" : "default")}
      value={(data) =>
        formatNumber((data.winRate.rate ?? 0) / 100, i18n.language, {
          style: "percent",
          maximumFractionDigits: 1,
        })
      }
      hint={(data) =>
        t("dashboard.winRateHint", {
          accepted: data.winRate.accepted,
          decided: data.winRate.decided,
        })
      }
    />
  )
}

export function RevenueStat({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  const query = useQuery(forwardingDashboardQuery(range))
  const totals = (data: NonNullable<typeof query.data>) =>
    data.monthly.reduce(
      (sum, item) => ({
        revenue: sum.revenue + item.revenue,
        margin: sum.margin + item.margin,
      }),
      { revenue: 0, margin: 0 }
    )
  return (
    <StatCard
      query={query}
      label={t("dashboard.periodRevenue")}
      icon={BanknoteIcon}
      testId="period-revenue"
      isEmpty={(data) => data.monthly.length === 0}
      value={(data) =>
        formatMoney(totals(data).revenue, data.currency, i18n.language)
      }
      hint={(data) => {
        const { revenue, margin } = totals(data)
        return t("dashboard.periodMargin", {
          margin: formatMoney(margin, data.currency, i18n.language),
          rate: formatNumber(revenue ? margin / revenue : 0, i18n.language, {
            style: "percent",
            maximumFractionDigits: 1,
          }),
        })
      }}
    />
  )
}

export function DelayedShipmentsStat({ range }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation("forwarding")
  const query = useQuery(forwardingDashboardQuery(range))
  return (
    <StatCard
      query={query}
      label={t("dashboard.delayed")}
      icon={AlarmClockIcon}
      testId="delayed-count"
      link={{ to: "/o/$objectKey", params: { objectKey: "shipment" } }}
      tone={(data) => (data.delayed.length ? "warning" : "positive")}
      value={(data) => formatNumber(data.delayed.length, i18n.language)}
      hint={(data) =>
        data.delayed.length
          ? t("dashboard.delayedMax", {
              count: Math.max(...data.delayed.map((item) => item.days)),
            })
          : t("dashboard.allOnTime")
      }
    />
  )
}
