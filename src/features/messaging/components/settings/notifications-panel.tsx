import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColorBadge } from "@/engine/field-types"
import { getMessageTriggers } from "@/engine/modules"
import { usePermission } from "@/features/auth"
import { useWorkspace } from "@/features/workspace"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { useUpdateTriggers } from "../../api/messaging.mutations"
import { messagingQueries } from "../../api/messaging.queries"
import { isApproved } from "../../lib/templates"

function DispatchLog() {
  const { t } = useTranslation("messaging")
  const language = getCurrentLanguage()
  const workspace = useWorkspace()
  const triggers = getMessageTriggers(workspace.modules)
  const { data: dispatches = [] } = useQuery(messagingQueries.dispatches())

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("notifications.logTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("notifications.logDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {dispatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("notifications.logEmpty")}
          </p>
        ) : (
          <div className="relative overflow-x-auto">
            <Table aria-label={t("notifications.logTitle")}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("notifications.columns.time")}</TableHead>
                  <TableHead>{t("notifications.columns.trigger")}</TableHead>
                  <TableHead>{t("notifications.columns.record")}</TableHead>
                  <TableHead>{t("notifications.columns.result")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.map((dispatch) => {
                  const trigger = triggers.find(
                    (item) => item.id === dispatch.triggerId
                  )
                  return (
                    <TableRow key={dispatch.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(dispatch.createdAt, language, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        {trigger
                          ? resolveI18nText(trigger.label, language)
                          : dispatch.triggerId}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/o/$objectKey/$recordId"
                          params={{
                            objectKey: dispatch.record.objectKey,
                            recordId: dispatch.record.recordId,
                          }}
                          className="underline-offset-4 hover:underline"
                        >
                          {dispatch.record.label}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <ColorBadge
                            color={
                              dispatch.status === "sent" ? "green" : "gray"
                            }
                          >
                            {t(`notifications.${dispatch.status}`)}
                          </ColorBadge>
                          {dispatch.reason ? (
                            <span className="text-xs text-muted-foreground">
                              {t(`notifications.reasons.${dispatch.reason}`)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Automatic notifications tab (B6.5): module triggers + delivery log. */
export function NotificationsPanel({ connected }: { connected: boolean }) {
  const { t } = useTranslation("messaging")
  const language = getCurrentLanguage()
  const workspace = useWorkspace()
  const { data: channel } = useSuspenseQuery(messagingQueries.channel())
  const { data: templates } = useSuspenseQuery(messagingQueries.templates())
  const canManage = usePermission("manage", "channel")
  const update = useUpdateTriggers()
  const triggers = getMessageTriggers(workspace.modules)
  const templateLanguage = workspace.language === "en" ? "en" : "tr"

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("notifications.title")}</h2>
          </CardTitle>
          <CardDescription>{t("notifications.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!connected ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("notifications.notConnected")}
            </p>
          ) : null}
          {triggers.length === 0 ? (
            <EmptyState title={t("templates.empty")} />
          ) : (
            <ul className="flex flex-col divide-y">
              {triggers.map((trigger) => {
                const template = templates.find(
                  (item) => item.id === trigger.templateId
                )
                const triggerLabel = resolveI18nText(trigger.label, language)
                const approved =
                  !!template && isApproved(template, templateLanguage)
                return (
                  <li
                    key={trigger.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {triggerLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("notifications.template", {
                          name: template
                            ? resolveI18nText(template.label, language)
                            : trigger.templateId,
                        })}
                        {connected && !approved
                          ? ` · ${t("notifications.templatePending")}`
                          : ""}
                      </span>
                    </div>
                    <Switch
                      aria-label={t("notifications.toggle", {
                        label: triggerLabel,
                      })}
                      checked={!!channel.triggers[trigger.id]}
                      disabled={!canManage || !connected}
                      onCheckedChange={(checked) =>
                        update.mutate({ [trigger.id]: checked })
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <DispatchLog />
    </div>
  )
}
