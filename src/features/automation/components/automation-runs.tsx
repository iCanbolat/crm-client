import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"

import { automationQueries } from "../api/automation.queries"
import type { ActionResult } from "../api/automation.schemas"
import { RunStatusBadge } from "./run-status-badge"

/** Run history of a rule: result per record and per action (B7.3). */
export function AutomationRuns({ ruleId }: { ruleId: string }) {
  const { t, i18n } = useTranslation("automation")
  const query = useQuery(automationQueries.runs(ruleId))
  const reason = (code: string | null) =>
    code ? t(`runs.reasons.${code}` as "runs.reasons.conditions") : ""
  const actionText = (result: ActionResult) => {
    const type = t(`actions.types.${result.type}` as "actions.types.notify")
    const status = t(`runs.actionStatuses.${result.status}`)
    const detail = result.detail ?? reason(result.code)
    return `${type}: ${status}${detail ? ` — ${detail}` : ""}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("runs.title")}</h2>
        </CardTitle>
        <CardDescription>{t("runs.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : query.data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("runs.empty")}</p>
        ) : (
          <Table aria-label={t("runs.title")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("runs.columns.time")}</TableHead>
                <TableHead>{t("runs.columns.record")}</TableHead>
                <TableHead>{t("runs.columns.status")}</TableHead>
                <TableHead>{t("runs.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(run.createdAt, i18n.language, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>
                    {run.record ? (
                      <Link
                        to="/o/$objectKey/$recordId"
                        params={{
                          objectKey: run.record.objectKey,
                          recordId: run.record.recordId,
                        }}
                        className="hover:underline"
                      >
                        {run.record.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {run.reason ? (
                      reason(run.reason)
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {run.actions.map((result, index) => (
                          <li key={index}>{actionText(result)}</li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
