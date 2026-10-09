import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { PlusIcon, WorkflowIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useSession } from "@/features/auth"
import { getErrorMessage } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { can } from "@/lib/rbac"

import { useToggleAutomationMutation } from "../api/automation.mutations"
import { automationQueries } from "../api/automation.queries"
import type { AutomationRule } from "../api/automation.schemas"
import { useAutomationLabels } from "../hooks/use-automation-labels"
import { describeAction, describeTrigger } from "../lib/describe"
import { RunStatusBadge } from "./run-status-badge"

/** Settings → Automations (B7.3): rules with their switch and last run. */
export function AutomationsPage() {
  const { t } = useTranslation("automation")
  const { subject } = useSession()
  const { data } = useSuspenseQuery(automationQueries.list())
  const canManage = can(subject, "manage", "automation")

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canManage ? (
            <Button
              nativeButton={false}
              render={<Link to="/settings/automations/new" />}
            >
              <PlusIcon aria-hidden />
              {t("new")}
            </Button>
          ) : null
        }
      />
      {canManage ? null : (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
      {data.data.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.data.map((rule) => (
            <RuleCard key={rule.id} rule={rule} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RuleCard({
  rule,
  canManage,
}: {
  rule: AutomationRule
  canManage: boolean
}) {
  const { t, i18n } = useTranslation("automation")
  const { labels } = useAutomationLabels()
  const toggle = useToggleAutomationMutation()

  return (
    <li>
      <Card size="sm">
        <CardContent className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/settings/automations/$ruleId"
                params={{ ruleId: rule.id }}
                aria-label={t("open", { name: rule.name })}
                className="font-heading font-semibold hover:underline"
              >
                {rule.name}
              </Link>
              <Badge variant={rule.enabled ? "secondary" : "outline"}>
                {rule.enabled ? t("enabled") : t("disabled")}
              </Badge>
            </div>
            <p className="text-sm">
              {describeTrigger(rule.trigger, t, labels)}
            </p>
            <ul className="flex flex-col text-sm text-muted-foreground">
              {rule.actions.map((action, index) => (
                <li key={index}>→ {describeAction(action, t, labels)}</li>
              ))}
            </ul>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {rule.lastRun ? (
                <>
                  <RunStatusBadge status={rule.lastRun.status} />
                  {t("lastRun", {
                    time: formatRelativeTime(
                      rule.lastRun.createdAt,
                      i18n.language
                    ),
                  })}
                  {" · "}
                  {t("runCount", { count: rule.runCount })}
                </>
              ) : (
                t("never")
              )}
            </p>
          </div>
          <Switch
            aria-label={t("toggle", { name: rule.name })}
            checked={rule.enabled}
            disabled={!canManage}
            onCheckedChange={(enabled) =>
              toggle.mutate(
                { id: rule.id, enabled },
                {
                  onSuccess: () =>
                    toast.success(
                      t("toggled", {
                        state: enabled ? t("toggledOn") : t("toggledOff"),
                      })
                    ),
                  onError: (error) => toast.error(getErrorMessage(error)),
                }
              )
            }
          />
        </CardContent>
      </Card>
    </li>
  )
}
