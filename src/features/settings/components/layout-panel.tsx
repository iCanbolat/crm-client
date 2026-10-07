import { PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { SortableList } from "@/components/common/sortable-list"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getField,
  label,
  type DetailLayout,
  type ObjectDef,
} from "@/engine/metadata"
import { useUpdateObject } from "@/features/records"
import { getCurrentLanguage } from "@/lib/i18n"

import { uniqueKey } from "../lib/drafts"
import { FieldTypeLabel } from "./field-type-label"
import { SaveBar } from "./save-bar"

const MAX_HIGHLIGHTS = 4

/** Detail page layout: sections, field order, header highlights (B2.7). */
export function LayoutPanel({ objectDef }: { objectDef: ObjectDef }) {
  const { t } = useTranslation(["settings", "common"])
  const language = getCurrentLanguage()
  const mutation = useUpdateObject(objectDef.key)
  const [draft, setDraft] = useState<DetailLayout>(objectDef.layouts.detail)
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(objectDef.layouts.detail)

  const placed = new Set(draft.sections.flatMap((section) => section.fields))
  const unplaced = objectDef.fields.filter((field) => !placed.has(field.key))
  const fieldName = (key: string) => {
    const field = getField(objectDef, key)
    return field ? label(field.label, language) : key
  }

  const updateSection = (
    index: number,
    patch: Partial<DetailLayout["sections"][number]>
  ) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section
      ),
    }))

  const moveField = (key: string, toSection: string) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.key === toSection
          ? {
              ...section,
              fields: [...section.fields.filter((item) => item !== key), key],
            }
          : {
              ...section,
              fields: section.fields.filter((item) => item !== key),
            }
      ),
    }))

  const removeField = (key: string) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        fields: section.fields.filter((item) => item !== key),
      })),
    }))

  const addSection = () =>
    setDraft((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          key: uniqueKey(
            t("layout.newSection"),
            current.sections.map((section) => section.key),
            "section"
          ),
          label: { tr: t("layout.newSection"), en: t("layout.newSection") },
          fields: [],
        },
      ],
    }))

  const toggleHighlight = (key: string, checked: boolean) =>
    setDraft((current) => ({
      ...current,
      highlights: checked
        ? [...current.highlights, key]
        : current.highlights.filter((item) => item !== key),
    }))

  return (
    <section aria-labelledby="layout-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="layout-title" className="font-heading text-lg font-semibold">
          {t("layout.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("layout.description")}
        </p>
      </div>

      {draft.sections.map((section, index) => {
        const sectionName =
          label(section.label, language) || t("layout.untitled")
        return (
          <Card key={section.key} size="sm">
            <CardHeader>
              <CardTitle>
                <h3>{sectionName}</h3>
              </CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={section.fields.length > 0}
                  aria-label={t("layout.deleteSection", { label: sectionName })}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      sections: current.sections.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2Icon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label={t("layout.sectionLabelTr", {
                    label: sectionName,
                  })}
                  value={section.label.tr}
                  onChange={(event) =>
                    updateSection(index, {
                      label: { ...section.label, tr: event.target.value },
                    })
                  }
                />
                <Input
                  aria-label={t("layout.sectionLabelEn", {
                    label: sectionName,
                  })}
                  value={section.label.en}
                  onChange={(event) =>
                    updateSection(index, {
                      label: { ...section.label, en: event.target.value },
                    })
                  }
                />
              </div>
              {section.fields.length ? (
                <SortableList
                  label={t("layout.sectionFields", { label: sectionName })}
                  items={section.fields}
                  getId={(key) => key}
                  getLabel={fieldName}
                  onReorder={(fields) => updateSection(index, { fields })}
                  renderItem={(key) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {fieldName(key)}
                      </span>
                      <FieldTypeLabel
                        type={getField(objectDef, key)?.type ?? "unknown"}
                      />
                      {draft.sections.length > 1 ? (
                        <Select
                          items={draft.sections.map((item) => ({
                            value: item.key,
                            label: label(item.label, language),
                          }))}
                          value={section.key}
                          onValueChange={(value) => {
                            if (typeof value === "string") moveField(key, value)
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-40"
                            aria-label={t("layout.moveToSection", {
                              label: fieldName(key),
                            })}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {draft.sections.map((item) => (
                              <SelectItem key={item.key} value={item.key}>
                                {label(item.label, language)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("layout.removeField", {
                          label: fieldName(key),
                        })}
                        onClick={() => removeField(key)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  )}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("layout.emptySection")}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}

      <Button variant="outline" className="w-fit" onClick={addSection}>
        <PlusIcon data-icon="inline-start" />
        {t("layout.addSection")}
      </Button>

      {unplaced.length ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              <h3>{t("layout.hiddenFields")}</h3>
            </CardTitle>
            <CardDescription>{t("layout.hiddenDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {unplaced.map((field) => (
                <li key={field.key}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={draft.sections.length === 0}
                    onClick={() => moveField(field.key, draft.sections[0]!.key)}
                    aria-label={t("layout.addField", {
                      label: label(field.label, language),
                    })}
                  >
                    <PlusIcon data-icon="inline-start" />
                    {label(field.label, language)}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h3 id="highlights-title">{t("layout.highlights")}</h3>
          </CardTitle>
          <CardDescription>
            {t("layout.highlightsDescription", { max: MAX_HIGHLIGHTS })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset
            aria-labelledby="highlights-title"
            className="grid gap-2 sm:grid-cols-3"
          >
            {objectDef.fields.map((field) => {
              const checked = draft.highlights.includes(field.key)
              const inputId = `highlight-${field.key}`
              return (
                <div key={field.key} className="flex items-center gap-2">
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    disabled={
                      !checked && draft.highlights.length >= MAX_HIGHLIGHTS
                    }
                    onCheckedChange={(next) => toggleHighlight(field.key, next)}
                  />
                  <Label htmlFor={inputId} className="font-normal">
                    {label(field.label, language)}
                  </Label>
                </div>
              )
            })}
          </fieldset>
        </CardContent>
      </Card>

      <SaveBar
        dirty={dirty}
        pending={mutation.isPending}
        onReset={() => setDraft(objectDef.layouts.detail)}
        onSave={() =>
          mutation.mutate({
            layouts: { list: objectDef.layouts.list, detail: draft },
          })
        }
      />
    </section>
  )
}
