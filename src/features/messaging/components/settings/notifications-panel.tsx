import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  DataTableColumnHeader,
  useDataTable,
} from "@/components/common/data-table"
import { DataView } from "@/components/common/data-view"
import { EmptyState } from "@/components/common/empty-state"
import { SearchInput } from "@/components/common/search-input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ColorBadge } from "@/engine/field-types"
import { getMessageTriggers } from "@/engine/modules"
import { usePermission } from "@/features/auth"
import { useWorkspace } from "@/features/workspace"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { useUpdateTriggers } from "../../api/messaging.mutations"
import { messagingQueries } from "../../api/messaging.queries"
import type { Dispatch } from "../../api/messaging.schemas"
import { isApproved } from "../../lib/templates"

function DispatchLog() {
  const { t } = useTranslation(["messaging", "common"])
  const language = getCurrentLanguage()
  const workspace = useWorkspace()
  const triggers = getMessageTriggers(workspace.modules)
  const { data: dispatches = [] } = useQuery(messagingQueries.dispatches())
  const triggerLabel = (id: string) => {
    const trigger = triggers.find((item) => item.id === id)
    return trigger ? resolveI18nText(trigger.label, language) : id
  }

  const columns = useMemo<ColumnDef<Dispatch, string>[]>(
    () => [
      {
        id: "time",
        accessorFn: (dispatch) => dispatch.createdAt,
        enableHiding: false,
        meta: { label: t("notifications.columns.time") },
        header: ({ table, column }) => (
          <DataTableColumnHeader
            table={table}
            column={column}
            title={t("notifications.columns.time")}
          />
        ),
        cell: ({ row }) =>
          formatDate(row.original.createdAt, language, {
            dateStyle: "short",
            timeStyle: "short",
          }),
      },
      {
        id: "trigger",
        accessorFn: (dispatch) => triggerLabel(dispatch.triggerId),
        meta: { label: t("notifications.columns.trigger") },
        header: ({ table, column }) => (
          <DataTableColumnHeader
            table={table}
            column={column}
            title={t("notifications.columns.trigger")}
          />
        ),
      },
      {
        id: "record",
        accessorFn: (dispatch) => dispatch.record.label,
        meta: { label: t("notifications.columns.record") },
        header: ({ table, column }) => (
          <DataTableColumnHeader
            table={table}
            column={column}
            title={t("notifications.columns.record")}
          />
        ),
        cell: ({ row: { original: dispatch } }) => (
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
        ),
      },
      {
        id: "result",
        accessorFn: (dispatch) => t(`notifications.${dispatch.status}`),
        meta: { label: t("notifications.columns.result") },
        header: t("notifications.columns.result"),
        enableSorting: false,
        cell: ({ row: { original: dispatch } }) => (
          <div className="flex flex-col gap-0.5">
            <ColorBadge color={dispatch.status === "sent" ? "green" : "gray"}>
              {t(`notifications.${dispatch.status}`)}
            </ColorBadge>
            {dispatch.reason ? (
              <span className="text-xs text-muted-foreground">
                {t(`notifications.reasons.${dispatch.reason}`)}
              </span>
            ) : null}
          </div>
        ),
      },
    ],
    // `triggerLabel` only depends on the workspace modules and language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, language, workspace.modules]
  )

  const table = useDataTable({
    data: dispatches,
    columns,
    getRowId: (dispatch) => dispatch.id,
    mode: "client",
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: "time", desc: true }],
    },
  })

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
          <DataView
            table={table}
            label={t("notifications.logTitle")}
            viewKey="messaging:dispatches"
            card={{ title: "record", subtitle: "time", badge: "result" }}
            pageSizeOptions={[10, 20, 50]}
            emptyState={
              <p className="text-sm text-muted-foreground">
                {t("common:dataTable.noResults")}
              </p>
            }
            toolbar={{
              search: (
                <SearchInput
                  value=""
                  placeholder={t("common:dataTable.search")}
                  onChange={(q) => table.setGlobalFilter(q ?? "")}
                />
              ),
            }}
          />
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
