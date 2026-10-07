import { Link } from "@tanstack/react-router"
import { ChevronRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { label, ObjectIcon } from "@/engine/metadata"
import { useObjectDefs } from "@/features/records"
import { getCurrentLanguage } from "@/lib/i18n"

/** Settings → Objects: every object of the workspace (B2.7). */
export function ObjectsListPage() {
  const { t } = useTranslation("settings")
  const language = getCurrentLanguage()
  const objects = useObjectDefs()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("objects.title")}
        description={t("objects.description")}
      />
      <ul
        aria-label={t("objects.title")}
        className="divide-y rounded-3xl border"
      >
        {objects.map((objectDef) => {
          const custom = objectDef.fields.filter((field) => field.custom).length
          return (
            <li key={objectDef.key}>
              <Link
                to="/settings/objects/$objectKey"
                params={{ objectKey: objectDef.key }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ObjectIcon name={objectDef.icon} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {label(objectDef.pluralLabel, language)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("objects.fieldCount", {
                      count: objectDef.fields.length,
                    })}{" "}
                    · {t("objects.customCount", { count: custom })}
                  </span>
                </span>
                {objectDef.pipeline ? (
                  <Badge variant="secondary">{t("objects.hasPipeline")}</Badge>
                ) : null}
                <ChevronRightIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
