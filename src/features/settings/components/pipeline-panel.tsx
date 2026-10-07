import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { SortableList } from "@/components/common/sortable-list"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ColorBadge } from "@/engine/field-types"
import {
  getEditableFields,
  label,
  OPTION_COLORS,
  STAGE_KINDS,
  type ObjectDef,
  type OptionColor,
  type PipelineDef,
  type StageDef,
  type StageKind,
} from "@/engine/metadata"
import { useUpdateObject } from "@/features/records"
import { getCurrentLanguage } from "@/lib/i18n"

import { newDraftId, uniqueKey } from "../lib/drafts"
import { SaveBar } from "./save-bar"

interface StageDraft extends Omit<StageDef, "key"> {
  id: string
  /** `null` for stages added in this session (generated on save). */
  key: string | null
}

const toDrafts = (pipeline: PipelineDef): StageDraft[] =>
  pipeline.stages.map((stage) => ({ ...stage, id: newDraftId() }))

export function toPipeline(
  pipeline: PipelineDef,
  drafts: StageDraft[]
): PipelineDef {
  const taken = new Set(
    drafts.flatMap((draft) => (draft.key ? [draft.key] : []))
  )
  return {
    ...pipeline,
    stages: drafts.map(({ id: _id, key, requiredFields, ...stage }) => {
      const stageKey = key ?? uniqueKey(stage.label.tr, taken, "stage")
      taken.add(stageKey)
      return {
        ...stage,
        ...(requiredFields?.length ? { requiredFields } : {}),
        key: stageKey,
        label: {
          tr: stage.label.tr.trim(),
          en: stage.label.en.trim() || stage.label.tr.trim(),
        },
      }
    }),
  }
}

/** Pipeline stages: order, names, outcome, color and stage gates (B2.7). */
export function PipelinePanel({
  objectDef,
  pipeline,
}: {
  objectDef: ObjectDef
  pipeline: PipelineDef
}) {
  const { t } = useTranslation(["settings", "common"])
  const language = getCurrentLanguage()
  const mutation = useUpdateObject(objectDef.key)
  const [drafts, setDrafts] = useState(() => toDrafts(pipeline))
  const [showErrors, setShowErrors] = useState(false)
  const next = toPipeline(pipeline, drafts)
  const dirty = JSON.stringify(next) !== JSON.stringify(pipeline)
  const invalid = drafts.some((draft) => !draft.label.tr.trim())
  const gateFields = getEditableFields(objectDef).filter(
    (field) => field.key !== pipeline.field
  )

  const update = (id: string, patch: Partial<StageDraft>) =>
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
    )

  return (
    <section aria-labelledby="pipeline-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="pipeline-title" className="font-heading text-lg font-semibold">
          {t("pipeline.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("pipeline.description")}
        </p>
      </div>

      <SortableList
        label={t("pipeline.stages")}
        items={drafts}
        getId={(draft) => draft.id}
        getLabel={(draft) => draft.label.tr || t("pipeline.untitled")}
        onReorder={setDrafts}
        renderItem={(draft, index) => {
          const name = draft.label.tr || t("pipeline.untitled")
          const required = draft.requiredFields ?? []
          return (
            <div className="grid gap-2 lg:grid-cols-[1fr_1fr_8rem_7rem_auto_auto] lg:items-center">
              <Input
                aria-label={t("pipeline.labelTr", { index: index + 1 })}
                aria-invalid={
                  showErrors && !draft.label.tr.trim() ? true : undefined
                }
                value={draft.label.tr}
                onChange={(event) =>
                  update(draft.id, {
                    label: { ...draft.label, tr: event.target.value },
                  })
                }
              />
              <Input
                aria-label={t("pipeline.labelEn", { index: index + 1 })}
                value={draft.label.en}
                onChange={(event) =>
                  update(draft.id, {
                    label: { ...draft.label, en: event.target.value },
                  })
                }
              />
              <Select
                items={STAGE_KINDS.map((kind) => ({
                  value: kind,
                  label: t(`pipeline.kinds.${kind}`),
                }))}
                value={draft.kind}
                onValueChange={(value) =>
                  update(draft.id, { kind: value as StageKind })
                }
              >
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label={t("pipeline.kind", { label: name })}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(`pipeline.kinds.${kind}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={OPTION_COLORS.map((color) => ({
                  value: color,
                  label: t(`colors.${color}`),
                }))}
                value={draft.color ?? "gray"}
                onValueChange={(value) =>
                  update(draft.id, { color: value as OptionColor })
                }
              >
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label={t("pipeline.color", { label: name })}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPTION_COLORS.map((color) => (
                    <SelectItem key={color} value={color}>
                      <ColorBadge color={color}>
                        {t(`colors.${color}`)}
                      </ColorBadge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={t("pipeline.gate", { label: name })}
                    />
                  }
                >
                  {t("pipeline.gateCount", { count: required.length })}
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      {t("pipeline.gateTitle")}
                    </DropdownMenuLabel>
                    {gateFields.map((field) => (
                      <DropdownMenuCheckboxItem
                        key={field.key}
                        checked={required.includes(field.key)}
                        onCheckedChange={(checked) =>
                          update(draft.id, {
                            requiredFields: checked
                              ? [...required, field.key]
                              : required.filter((item) => item !== field.key),
                          })
                        }
                      >
                        {label(field.label, language)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={drafts.length <= 1}
                aria-label={t("pipeline.delete", { label: name })}
                onClick={() =>
                  setDrafts((current) =>
                    current.filter((item) => item.id !== draft.id)
                  )
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          )
        }}
      />

      <Button
        variant="outline"
        className="w-fit"
        onClick={() =>
          setDrafts((current) => [
            ...current,
            {
              id: newDraftId(),
              key: null,
              label: { tr: "", en: "" },
              kind: "open",
              color: "gray",
            },
          ])
        }
      >
        <PlusIcon data-icon="inline-start" />
        {t("pipeline.add")}
      </Button>

      {showErrors && invalid ? (
        <p role="alert" className="text-sm text-destructive">
          {t("pipeline.labelRequired")}
        </p>
      ) : null}

      <SaveBar
        dirty={dirty}
        pending={mutation.isPending}
        onReset={() => {
          setDrafts(toDrafts(pipeline))
          setShowErrors(false)
        }}
        onSave={() => {
          setShowErrors(true)
          if (!invalid) mutation.mutate({ pipeline: next })
        }}
      />
    </section>
  )
}
