import { useQuery } from "@tanstack/react-query"
import {
  EyeIcon,
  HistoryIcon,
  RotateCcwIcon,
  RocketIcon,
  UndoDotIcon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { usePermission } from "@/features/auth"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import {
  useRestoreFormVersion,
  useUnpublishForm,
} from "../../api/forms.mutations"
import { formQueries } from "../../api/forms.queries"
import type { Form, FormVersionSummary } from "../../api/forms.schemas"
import { useBuilderStore } from "../../lib/builder-store"
import { FormStatusBadge } from "../form-status-badge"
import { PreviewDialog } from "../preview-dialog"
import { EmbedOptions } from "./embed-options"

function VersionPreview({
  formId,
  name,
  version,
  onClose,
}: {
  formId: string
  name: string
  version: number | null
  onClose: () => void
}) {
  const { data } = useQuery({
    ...formQueries.version(formId, version ?? 0),
    enabled: version !== null,
  })
  return (
    <PreviewDialog
      open={version !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      name={`${name} · v${version ?? ""}`}
      content={version !== null ? data?.content : undefined}
    />
  )
}

/** "Yayın" tab (B4.7): status, stats, embed code and version history. */
export function PublishPanel({
  form,
  onPublish,
}: {
  form: Form
  onPublish: () => void
}) {
  const { t } = useTranslation("forms")
  const language = getCurrentLanguage()
  const store = useBuilderStore()
  const canManage = usePermission("manage", "form")
  const { data: versions, isPending } = useQuery(formQueries.versions(form.id))
  const unpublish = useUnpublishForm(form.id)
  const restore = useRestoreFormVersion(form.id)
  const [previewing, setPreviewing] = useState<number | null>(null)
  const [restoring, setRestoring] = useState<FormVersionSummary | null>(null)
  const [unpublishing, setUnpublishing] = useState(false)
  const live = versions?.data.find((version) => version.isLive)

  const stats = [
    { id: "views", value: formatNumber(form.stats.views, language) },
    {
      id: "submissions",
      value: formatNumber(form.stats.submissions, language),
    },
    {
      id: "conversion",
      value: formatNumber(form.stats.conversionRate, language, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    },
  ] as const

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t("publishPanel.status")}
              <FormStatusBadge form={form} />
            </CardTitle>
            <CardDescription>
              {live
                ? t("publishPanel.live", {
                    version: live.version,
                    when: formatRelativeTime(live.publishedAt, language),
                    name: live.publishedByName ?? "",
                  })
                : t("publishPanel.notLive")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-3 gap-2">
              {stats.map((stat) => (
                <div key={stat.id} className="rounded-2xl bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">
                    {t(`columns.${stat.id}`)}
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={onPublish}>
                  <RocketIcon data-icon="inline-start" />
                  {form.status === "published" && form.hasUnpublishedChanges
                    ? t("publishPanel.republish")
                    : t("builder.publish")}
                </Button>
                {form.status === "published" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setUnpublishing(true)}
                  >
                    <UndoDotIcon data-icon="inline-start" />
                    {t("publishPanel.unpublish")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("embed.title")}</CardTitle>
            <CardDescription>{t("embed.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <EmbedOptions form={form} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("versions.title")}</CardTitle>
          <CardDescription>{t("versions.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <LoadingSkeleton variant="list" rows={3} />
          ) : !versions?.data.length ? (
            <EmptyState
              icon={HistoryIcon}
              title={t("versions.empty")}
              className="border-none"
            />
          ) : (
            <ol
              aria-label={t("versions.title")}
              className="flex flex-col gap-2"
            >
              {versions.data.map((version) => (
                <li
                  key={version.version}
                  aria-label={t("versions.item", { version: version.version })}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      v{version.version}
                      {version.isLive ? (
                        <Badge>{t("versions.live")}</Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <time dateTime={version.publishedAt}>
                        {formatRelativeTime(version.publishedAt, language)}
                      </time>
                      {version.publishedByName
                        ? ` · ${version.publishedByName}`
                        : null}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewing(version.version)}
                    >
                      <EyeIcon data-icon="inline-start" />
                      {t("versions.preview")}
                    </Button>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRestoring(version)}
                      >
                        <RotateCcwIcon data-icon="inline-start" />
                        {t("versions.restore")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <VersionPreview
        formId={form.id}
        name={form.name}
        version={previewing}
        onClose={() => setPreviewing(null)}
      />
      <ConfirmDialog
        open={!!restoring}
        onOpenChange={(open) => {
          if (!open) setRestoring(null)
        }}
        title={t("versions.restoreTitle", {
          version: restoring?.version ?? "",
        })}
        description={t("versions.restoreDescription")}
        confirmLabel={t("versions.restore")}
        isPending={restore.isPending}
        onConfirm={async () => {
          if (!restoring) return
          const restored = await restore.mutateAsync(restoring.version)
          // The editor shows the restored draft; history starts over.
          store.getState().replaceContent(restored.content)
          toast.success(t("toast.restored", { version: restoring.version }))
          setRestoring(null)
        }}
      />
      <ConfirmDialog
        open={unpublishing}
        onOpenChange={setUnpublishing}
        title={t("publishPanel.unpublishTitle")}
        description={t("publishPanel.unpublishDescription")}
        confirmLabel={t("publishPanel.unpublish")}
        variant="destructive"
        isPending={unpublish.isPending}
        onConfirm={async () => {
          await unpublish.mutateAsync()
          setUnpublishing(false)
        }}
      />
    </div>
  )
}
