import { PlusIcon, XIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { SortableList } from "@/components/common/sortable-list"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFieldType } from "@/engine/field-types"
import {
  getField,
  label,
  type ListLayout,
  type ObjectDef,
} from "@/engine/metadata"
import { useUpdateObject } from "@/features/records"
import { getCurrentLanguage } from "@/lib/i18n"

import { SaveBar } from "./save-bar"

/** Default list columns, their order and the default sort (B2.7). */
export function ColumnsPanel({ objectDef }: { objectDef: ObjectDef }) {
  const { t } = useTranslation(["settings", "common"])
  const id = useId()
  const language = getCurrentLanguage()
  const mutation = useUpdateObject(objectDef.key)
  const [draft, setDraft] = useState<ListLayout>(objectDef.layouts.list)
  const dirty = JSON.stringify(draft) !== JSON.stringify(objectDef.layouts.list)
  const fieldName = (key: string) => {
    const field = getField(objectDef, key)
    return field ? label(field.label, language) : key
  }
  const hidden = objectDef.fields.filter(
    (field) => !draft.columns.includes(field.key)
  )
  const sortable = objectDef.fields.filter(
    (field) => getFieldType(field.type).sortable
  )

  return (
    <section aria-labelledby="columns-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="columns-title" className="font-heading text-lg font-semibold">
          {t("columns.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("columns.description")}
        </p>
      </div>

      <SortableList
        label={t("columns.visible")}
        items={draft.columns}
        getId={(key) => key}
        getLabel={fieldName}
        onReorder={(columns) =>
          setDraft((current) => ({ ...current, columns }))
        }
        renderItem={(key) => (
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {fieldName(key)}
            </span>
            {key === objectDef.primaryField ? null : (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("columns.remove", { label: fieldName(key) })}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    columns: current.columns.filter((item) => item !== key),
                  }))
                }
              >
                <XIcon />
              </Button>
            )}
          </div>
        )}
      />

      {hidden.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("columns.hidden")}</h3>
          <ul className="flex flex-wrap gap-2">
            {hidden.map((field) => (
              <li key={field.key}>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t("columns.add", {
                    label: label(field.label, language),
                  })}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      columns: [...current.columns, field.key],
                    }))
                  }
                >
                  <PlusIcon data-icon="inline-start" />
                  {label(field.label, language)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-sort-field`}>
            {t("columns.sortField")}
          </FieldLabel>
          <Select
            items={[
              { value: null, label: t("columns.noSort") },
              ...sortable.map((field) => ({
                value: field.key,
                label: label(field.label, language),
              })),
            ]}
            value={draft.defaultSort?.field ?? null}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                defaultSort:
                  typeof value === "string"
                    ? {
                        field: value,
                        direction: current.defaultSort?.direction ?? "desc",
                      }
                    : undefined,
              }))
            }
          >
            <SelectTrigger id={`${id}-sort-field`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>{t("columns.noSort")}</SelectItem>
              {sortable.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {label(field.label, language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-sort-direction`}>
            {t("columns.sortDirection")}
          </FieldLabel>
          <Select
            items={[
              { value: "asc", label: t("columns.asc") },
              { value: "desc", label: t("columns.desc") },
            ]}
            value={draft.defaultSort?.direction ?? "desc"}
            disabled={!draft.defaultSort}
            onValueChange={(value) =>
              setDraft((current) =>
                current.defaultSort && (value === "asc" || value === "desc")
                  ? {
                      ...current,
                      defaultSort: { ...current.defaultSort, direction: value },
                    }
                  : current
              )
            }
          >
            <SelectTrigger id={`${id}-sort-direction`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t("columns.asc")}</SelectItem>
              <SelectItem value="desc">{t("columns.desc")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <SaveBar
        dirty={dirty}
        pending={mutation.isPending}
        onReset={() => setDraft(objectDef.layouts.list)}
        onSave={() =>
          mutation.mutate({
            layouts: { list: draft, detail: objectDef.layouts.detail },
          })
        }
      />
    </section>
  )
}
