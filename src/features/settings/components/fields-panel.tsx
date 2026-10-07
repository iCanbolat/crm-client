import { LockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { label, type FieldDef, type ObjectDef } from "@/engine/metadata"
import { useDeleteField } from "@/features/records"
import { getCurrentLanguage } from "@/lib/i18n"

import { FieldDialog } from "./field-dialog"
import { FieldTypeLabel } from "./field-type-label"

/** Field list of an object: add custom fields, edit, delete (B2.7). */
export function FieldsPanel({ objectDef }: { objectDef: ObjectDef }) {
  const { t } = useTranslation(["settings", "common"])
  const language = getCurrentLanguage()
  const deleteField = useDeleteField(objectDef.key)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<FieldDef | null>(null)
  const [deleting, setDeleting] = useState<FieldDef | null>(null)

  return (
    <section aria-labelledby="fields-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="fields-title" className="font-heading text-lg font-semibold">
            {t("fields.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("fields.description")}
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <PlusIcon data-icon="inline-start" />
          {t("fields.add")}
        </Button>
      </div>

      <div className="relative overflow-x-auto rounded-3xl border">
        <table aria-labelledby="fields-title" className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-left">
              <th scope="col" className="h-11 px-3 font-medium">
                {t("fields.columns.label")}
              </th>
              <th scope="col" className="px-3 font-medium">
                {t("fields.columns.key")}
              </th>
              <th scope="col" className="px-3 font-medium">
                {t("fields.columns.type")}
              </th>
              <th scope="col" className="px-3 font-medium">
                {t("fields.columns.attributes")}
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                <span className="sr-only">{t("fields.columns.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {objectDef.fields.map((field) => {
              const name = label(field.label, language)
              const deletable =
                !field.system && field.key !== objectDef.primaryField
              return (
                <tr key={field.key} className="border-b">
                  <th scope="row" className="px-3 py-2.5 text-left font-medium">
                    {name}
                  </th>
                  <td className="px-3 py-2.5 font-mono text-xs">{field.key}</td>
                  <td className="px-3 py-2.5">
                    <FieldTypeLabel type={field.type} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {field.system ? (
                        <Badge variant="secondary">
                          {t("fields.badges.system")}
                        </Badge>
                      ) : null}
                      {field.custom ? (
                        <Badge variant="outline">
                          {t("fields.badges.custom")}
                        </Badge>
                      ) : null}
                      {field.required ? (
                        <Badge variant="outline">
                          {t("fields.badges.required")}
                        </Badge>
                      ) : null}
                      {field.readOnly ? (
                        <Badge variant="outline">
                          {t("fields.badges.readOnly")}
                        </Badge>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("fields.edit", { label: name })}
                        onClick={() => setEditing(field)}
                      >
                        <PencilIcon />
                      </Button>
                      {deletable ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("fields.delete", { label: name })}
                          onClick={() => setDeleting(field)}
                        >
                          <Trash2Icon />
                        </Button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-disabled
                                aria-label={t("fields.systemLocked", {
                                  label: name,
                                })}
                                className="opacity-50"
                              />
                            }
                          >
                            <LockIcon />
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("fields.systemHint")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <FieldDialog
        objectDef={objectDef}
        open={adding}
        onOpenChange={setAdding}
      />
      <FieldDialog
        objectDef={objectDef}
        field={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t("fields.deleteTitle")}
        description={
          deleting
            ? t("fields.deleteDescription", {
                label: label(deleting.label, language),
              })
            : undefined
        }
        confirmLabel={t("common:actions.delete")}
        variant="destructive"
        isPending={deleteField.isPending}
        onConfirm={() =>
          deleting ? deleteField.mutateAsync(deleting.key) : undefined
        }
      />
    </section>
  )
}
