import { useQuery } from "@tanstack/react-query"
import {
  BadgeCheckIcon,
  CalendarClockIcon,
  HandCoinsIcon,
  MessageSquareTextIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { StatCard } from "@/components/common/dashboard"
import type { DashboardWidgetProps } from "@/engine/modules"
import { formatMoney } from "@/lib/currencies"
import { formatNumber } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import { visaEducationDashboardQuery } from "../../api/dashboard.queries"
import { SERVICE_TYPE_LABELS, type ServiceType } from "../../lib/constants"

function useLanguage() {
  const { i18n } = useTranslation()
  return i18n.language === "en" ? "en" : "tr"
}

export function OpenInquiriesStat({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  const query = useQuery(visaEducationDashboardQuery(range))
  return (
    <StatCard
      query={query}
      label={t("dashboard.openInquiries")}
      icon={MessageSquareTextIcon}
      testId="open-inquiries"
      link={{ to: "/o/$objectKey", params: { objectKey: "lead" } }}
      value={(data) => formatNumber(data.openInquiries.total, language)}
      hint={(data) => {
        const top = [...data.openInquiries.byService].sort(
          (a, b) => b.count - a.count
        )[0]
        if (!top) return t("dashboard.openInquiriesHint")
        const label = SERVICE_TYPE_LABELS[top.service as ServiceType]
        return t("dashboard.topService", {
          service: label
            ? resolveI18nText(label, language)
            : t("dashboard.unknownService"),
          count: top.count,
        })
      }}
    />
  )
}

export function ApprovalRateStat({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  const query = useQuery(visaEducationDashboardQuery(range))
  return (
    <StatCard
      query={query}
      label={t("dashboard.approvalRate")}
      icon={BadgeCheckIcon}
      testId="approval-rate"
      isEmpty={(data) => data.approvalRate.rate === null}
      tone={(data) =>
        (data.approvalRate.rate ?? 0) >= 70 ? "positive" : "warning"
      }
      value={(data) =>
        formatNumber((data.approvalRate.rate ?? 0) / 100, language, {
          style: "percent",
          maximumFractionDigits: 1,
        })
      }
      hint={(data) =>
        t("dashboard.approvalRateHint", {
          approved: data.approvalRate.approved,
          refused: data.approvalRate.refused,
        })
      }
    />
  )
}

export function CommissionStat({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  const query = useQuery(visaEducationDashboardQuery(range))
  return (
    <StatCard
      query={query}
      label={t("dashboard.commissionReceived")}
      icon={HandCoinsIcon}
      testId="commission-received"
      isEmpty={(data) => data.commission.expected === 0}
      value={(data) =>
        formatMoney(data.commission.received, data.currency, language)
      }
      hint={(data) =>
        t("dashboard.commissionOf", {
          expected: formatMoney(
            data.commission.expected,
            data.currency,
            language
          ),
        })
      }
    />
  )
}

export function OverdueInstallmentsStat({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  const query = useQuery(visaEducationDashboardQuery(range))
  return (
    <StatCard
      query={query}
      label={t("dashboard.overdueCount")}
      icon={CalendarClockIcon}
      testId="overdue-count"
      tone={(data) =>
        data.overdueInstallments.length ? "destructive" : "positive"
      }
      value={(data) => formatNumber(data.overdueInstallments.length, language)}
      hint={(data) => {
        if (!data.overdueInstallments.length) return t("dashboard.noOverdue")
        // Installments may be in different currencies: one sum per currency.
        const totals = new Map<string, number>()
        for (const { amount } of data.overdueInstallments) {
          totals.set(
            amount.currency,
            (totals.get(amount.currency) ?? 0) + amount.amount
          )
        }
        return t("dashboard.overdueTotal", {
          amount: [...totals]
            .map(([currency, total]) => formatMoney(total, currency, language))
            .join(" + "),
        })
      }}
    />
  )
}
