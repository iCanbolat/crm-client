import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckIcon,
  CircleAlertIcon,
  CopyIcon,
  Loader2Icon,
  PlusIcon,
  RotateCwIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { ErrorState } from "@/components/common/error-state"
import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

import {
  useDeleteDomain,
  useMakeDomainPrimary,
  useVerifyDomain,
} from "../api/sites.mutations"
import { siteKeys } from "../api/sites.keys"
import { siteQueries } from "../api/sites.queries"
import {
  CNAME_TARGET,
  isDomainPending,
  type Domain,
  type DomainStatus,
} from "../api/sites.schemas"
import { AddDomainDialog } from "./add-domain-dialog"

const STEP_KEYS = ["dns", "verify", "ssl", "active"] as const
const STEP_INDEX: Record<DomainStatus, number> = {
  pending_dns: 0,
  verifying: 1,
  ssl_pending: 2,
  active: 3,
  failed: 1,
}

function StatusBadge({ status }: { status: DomainStatus }) {
  const { t } = useTranslation("sites")
  const pending = isDomainPending(status)
  return (
    <Badge
      variant={
        status === "active"
          ? "default"
          : status === "failed"
            ? "destructive"
            : "secondary"
      }
    >
      {pending ? (
        <Loader2Icon className="animate-spin" data-icon="inline-start" />
      ) : null}
      {t(`domains.status.${status}`)}
    </Badge>
  )
}

/** pending_dns → verifying → ssl_pending → active. */
function Steps({ status }: { status: DomainStatus }) {
  const { t } = useTranslation("sites")
  const current = STEP_INDEX[status]
  return (
    <ol
      aria-label={t("domains.steps")}
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
    >
      {STEP_KEYS.map((key, index) => {
        const done = status === "active" || index < current
        const failed = status === "failed" && index === current
        return (
          <li
            key={key}
            aria-current={index === current && !done ? "step" : undefined}
            className={cn(
              "flex items-center gap-1",
              done ? "text-foreground" : "text-muted-foreground",
              failed && "text-destructive"
            )}
          >
            {done ? (
              <CheckIcon className="size-3.5" aria-hidden />
            ) : failed ? (
              <CircleAlertIcon className="size-3.5" aria-hidden />
            ) : (
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
            )}
            {t(`domains.step.${key}`)}
          </li>
        )
      })}
    </ol>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation("sites")
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={copied ? t("domains.copied") : t("domains.copy", { label })}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(value)
          .then(() => setCopied(true))
          .catch(() => undefined)
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}

function DnsRecords({ domain }: { domain: Domain }) {
  const { t } = useTranslation("sites")
  const records = [
    { type: "CNAME", ...domain.dns.cname },
    { type: "TXT", ...domain.dns.txt },
  ]
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">{t("domains.dnsTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("domains.dnsDescription")}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t("domains.recordType")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("domains.recordName")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("domains.recordValue")}
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.type} className="border-t">
                <td className="px-3 py-2 font-mono">{record.type}</td>
                <td className="px-3 py-1">
                  <span className="flex items-center gap-1 font-mono break-all">
                    {record.name}
                    <CopyButton
                      value={record.name}
                      label={`${record.type} ${t("domains.recordName")}`}
                    />
                  </span>
                </td>
                <td className="px-3 py-1">
                  <span className="flex items-center gap-1 font-mono break-all">
                    {record.value}
                    <CopyButton
                      value={record.value}
                      label={`${record.type} ${t("domains.recordValue")}`}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DomainItem({
  domain,
  canUpdate,
}: {
  domain: Domain
  canUpdate: boolean
}) {
  const { t } = useTranslation("sites")
  const verify = useVerifyDomain()
  const primary = useMakeDomainPrimary()
  const remove = useDeleteDomain()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <li
      aria-label={domain.hostname}
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium break-all">
          {domain.hostname}
        </span>
        <StatusBadge status={domain.status} />
        {domain.isPrimary ? (
          <Badge variant="outline">
            <StarIcon data-icon="inline-start" />
            {t("domains.primary")}
          </Badge>
        ) : null}
        {canUpdate ? (
          <div
            role="group"
            aria-label={t("domains.actions", { hostname: domain.hostname })}
            className="ml-auto flex flex-wrap gap-2"
          >
            {domain.status === "active" && !domain.isPrimary ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={primary.isPending}
                onClick={() => primary.mutate(domain.id)}
              >
                {t("domains.makePrimary")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2Icon data-icon="inline-start" />
              {t("domains.remove")}
            </Button>
          </div>
        ) : null}
      </div>
      <Steps status={domain.status} />
      {domain.status === "failed" && domain.failureReason ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p>
            {t(`domains.failure.${domain.failureReason}`, {
              target: CNAME_TARGET,
            })}
          </p>
          {canUpdate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={verify.isPending}
              onClick={() => verify.mutate(domain.id)}
            >
              <RotateCwIcon data-icon="inline-start" />
              {t("domains.retry")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {domain.status !== "active" ? <DnsRecords domain={domain} /> : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="destructive"
        title={t("domains.removeTitle")}
        description={t("domains.removeDescription", {
          hostname: domain.hostname,
        })}
        confirmLabel={t("domains.remove")}
        isPending={remove.isPending}
        onConfirm={() => remove.mutateAsync(domain.id)}
      />
    </li>
  )
}

/** Custom domains of the site (B5.3). */
export function DomainsCard({ canUpdate }: { canUpdate: boolean }) {
  const { t } = useTranslation("sites")
  const queryClient = useQueryClient()
  const query = useQuery(siteQueries.domains())
  const [addOpen, setAddOpen] = useState(false)

  // A domain finishing verification (seen by polling) may become the site's
  // primary address: refresh the site so links and embed codes follow.
  const activeIds = (query.data ?? [])
    .filter((domain) => domain.status === "active")
    .map((domain) => domain.id)
    .join(",")
  const previousActive = useRef<string | null>(null)
  useEffect(() => {
    if (!query.data) return
    if (
      previousActive.current !== null &&
      previousActive.current !== activeIds
    ) {
      void queryClient.invalidateQueries({ queryKey: siteKeys.current() })
    }
    previousActive.current = activeIds
  }, [activeIds, query.data, queryClient])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("domains.title")}</h2>
        </CardTitle>
        <CardDescription>{t("domains.description")}</CardDescription>
        {canUpdate ? (
          <CardAction>
            <Button type="button" onClick={() => setAddOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t("domains.add")}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <LoadingSkeleton variant="list" />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : query.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("domains.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {query.data.map((domain) => (
              <DomainItem
                key={domain.id}
                domain={domain}
                canUpdate={canUpdate}
              />
            ))}
          </ul>
        )}
      </CardContent>
      <AddDomainDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => void query.refetch()}
      />
    </Card>
  )
}
