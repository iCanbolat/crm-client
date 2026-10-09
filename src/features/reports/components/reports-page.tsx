import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useWorkspace } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { getAvailableReports } from "../lib/reports"

/** Ready-made reports of the workspace (B7.1). */
export function ReportsPage() {
  const { t } = useTranslation("reports")
  const language = getCurrentLanguage()
  const workspace = useWorkspace()
  const reports = getAvailableReports(workspace.modules)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon
          const name = resolveI18nText(report.label, language)
          return (
            <li key={report.key}>
              <Link
                to="/reports/$reportKey"
                params={{ reportKey: report.key }}
                aria-label={t("open", { name })}
                className="group block h-full rounded-4xl focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
              >
                <Card className="h-full transition-colors group-hover:bg-muted/50">
                  <CardHeader className="flex flex-row items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <CardTitle>
                        <h2>{name}</h2>
                      </CardTitle>
                      <CardDescription>
                        {resolveI18nText(report.description, language)}
                      </CardDescription>
                    </div>
                    <ArrowRightIcon
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </CardHeader>
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
