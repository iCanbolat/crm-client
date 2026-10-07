import { Link } from "@tanstack/react-router"
import { ExternalLinkIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { label, type ObjectDef } from "@/engine/metadata"
import { getCurrentLanguage } from "@/lib/i18n"

import { ColumnsPanel } from "./columns-panel"
import { FieldsPanel } from "./fields-panel"
import { LayoutPanel } from "./layout-panel"
import { PipelinePanel } from "./pipeline-panel"

export const OBJECT_SETTINGS_TABS = [
  "fields",
  "layout",
  "columns",
  "pipeline",
] as const
export type ObjectSettingsTab = (typeof OBJECT_SETTINGS_TABS)[number]

interface ObjectSettingsPageProps {
  objectDef: ObjectDef
  tab: ObjectSettingsTab
  onTabChange: (tab: ObjectSettingsTab) => void
}

/** Settings of one object: fields, detail layout, list columns, pipeline. */
export function ObjectSettingsPage({
  objectDef,
  tab,
  onTabChange,
}: ObjectSettingsPageProps) {
  const { t } = useTranslation("settings")
  const language = getCurrentLanguage()
  const pipeline = objectDef.pipeline
  const current = tab === "pipeline" && !pipeline ? "fields" : tab

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={label(objectDef.pluralLabel, language)}
        description={t("object.description")}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link to="/o/$objectKey" params={{ objectKey: objectDef.key }} />
            }
          >
            <ExternalLinkIcon data-icon="inline-start" />
            {t("object.openList")}
          </Button>
        }
      />
      <Tabs
        value={current}
        onValueChange={(value) => onTabChange(value as ObjectSettingsTab)}
      >
        <TabsList>
          <TabsTrigger value="fields">{t("object.tabs.fields")}</TabsTrigger>
          <TabsTrigger value="layout">{t("object.tabs.layout")}</TabsTrigger>
          <TabsTrigger value="columns">{t("object.tabs.columns")}</TabsTrigger>
          {pipeline ? (
            <TabsTrigger value="pipeline">
              {t("object.tabs.pipeline")}
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="fields" className="pt-4">
          <FieldsPanel objectDef={objectDef} />
        </TabsContent>
        <TabsContent value="layout" className="pt-4">
          {/* Remount on server changes, so a stale draft never overwrites them. */}
          <LayoutPanel
            key={JSON.stringify(objectDef.layouts.detail)}
            objectDef={objectDef}
          />
        </TabsContent>
        <TabsContent value="columns" className="pt-4">
          <ColumnsPanel
            key={JSON.stringify(objectDef.layouts.list)}
            objectDef={objectDef}
          />
        </TabsContent>
        {pipeline ? (
          <TabsContent value="pipeline" className="pt-4">
            <PipelinePanel
              key={JSON.stringify(pipeline)}
              objectDef={objectDef}
              pipeline={pipeline}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
