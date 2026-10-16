import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/common/error-state"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardWidgetProps } from "@/engine/modules"
import { useOptionalObjectDef } from "@/features/records"
import { formatMoney } from "@/lib/currencies"
import { formatDate, formatNumber } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import { visaEducationDashboardQuery } from "../../api/dashboard.queries"
import type { VisaEducationDashboard } from "../../api/dashboard.schemas"
import { SERVICE_TYPE_LABELS, type ServiceType } from "../../lib/constants"
import { formatIntake } from "../../lib/intake"

interface WidgetProps extends DashboardWidgetProps {
  title: string
  description?: string
  isEmpty?: (data: VisaEducationDashboard) => boolean
  children: (data: VisaEducationDashboard) => ReactNode
}

/** Card + loading / error / empty states shared by every widget. */
function Widget({ range, title, description, isEmpty, children }: WidgetProps) {
  const { t } = useTranslation("visaEducation")
  const query = useQuery(visaEducationDashboardQuery(range))
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
            {t("dashboard.empty")}
          </p>
        ) : (
          children(query.data)
        )}
      </CardContent>
    </Card>
  )
}

function useLanguage() {
  const { i18n } = useTranslation()
  return i18n.language === "en" ? "en" : "tr"
}

/** Horizontal bars (no chart library: data stays readable as a list). */
function Bars({
  items,
  label,
}: {
  items: { key: string; label: string; count: number }[]
  label: string
}) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return (
    <ul className="flex flex-col gap-2" aria-label={label}>
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2 text-sm"
        >
          <span className="truncate text-muted-foreground">{item.label}</span>
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
}

function useStageLabels(objectKey: string) {
  const def = useOptionalObjectDef(objectKey)
  const language = useLanguage()
  return (stage: string) => {
    const found = def?.pipeline?.stages.find((item) => item.key === stage)
    return found ? resolveI18nText(found.label, language) : stage
  }
}

export function OpenInquiriesWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <Widget
      range={range}
      title={t("dashboard.openInquiries")}
      description={t("dashboard.openInquiriesHint")}
    >
      {(data) => (
        <div className="flex flex-col gap-3">
          <p
            className="font-heading text-4xl font-semibold tabular-nums"
            data-testid="open-inquiries"
          >
            {formatNumber(data.openInquiries.total, language)}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {data.openInquiries.byService.map((item) => (
              <li key={item.service} className="flex justify-between">
                <span className="text-muted-foreground">
                  {SERVICE_TYPE_LABELS[item.service as ServiceType]
                    ? resolveI18nText(
                        SERVICE_TYPE_LABELS[item.service as ServiceType],
                        language
                      )
                    : t("dashboard.unknownService")}
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

export function ApprovalRateWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <Widget
      range={range}
      title={t("dashboard.approvalRate")}
      isEmpty={(data) => data.approvalRate.rate === null}
    >
      {(data) => (
        <div className="flex flex-col gap-2">
          <p
            className="font-heading text-4xl font-semibold tabular-nums"
            data-testid="approval-rate"
          >
            {formatNumber((data.approvalRate.rate ?? 0) / 100, language, {
              style: "percent",
              maximumFractionDigits: 1,
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.approvalRateHint", {
              approved: data.approvalRate.approved,
              refused: data.approvalRate.refused,
            })}
          </p>
        </div>
      )}
    </Widget>
  )
}

export function EnrollmentStagesWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const label = useStageLabels("enrollment")
  return (
    <Widget
      range={range}
      title={t("dashboard.enrollments")}
      description={t("dashboard.createdInRange")}
      isEmpty={(data) => data.enrollmentsByStage.every((item) => !item.count)}
    >
      {(data) => (
        <Bars
          label={t("dashboard.enrollments")}
          items={data.enrollmentsByStage.map((item) => ({
            key: item.stage,
            label: label(item.stage),
            count: item.count,
          }))}
        />
      )}
    </Widget>
  )
}

export function VisaStagesWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const label = useStageLabels("visaApplication")
  return (
    <Widget
      range={range}
      title={t("dashboard.visas")}
      description={t("dashboard.createdInRange")}
      isEmpty={(data) => data.visasByStage.every((item) => !item.count)}
    >
      {(data) => (
        <Bars
          label={t("dashboard.visas")}
          items={data.visasByStage.map((item) => ({
            key: item.stage,
            label: label(item.stage),
            count: item.count,
          }))}
        />
      )}
    </Widget>
  )
}

export function UpcomingAppointmentsWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <Widget
      range={range}
      title={t("dashboard.appointments")}
      description={t("dashboard.appointmentsHint")}
      isEmpty={(data) => data.upcomingAppointments.length === 0}
    >
      {(data) => (
        <ul
          className="flex flex-col divide-y"
          data-testid="upcoming-appointments"
        >
          {data.upcomingAppointments.map((item) => (
            <li key={item.id} className="flex flex-col gap-0.5 py-2 text-sm">
              <Link
                to="/o/$objectKey/$recordId"
                params={{ objectKey: "appointment", recordId: item.id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {item.applicant ?? item.title}
              </Link>
              <span className="text-muted-foreground">
                {formatDate(item.scheduledAt, language, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {item.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}

export function MissingDocumentsWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  return (
    <Widget
      range={range}
      title={t("dashboard.missingDocuments")}
      description={t("dashboard.missingDocumentsHint")}
      isEmpty={(data) => data.missingDocuments.length === 0}
    >
      {(data) => (
        <ul className="flex flex-col divide-y">
          {data.missingDocuments.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <Link
                to="/o/$objectKey/$recordId"
                params={{ objectKey: item.objectKey, recordId: item.id }}
                className="min-w-0 truncate underline-offset-4 hover:underline"
              >
                {item.number}
                {item.applicant ? ` · ${item.applicant}` : ""}
              </Link>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {t("dashboard.missingCount", { count: item.missing })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}

export function OverdueInstallmentsWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <Widget
      range={range}
      title={t("dashboard.overdue")}
      isEmpty={(data) => data.overdueInstallments.length === 0}
    >
      {(data) => (
        <ul className="flex flex-col divide-y">
          {data.overdueInstallments.map((item, index) => (
            <li
              key={`${item.id}:${index}`}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <Link
                to="/o/$objectKey/$recordId"
                params={{ objectKey: item.objectKey, recordId: item.id }}
                className="min-w-0 truncate underline-offset-4 hover:underline"
              >
                {item.applicant ?? item.number}
              </Link>
              <span className="shrink-0 text-right tabular-nums">
                {formatMoney(
                  item.amount.amount,
                  item.amount.currency,
                  language
                )}
                <span className="block text-xs text-muted-foreground">
                  {formatDate(`${item.dueDate}T00:00:00`, language)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}

export function IntakeForecastWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <Widget
      range={range}
      title={t("dashboard.intakes")}
      description={t("dashboard.intakesHint")}
      isEmpty={(data) => data.intakeForecast.length === 0}
    >
      {(data) => (
        <Bars
          label={t("dashboard.intakes")}
          items={data.intakeForecast.map((item) => ({
            key: `${item.year}-${item.month}`,
            label: formatIntake(item, language),
            count: item.count,
          }))}
        />
      )}
    </Widget>
  )
}

export function CommissionWidget({ range }: DashboardWidgetProps) {
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <Widget
      range={range}
      title={t("dashboard.commission")}
      description={t("dashboard.commissionHint", { currency: "USD" })}
      isEmpty={(data) => data.commission.expected === 0}
    >
      {(data) => (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {t("commission.expected")}
            </dt>
            <dd
              className="font-medium tabular-nums"
              data-testid="commission-expected"
            >
              {formatMoney(data.commission.expected, data.currency, language)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {t("commission.received")}
            </dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(data.commission.received, data.currency, language)}
            </dd>
          </div>
        </dl>
      )}
    </Widget>
  )
}
