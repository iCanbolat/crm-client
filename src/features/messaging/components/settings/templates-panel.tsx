import { useSuspenseQuery } from "@tanstack/react-query"
import { LockIcon, RefreshCwIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TEMPLATE_LANGUAGES, type TemplateLanguage } from "@/engine/messaging"
import { label, type ObjectDef } from "@/engine/metadata"
import { ColorBadge } from "@/engine/field-types"
import { usePermission } from "@/features/auth"
import { useObjectDefs } from "@/features/records"
import { useActiveModules } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { useSyncTemplates } from "../../api/messaging.mutations"
import { messagingQueries } from "../../api/messaging.queries"
import type { MessageTemplate } from "../../api/messaging.schemas"
import {
  renderExample,
  sourceFieldLabel,
  STATUS_COLORS,
  submissionState,
} from "../../lib/templates"
import { TemplateBubble } from "../shared/template-bubble"

function TemplateCard({
  template,
  objectDef,
}: {
  template: MessageTemplate
  objectDef: ObjectDef | undefined
}) {
  const { t } = useTranslation("messaging")
  const language = getCurrentLanguage()
  const previewLanguage: TemplateLanguage = language === "en" ? "en" : "tr"
  const preview = renderExample(template, previewLanguage)
  const headingId = `template-${template.id}`

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3 id={headingId}>{resolveI18nText(template.label, language)}</h3>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <code className="font-mono text-xs">{template.name}</code>
          <span>
            {t("templates.object", {
              object: objectDef
                ? label(objectDef.label, language)
                : template.objectKey,
            })}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-wrap gap-2" aria-label={t("title")}>
          {TEMPLATE_LANGUAGES.map((item) => {
            const state = submissionState(template, item)
            const submission = template.submissions.find(
              (entry) => entry.language === item
            )
            return (
              <li key={item} className="flex flex-col gap-1">
                <ColorBadge color={STATUS_COLORS[state]}>
                  {t("templates.statusLabel", {
                    language: t(`templates.languages.${item}`),
                    status: t(`templates.statuses.${state}`),
                  })}
                </ColorBadge>
                {submission?.rejectionReason ? (
                  <span className="text-xs text-destructive">
                    {t("templates.rejection", {
                      reason: t(
                        `templates.rejections.${submission.rejectionReason}`,
                        { defaultValue: submission.rejectionReason }
                      ),
                    })}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>

        <figure className="flex flex-col gap-2">
          <figcaption className="text-xs text-muted-foreground">
            {t("templates.preview", {
              language: t(`templates.languages.${previewLanguage}`),
            })}
          </figcaption>
          <TemplateBubble {...preview} />
        </figure>

        <section aria-label={t("templates.variables")}>
          <h4 className="mb-1.5 text-xs font-medium">
            {t("templates.variables")}
          </h4>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            {template.variables.map((variable, index) => (
              <div key={index} className="contents">
                <dt className="font-mono">{`{{${index + 1}}}`}</dt>
                <dd>
                  {variable.source.kind === "field"
                    ? t("templates.sources.field", {
                        field: sourceFieldLabel(
                          variable.source,
                          objectDef,
                          language
                        ),
                      })
                    : t(`templates.sources.${variable.source.kind}`)}
                  <span className="text-muted-foreground">
                    {` · ${variable.example[previewLanguage]}`}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </CardContent>
    </Card>
  )
}

/** Templates tab (B6.2): read-only, managed per sector. */
export function TemplatesPanel({ connected }: { connected: boolean }) {
  const { t } = useTranslation("messaging")
  const language = getCurrentLanguage()
  const { data: templates } = useSuspenseQuery(messagingQueries.templates())
  const objectDefs = useObjectDefs()
  const modules = useActiveModules()
  const canManage = usePermission("manage", "channel")
  const sync = useSyncTemplates()
  const moduleNames = modules
    .map((manifest) => resolveI18nText(manifest.label, language))
    .join(", ")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-start">
        <LockIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-medium">{t("templates.managedTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("templates.managedDescription", { modules: moduleNames })}
          </p>
          {!connected ? (
            <p className="text-sm text-muted-foreground">
              {t("templates.notConnected")}
            </p>
          ) : null}
        </div>
        {canManage && connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            <RefreshCwIcon data-icon="inline-start" aria-hidden />
            {t("templates.sync")}
          </Button>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState title={t("templates.empty")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              objectDef={objectDefs.find(
                (def) => def.key === template.objectKey
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
