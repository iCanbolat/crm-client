import { useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ColorBadge } from "@/engine/field-types"
import { usePermission } from "@/features/auth"
import { getCurrentLanguage } from "@/lib/i18n"
import { formatDate } from "@/lib/format"

import { useDisconnectChannel } from "../../api/messaging.mutations"
import { messagingQueries } from "../../api/messaging.queries"
import type { WhatsappConnection } from "../../api/messaging.schemas"
import { CopyButton } from "../shared/copy-button"
import { ConnectionForm } from "./connection-form"

const QUALITY_COLORS = {
  GREEN: "green",
  YELLOW: "amber",
  RED: "red",
  UNKNOWN: "gray",
} as const

function ConnectionDetails({ connection }: { connection: WhatsappConnection }) {
  const { t } = useTranslation("messaging")
  const language = getCurrentLanguage()
  const rows = [
    { label: t("connection.number"), value: connection.displayPhoneNumber },
    { label: t("connection.verifiedName"), value: connection.verifiedName },
    {
      label: t("connection.quality"),
      value: (
        <ColorBadge color={QUALITY_COLORS[connection.qualityRating]}>
          {t(`connection.qualities.${connection.qualityRating}`)}
        </ColorBadge>
      ),
    },
    {
      label: t("connection.tier"),
      value: t(`connection.tiers.${connection.messagingLimitTier}`),
    },
    { label: t("connection.wabaId"), value: connection.wabaId },
    { label: t("connection.phoneNumberId"), value: connection.phoneNumberId },
    {
      label: t("connection.token"),
      value: t("connection.tokenValue", {
        last4: connection.tokenLast4,
        date: formatDate(connection.tokenUpdatedAt, language),
      }),
    },
    {
      label: t("connection.connectedAt"),
      value: formatDate(connection.connectedAt, language),
    },
  ]
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className="truncate text-sm font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Connection tab (B6.1): status, credentials and webhook details. */
export function ConnectionPanel() {
  const { t } = useTranslation("messaging")
  const { data: channel } = useSuspenseQuery(messagingQueries.channel())
  const canManage = usePermission("manage", "channel")
  const disconnect = useDisconnectChannel()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { connection } = channel

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("connection.title")}</h2>
          </CardTitle>
          <CardDescription>{t("connection.intro")}</CardDescription>
          <CardAction>
            <ColorBadge color={connection ? "green" : "gray"}>
              {connection
                ? t("connection.connected")
                : t("connection.notConnected")}
            </ColorBadge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {connection ? <ConnectionDetails connection={connection} /> : null}

          {!connection && canManage ? (
            <section aria-labelledby="wa-steps" className="flex flex-col gap-2">
              <h3 id="wa-steps" className="text-sm font-medium">
                {t("connection.steps.title")}
              </h3>
              <ol className="ms-5 list-decimal space-y-1 text-sm text-muted-foreground">
                <li>{t("connection.steps.app")}</li>
                <li>{t("connection.steps.systemUser")}</li>
                <li>{t("connection.steps.ids")}</li>
                <li>{t("connection.steps.webhook")}</li>
              </ol>
            </section>
          ) : null}

          {canManage && (!connection || editing) ? (
            <ConnectionForm
              connection={connection}
              onDone={() => setEditing(false)}
              onCancel={connection ? () => setEditing(false) : undefined}
            />
          ) : null}

          {canManage && connection && !editing ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t("connection.edit")}
              </Button>
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                {t("connection.disconnect")}
              </Button>
            </div>
          ) : null}
          {!canManage ? (
            <p className="text-sm text-muted-foreground">
              {t("settings.readOnly")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("webhook.title")}</h2>
          </CardTitle>
          <CardDescription>{t("webhook.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3">
            {[
              { label: t("webhook.url"), value: channel.webhook.url },
              ...(canManage
                ? [
                    {
                      label: t("webhook.verifyToken"),
                      value: channel.webhook.verifyToken,
                    },
                  ]
                : []),
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="flex min-w-0 items-center gap-1 rounded-lg bg-muted px-3 py-1.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                    {row.value}
                  </code>
                  <CopyButton value={row.value} label={row.label} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("webhook.fields")}
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("connection.disconnectTitle")}
        description={t("connection.disconnectDescription")}
        confirmLabel={t("connection.disconnect")}
        variant="destructive"
        isPending={disconnect.isPending}
        onConfirm={() => disconnect.mutateAsync()}
      />
    </div>
  )
}
