import { useSuspenseQuery } from "@tanstack/react-query"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getFieldType } from "@/engine/field-types"
import {
  getRecordTitle,
  label,
  ObjectIcon,
  pickFields,
  type CrmRecord,
  type ObjectDef,
} from "@/engine/metadata"
import { getSlotDefs, ModuleSlot } from "@/engine/modules"
import { isFieldVisible } from "@/engine/records"
import { usePermission } from "@/features/auth"
import { useWorkspace } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"

import { useDeleteRecord } from "../api/records.mutations"
import { recordQueries } from "../api/records.queries"
import { InlineField } from "./inline-field"
import { RecordFiles } from "./record-files"
import { RecordFormSheet } from "./record-form-sheet"
import { RelatedList } from "./related-list"
import { StageStepper } from "./stage-stepper"

export const RECORD_TABS = ["details", "timeline", "files"] as const
export type RecordTab = (typeof RECORD_TABS)[number]

interface RecordDetailPageProps {
  objectDef: ObjectDef
  recordId: string
  tab: RecordTab
  onTabChange: (tab: RecordTab) => void
  /** Activity timeline (provided by the activities feature). */
  timeline: ReactNode
  /** Extra header actions (e.g. "Convert" of a lead). */
  actions?: (record: CrmRecord) => ReactNode
  onDeleted: () => void
}

/** Generic record page: `/o/$objectKey/$recordId` (B2.3). */
export function RecordDetailPage({
  objectDef,
  recordId,
  tab,
  onTabChange,
  timeline,
  actions,
  onDeleted,
}: RecordDetailPageProps) {
  const { t } = useTranslation(["records", "common"])
  const language = getCurrentLanguage()
  const workspace = useWorkspace()
  const { data: record } = useSuspenseQuery(
    recordQueries.detail(objectDef.key, recordId)
  )
  const target = { ownerId: record.values.ownerId as string | undefined }
  const canEdit = usePermission("update", "record", target)
  const canDelete = usePermission("delete", "record", target)
  const deleteMutation = useDeleteRecord(objectDef.key)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const title = getRecordTitle(objectDef, record)
  const highlights = pickFields(objectDef, objectDef.layouts.detail.highlights)
  const hasAside =
    objectDef.layouts.detail.related.length > 0 ||
    getSlotDefs(`${objectDef.key}.detail.sidebar`, workspace.modules).length > 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ObjectIcon name={objectDef.icon} className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                {label(objectDef.label, language)}
              </p>
              <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
                {title}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions?.(record)}
            {canEdit ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <PencilIcon data-icon="inline-start" />
                {t("common:actions.edit")}
              </Button>
            ) : null}
            {canDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("common:actions.moreActions")}
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2Icon aria-hidden />
                    {t("detail.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        {highlights.length ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {highlights.map((field) => {
              const Cell = getFieldType(field.type).Cell
              return (
                <div key={field.key} className="flex flex-col gap-0.5 text-sm">
                  <dt className="text-xs text-muted-foreground">
                    {label(field.label, language)}
                  </dt>
                  <dd>
                    <Cell
                      field={field}
                      value={record.values[field.key]}
                      refValue={record.refs[field.key]}
                    />
                  </dd>
                </div>
              )
            })}
          </dl>
        ) : null}

        <StageStepper objectDef={objectDef} record={record} canEdit={canEdit} />
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as RecordTab)}
      >
        <TabsList>
          <TabsTrigger value="details">{t("detail.tabs.details")}</TabsTrigger>
          <TabsTrigger value="timeline">
            {t("detail.tabs.timeline")}
          </TabsTrigger>
          <TabsTrigger value="files">{t("detail.tabs.files")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <div
            className={
              hasAside
                ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
                : "mx-auto grid w-full max-w-3xl gap-6"
            }
          >
            <div className="flex min-w-0 flex-col gap-6">
              <ModuleSlot
                name={`${objectDef.key}.detail.main`}
                activeModuleIds={workspace.modules}
                objectDef={objectDef}
                record={record}
              />
              {objectDef.layouts.detail.sections.map((section) => {
                // Conditional fields (B3.3) only while their condition holds;
                // empty server-maintained values say nothing.
                const fields = pickFields(objectDef, section.fields).filter(
                  (field) =>
                    isFieldVisible(objectDef, field, record.values) &&
                    !(
                      field.readOnly &&
                      getFieldType(field.type).isEmpty(record.values[field.key])
                    )
                )
                if (fields.length === 0) return null
                const headingId = `section-${section.key}`
                return (
                  <Card key={section.key} size="sm">
                    <CardHeader>
                      <CardTitle>
                        <h2 id={headingId}>{label(section.label, language)}</h2>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl
                        aria-labelledby={headingId}
                        className="flex flex-col divide-y"
                      >
                        {fields.map((field) => (
                          <InlineField
                            key={field.key}
                            objectDef={objectDef}
                            record={record}
                            field={field}
                            canEdit={canEdit}
                          />
                        ))}
                      </dl>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            {hasAside ? (
              <aside
                aria-label={t("detail.related")}
                className="flex min-w-0 flex-col gap-4"
              >
                <ModuleSlot
                  name={`${objectDef.key}.detail.sidebar`}
                  activeModuleIds={workspace.modules}
                  objectDef={objectDef}
                  record={record}
                />
                {objectDef.layouts.detail.related.map((related) => (
                  <RelatedList
                    key={`${related.objectKey}:${related.field}`}
                    parentDef={objectDef}
                    parent={record}
                    related={related}
                  />
                ))}
              </aside>
            ) : null}
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="pt-4">
          {timeline}
        </TabsContent>
        <TabsContent value="files" className="pt-4">
          <RecordFiles
            objectKey={objectDef.key}
            recordId={record.id}
            categories={objectDef.fileCategories}
          />
        </TabsContent>
      </Tabs>

      <RecordFormSheet
        objectDef={objectDef}
        record={record}
        open={editing}
        onOpenChange={setEditing}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("detail.deleteTitle")}
        description={t("detail.deleteDescription", { title })}
        confirmLabel={t("common:actions.delete")}
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(record.id)
          onDeleted()
        }}
      />
    </div>
  )
}
