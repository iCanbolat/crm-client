import { useId } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DashboardRange } from "@/engine/modules"

import {
  RANGE_PRESETS,
  type DashboardSearch,
  type RangePreset,
} from "../lib/range"

interface DateRangeFilterProps {
  search: DashboardSearch
  range: DashboardRange
  onChange: (search: Partial<DashboardSearch>) => void
}

/** One filter row above the widgets: preset or custom from/to. */
export function DateRangeFilter({
  search,
  range,
  onChange,
}: DateRangeFilterProps) {
  const { t } = useTranslation("dashboard")
  const id = useId()
  const items = RANGE_PRESETS.map((preset) => ({
    value: preset,
    label: t(`range.${preset}`),
  }))

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        items={items}
        value={search.range}
        onValueChange={(value) => {
          const preset = value as RangePreset
          onChange(
            preset === "custom"
              ? { range: preset, from: range.from, to: range.to }
              : { range: preset, from: undefined, to: undefined }
          )
        }}
      >
        <SelectTrigger aria-label={t("range.label")} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {search.range === "custom" ? (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-from`} className="text-xs">
              {t("range.from")}
            </Label>
            <Input
              id={`${id}-from`}
              type="date"
              className="w-40"
              value={range.from}
              max={range.to}
              onChange={(event) =>
                event.target.value && onChange({ from: event.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-to`} className="text-xs">
              {t("range.to")}
            </Label>
            <Input
              id={`${id}-to`}
              type="date"
              className="w-40"
              value={range.to}
              min={range.from}
              onChange={(event) =>
                event.target.value && onChange({ to: event.target.value })
              }
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
