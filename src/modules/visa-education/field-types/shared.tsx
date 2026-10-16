import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface PickerItem {
  value: string
  label: string
}

/** Small labelled select used inside the composite inputs. */
export function Picker({
  items,
  value,
  onChange,
  label,
  className,
  invalid,
  disabled,
  id,
  describedBy,
}: {
  items: PickerItem[]
  value: string | null
  onChange: (value: string | null) => void
  label: string
  className?: string
  invalid?: boolean
  disabled?: boolean
  id?: string
  describedBy?: string
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => onChange(typeof next === "string" ? next : null)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={className}
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function parseNumber(raw: string) {
  if (raw.trim() === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
