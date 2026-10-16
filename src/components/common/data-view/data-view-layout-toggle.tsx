import { LayoutGridIcon, TableIcon, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export interface DataViewLayoutOption {
  value: string
  label: string
  icon: LucideIcon
}

interface DataViewLayoutToggleProps {
  value: string
  onValueChange: (value: string) => void
  /** Page specific layouts after table and grid (e.g. kanban). */
  extraLayouts?: readonly DataViewLayoutOption[]
  /** Hides the table option (the container is too narrow for it). */
  hideTable?: boolean
}

export function DataViewLayoutToggle({
  value,
  onValueChange,
  extraLayouts = [],
  hideTable = false,
}: DataViewLayoutToggleProps) {
  const { t } = useTranslation()
  const options: DataViewLayoutOption[] = [
    ...(hideTable
      ? []
      : [
          {
            value: "table",
            label: t("dataTable.layout.table"),
            icon: TableIcon,
          },
        ]),
    { value: "grid", label: t("dataTable.layout.grid"), icon: LayoutGridIcon },
    ...extraLayouts,
  ]
  if (options.length < 2) return null

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={t("dataTable.layout.label")}
      value={[value]}
      onValueChange={(next) => {
        const [layout] = next as string[]
        if (layout) onValueChange(layout)
      }}
    >
      {options.map(({ value: option, label, icon: Icon }) => (
        <ToggleGroupItem key={option} value={option} aria-label={label}>
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
