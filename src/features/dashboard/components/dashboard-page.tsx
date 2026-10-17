import { LayoutGridIcon } from "lucide-react"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getDashboardStats,
  getDashboardWidgets,
  type StatDef,
  type WidgetDef,
} from "@/engine/modules"
import { useSession } from "@/features/auth"
import { useRoleLabels, useWorkspace } from "@/features/workspace"
import { can, canReadField } from "@/lib/rbac"
import { cn } from "@/lib/utils"

import { resolveRange, type DashboardSearch } from "../lib/range"
import { useCoreWidgets } from "./core-widgets"
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
 * Workspace dashboard:
 * 1. the sector's KPI strip (module `dashboardStats`),
 * 2. today's work every workspace has (tasks, new form submissions),
 * 3. the sector's widgets (module `dashboardWidgets`).
 * Sector numbers follow one date range kept in the URL.
 */
export function DashboardPage({ search, onSearchChange }: DashboardPageProps) {
  const { t } = useTranslation("dashboard")
  const { user, role, subject } = useSession()
  const workspace = useWorkspace()
  const roles = useRoleLabels()
  const firstName = user.name.split(" ")[0] ?? user.name
  const visible = (item: Pick<StatDef, "permission" | "sensitivity">) =>
    (!item.permission ||
      can(subject, item.permission.action, item.permission.resource)) &&
    canReadField(subject, item.sensitivity)
  const stats = getDashboardStats(workspace.modules).filter(visible)
  const widgets = getDashboardWidgets(workspace.modules).filter(visible)
  const coreWidgets = useCoreWidgets()
  const range = resolveRange(search)
  const hasSector = stats.length > 0 || widgets.length > 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("greeting", { name: firstName })}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {t("description", { workspace: workspace.name })}
            {role ? (
              <Badge variant="secondary">{roles.label(role)}</Badge>
            ) : null}
          </span>
        }
        actions={
          hasSector ? (
            <DateRangeFilter
              search={search}
              range={range}
              onChange={onSearchChange}
            />
          ) : null
        }
      />

      {stats.length ? (
        <section aria-labelledby="dashboard-stats">
          <h2 id="dashboard-stats" className="sr-only">
            {t("statsTitle")}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(({ id, component: Stat }) => (
              <div key={id} className="min-w-0">
                <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                  <Stat range={range} />
                </Suspense>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="dashboard-today"
        className="flex flex-col gap-3"
      >
        <h2 id="dashboard-today" className="font-heading text-lg font-semibold">
          {t("todayTitle")}
        </h2>
        <div
          className={cn(
            "grid gap-4",
            coreWidgets.length > 1 && "lg:grid-cols-2"
          )}
        >
          {coreWidgets.map(({ id, component: Widget }) => (
            <div key={id} className="min-w-0">
              <Widget />
            </div>
          ))}
        </div>
      </section>

      {widgets.length ? (
        <section
          aria-labelledby="dashboard-widgets"
          className="flex flex-col gap-3"
        >
          <h2
            id="dashboard-widgets"
            className="font-heading text-lg font-semibold"
          >
            {t("widgetsTitle")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {widgets.map(({ id, size, component: Widget }) => (
              <div key={id} className={cn("min-w-0", SIZE_CLASSES[size])}>
                {/* Module widgets may be lazy (their chart library). */}
                <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                  <Widget range={range} />
                </Suspense>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasSector ? null : (
        <EmptyState
          icon={LayoutGridIcon}
          title={t("modules.empty")}
          description={t("modules.emptyHint")}
        />
      )}
    </div>
  )
}
