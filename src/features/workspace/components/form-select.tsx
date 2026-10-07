import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface SelectOption {
  value: string
  label: string
}

interface FormSelectProps {
  id: string
  label: string
  items: SelectOption[]
  value: string | undefined
  onChange: (value: string) => void
  error?: { message?: string }
  placeholder?: string
  className?: string
}

/** Labelled Base UI select wired for react-hook-form controllers. */
export function FormSelect({
  id,
  label,
  items,
  value,
  onChange,
  error,
  placeholder,
  className,
}: FormSelectProps) {
  const errorId = `${id}-error`

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={value ?? null}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next)
        }}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={errorId} errors={[error]} />
    </Field>
  )
}
