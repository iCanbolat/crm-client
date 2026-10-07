import { PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { SortableList } from "@/components/common/sortable-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ColorBadge } from "@/engine/field-types"
import { OPTION_COLORS, type OptionColor } from "@/engine/metadata"

import { newDraftId, type OptionDraft } from "../lib/drafts"

interface OptionsEditorProps {
  id: string
  options: OptionDraft[]
  onChange: (options: OptionDraft[]) => void
  invalid?: boolean
  describedBy?: string
}

/** Picklist values: label (TR/EN), badge color, order. */
export function OptionsEditor({
  id,
  options,
  onChange,
  invalid,
  describedBy,
}: OptionsEditorProps) {
  const { t } = useTranslation("settings")
  const update = (draftId: string, patch: Partial<OptionDraft>) =>
    onChange(
      options.map((item) =>
        item.id === draftId ? { ...item, ...patch } : item
      )
    )

  return (
    <div className="flex flex-col gap-2">
      <SortableList
        label={t("options.label")}
        items={options}
        getId={(item) => item.id}
        getLabel={(item) => item.labelTr || t("options.untitled")}
        onReorder={onChange}
        renderItem={(item, index) => (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-center">
            <Input
              id={index === 0 ? id : undefined}
              aria-label={t("options.labelTr", { index: index + 1 })}
              aria-invalid={invalid && !item.labelTr.trim() ? true : undefined}
              aria-describedby={describedBy}
              placeholder={t("options.placeholderTr")}
              value={item.labelTr}
              onChange={(event) =>
                update(item.id, { labelTr: event.target.value })
              }
            />
            <Input
              aria-label={t("options.labelEn", { index: index + 1 })}
              placeholder={t("options.placeholderEn")}
              value={item.labelEn}
              onChange={(event) =>
                update(item.id, { labelEn: event.target.value })
              }
            />
            <Select
              items={OPTION_COLORS.map((color) => ({
                value: color,
                label: t(`colors.${color}`),
              }))}
              value={item.color ?? "gray"}
              onValueChange={(value) =>
                update(item.id, { color: (value as OptionColor) ?? undefined })
              }
            >
              <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={t("options.color", { index: index + 1 })}
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("options.remove", {
                label: item.labelTr || index + 1,
              })}
              onClick={() =>
                onChange(options.filter((entry) => entry.id !== item.id))
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() =>
          onChange([
            ...options,
            {
              id: newDraftId(),
              value: null,
              labelTr: "",
              labelEn: "",
              color: undefined,
            },
          ])
        }
      >
        <PlusIcon data-icon="inline-start" />
        {t("options.add")}
      </Button>
    </div>
  )
}
