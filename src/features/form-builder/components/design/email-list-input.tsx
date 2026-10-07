import { PlusIcon, XIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const emailSchema = z.email()

/** Notification recipients: add with Enter / button, remove per chip. */
export function EmailListInput({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  const { t } = useTranslation("forms")
  const id = useId()
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  function add() {
    const email = draft.trim().toLowerCase()
    if (!email) return
    if (!emailSchema.safeParse(email).success) {
      setError(t("design.emails.invalid"))
      return
    }
    if (value.includes(email)) {
      setError(t("design.emails.duplicate"))
      return
    }
    setError(null)
    setDraft("")
    onChange([...value, email])
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          type="email"
          value={draft}
          placeholder="satis@firma.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <PlusIcon data-icon="inline-start" />
          {t("design.emails.add")}
        </Button>
      </div>
      <FieldDescription id={`${id}-help`}>{description}</FieldDescription>
      {error ? (
        <FieldError id={`${id}-error`} errors={[{ message: error }]} />
      ) : null}
      {value.length ? (
        <ul aria-label={label} className="flex flex-wrap gap-1.5">
          {value.map((email) => (
            <li key={email}>
              <Badge variant="secondary" className="h-6 gap-1 pr-1">
                {email}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  aria-label={t("design.emails.remove", { email })}
                  onClick={() =>
                    onChange(value.filter((item) => item !== email))
                  }
                >
                  <XIcon className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </Field>
  )
}
