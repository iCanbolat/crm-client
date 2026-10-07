import { FilterIcon, PlusIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useFieldServices } from "@/engine/field-types"
import type { Condition } from "@/engine/logic"
import type { ObjectDef } from "@/engine/metadata"
import { getCurrentLanguage } from "@/lib/i18n"

import { describeCondition } from "../lib/conditions"
import { FilterEditor } from "./filter-editor"

interface FilterBarProps {
  objectDef: ObjectDef
  filters: Condition[]
  onChange: (filters: Condition[]) => void
}

function FilterChip({
  objectDef,
  condition,
  onChange,
  onRemove,
}: {
  objectDef: ObjectDef
  condition: Condition
  onChange: (condition: Condition) => void
  onRemove: () => void
}) {
  const { t } = useTranslation("records")
  const services = useFieldServices()
  const [open, setOpen] = useState(false)
  const text = describeCondition(
    objectDef,
    condition,
    getCurrentLanguage(),
    services
  )

  return (
    <li className="flex items-center rounded-full border bg-background text-sm">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="max-w-72 truncate rounded-l-full py-1 pr-1 pl-3 hover:bg-muted"
              aria-label={t("filters.edit", { filter: text })}
            />
          }
        >
          {text}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <PopoverTitle className="text-sm">
            {t("filters.editTitle")}
          </PopoverTitle>
          <FilterEditor
            objectDef={objectDef}
            initial={condition}
            onApply={(next) => {
              onChange(next)
              setOpen(false)
            }}
            onCancel={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon-xs"
        className="mr-1"
        aria-label={t("filters.remove", { filter: text })}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </li>
  )
}

/** Active filter chips + "Add filter". The state lives in the URL. */
export function FilterBar({ objectDef, filters, onChange }: FilterBarProps) {
  const { t } = useTranslation("records")
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.length ? (
        <ul aria-label={t("filters.active")} className="flex flex-wrap gap-2">
          {filters.map((condition, index) => (
            <FilterChip
              key={`${condition.field}-${index}`}
              objectDef={objectDef}
              condition={condition}
              onChange={(next) =>
                onChange(filters.map((item, i) => (i === index ? next : item)))
              }
              onRemove={() => onChange(filters.filter((_, i) => i !== index))}
            />
          ))}
        </ul>
      ) : null}
      <Popover open={adding} onOpenChange={setAdding}>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          {filters.length ? (
            <PlusIcon data-icon="inline-start" />
          ) : (
            <FilterIcon data-icon="inline-start" />
          )}
          {t("filters.add")}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <PopoverTitle className="text-sm">
            {t("filters.addTitle")}
          </PopoverTitle>
          <FilterEditor
            objectDef={objectDef}
            onApply={(condition) => {
              onChange([...filters, condition])
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        </PopoverContent>
      </Popover>
      {filters.length ? (
        <Button variant="ghost" size="sm" onClick={() => onChange([])}>
          {t("filters.clear")}
        </Button>
      ) : null}
    </div>
  )
}
