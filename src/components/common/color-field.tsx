import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/** Native color picker + hex input (`#rrggbb`). */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [source, setSource] = useState(value)
  if (source !== value) {
    setSource(value)
    setDraft(value)
  }
  const invalid = !HEX_COLOR_PATTERN.test(draft)

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          aria-label={t("colorPicker", { label })}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-xl border bg-transparent p-1"
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          id={id}
          value={draft}
          spellCheck={false}
          maxLength={7}
          aria-invalid={invalid || undefined}
          className="font-mono uppercase"
          onChange={(event) => {
            const next = event.target.value.trim()
            setDraft(next)
            if (HEX_COLOR_PATTERN.test(next)) {
              setSource(next.toLowerCase())
              onChange(next.toLowerCase())
            }
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
    </Field>
  )
}
