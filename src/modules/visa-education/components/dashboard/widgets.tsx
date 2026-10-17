import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { BarList, DashboardWidget } from "@/components/common/dashboard"
import type { DashboardWidgetProps } from "@/engine/modules"
import { useOptionalObjectDef } from "@/features/records"
import { formatMoney } from "@/lib/currencies"
import { formatDate } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import { visaEducationDashboardQuery } from "../../api/dashboard.queries"
import { formatIntake } from "../../lib/intake"

function useLanguage() {
  const { i18n } = useTranslation()
  return i18n.language === "en" ? "en" : "tr"
}

function useStageLabels(objectKey: string) {
  const def = useOptionalObjectDef(objectKey)
  const language = useLanguage()
  return (stage: string) => {
    const found = def?.pipeline?.stages.find((item) => item.key === stage)
    return found ? resolveI18nText(found.label, language) : stage
  }
}

export function EnrollmentStagesWidget({ range }: DashboardWidgetProps) {
  const query = useQuery(visaEducationDashboardQuery(range))
  const { t } = useTranslation("visaEducation")
  const label = useStageLabels("enrollment")
  return (
    <DashboardWidget
      query={query}
      title={t("dashboard.enrollments")}
      description={t("dashboard.createdInRange")}
      isEmpty={(data) => data.enrollmentsByStage.every((item) => !item.count)}
    >
      {(data) => (
        <BarList
          label={t("dashboard.enrollments")}
          items={data.enrollmentsByStage.map((item) => ({
            key: item.stage,
            label: label(item.stage),
            count: item.count,
          }))}
        />
      )}
    </DashboardWidget>
  )
}

export function VisaStagesWidget({ range }: DashboardWidgetProps) {
  const query = useQuery(visaEducationDashboardQuery(range))
  const { t } = useTranslation("visaEducation")
  const label = useStageLabels("visaApplication")
  return (
    <DashboardWidget
      query={query}
      title={t("dashboard.visas")}
      description={t("dashboard.createdInRange")}
      isEmpty={(data) => data.visasByStage.every((item) => !item.count)}
    >
      {(data) => (
        <BarList
          label={t("dashboard.visas")}
          items={data.visasByStage.map((item) => ({
            key: item.stage,
            label: label(item.stage),
            count: item.count,
          }))}
        />
      )}
    </DashboardWidget>
  )
}

export function UpcomingAppointmentsWidget({ range }: DashboardWidgetProps) {
  const query = useQuery(visaEducationDashboardQuery(range))
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <DashboardWidget
      query={query}
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
    </DashboardWidget>
  )
}

export function MissingDocumentsWidget({ range }: DashboardWidgetProps) {
  const query = useQuery(visaEducationDashboardQuery(range))
  const { t } = useTranslation("visaEducation")
  return (
    <DashboardWidget
      query={query}
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
    </DashboardWidget>
  )
}

export function OverdueInstallmentsWidget({ range }: DashboardWidgetProps) {
  const query = useQuery(visaEducationDashboardQuery(range))
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <DashboardWidget
      query={query}
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
    </DashboardWidget>
  )
}

export function IntakeForecastWidget({ range }: DashboardWidgetProps) {
  const query = useQuery(visaEducationDashboardQuery(range))
  const { t } = useTranslation("visaEducation")
  const language = useLanguage()
  return (
    <DashboardWidget
      query={query}
      title={t("dashboard.intakes")}
      description={t("dashboard.intakesHint")}
      isEmpty={(data) => data.intakeForecast.length === 0}
    >
      {(data) => (
        <BarList
          label={t("dashboard.intakes")}
          items={data.intakeForecast.map((item) => ({
            key: `${item.year}-${item.month}`,
            label: formatIntake(item, language),
            count: item.count,
          }))}
        />
      )}
    </DashboardWidget>
  )
}
