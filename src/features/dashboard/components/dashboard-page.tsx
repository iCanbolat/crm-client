import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getDashboardWidgets, type WidgetDef } from "@/engine/modules"
import { useSession } from "@/features/auth"
import { useActiveModules, useWorkspace } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { can } from "@/lib/rbac"
import { cn } from "@/lib/utils"

import { resolveRange, type DashboardSearch } from "../lib/range"
import { DateRangeFilter } from "./date-range-filter"

const SIZE_CLASSES: Record<WidgetDef["size"], string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  4: "md:col-span-2 xl:col-span-4",
}

interface DashboardPageProps {
  search: DashboardSearch
  onSearchChange: (search: Partial<DashboardSearch>) => void
}

/**
 * Workspace dashboard: widgets of the active modules (B3.7), all filtered by
 * one date range kept in the URL. Without module widgets the active module
 * cards stay as the landing page.
 */
export function DashboardPage({ search, onSearchChange }: DashboardPageProps) {
  const { t } = useTranslation(["dashboard", "workspace"])
  const language = getCurrentLanguage()
  const { user, role, subject } = useSession()
  const workspace = useWorkspace()
  const modules = useActiveModules()
  const firstName = user.name.split(" ")[0] ?? user.name
  const widgets = getDashboardWidgets(workspace.modules).filter(
    (widget) =>
      !widget.permission ||
      can(subject, widget.permission.action, widget.permission.resource)
  )
  const range = resolveRange(search)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("greeting", { name: firstName })}
        description={t("description", { workspace: workspace.name })}
        actions={
          role ? (
            <Badge variant="secondary">{t(`workspace:roles.${role}`)}</Badge>
          ) : null
        }
      />

      {widgets.length ? (
        <section
          aria-labelledby="dashboard-widgets"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2
              id="dashboard-widgets"
              className="font-heading text-lg font-semibold"
            >
              {t("widgetsTitle")}
            </h2>
            <DateRangeFilter
              search={search}
              range={range}
              onChange={onSearchChange}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {widgets.map(({ id, size, component: Widget }) => (
              <div key={id} className={cn("min-w-0", SIZE_CLASSES[size])}>
                <Widget range={range} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="dashboard-modules"
        className="flex flex-col gap-4"
      >
        <h2
          id="dashboard-modules"
          className="font-heading text-lg font-semibold"
        >
          {t("modules.title")}
        </h2>
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("modules.empty")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((manifest) => {
              const Icon = manifest.icon
              return (
                <Card key={manifest.id}>
                  <CardHeader className="flex flex-row items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <div className="flex flex-col gap-1">
                      <CardTitle>
                        <h3>{resolveI18nText(manifest.label, language)}</h3>
                      </CardTitle>
                      <CardDescription>
                        {resolveI18nText(manifest.description, language)}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {manifest.navigation?.map((item) => (
                      <Link
                        key={item.id}
                        to={item.to}
                        params={item.params}
                        search={item.search}
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm hover:bg-muted"
                      >
                        {resolveI18nText(item.label, language)}
                        <ArrowRightIcon className="size-3.5" aria-hidden />
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
