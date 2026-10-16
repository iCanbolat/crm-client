import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { getFieldType, type FieldInputProps } from "@/engine/field-types"

import { type PassportValue } from "../lib/passport"

// Inputs of ./passport, loaded on first render (lazyFieldInput).

export function PassportInput(props: FieldInputProps<PassportValue>) {
  const { t } = useTranslation("visaFields")
  const CountryInput = getFieldType("country").Input
  const current: Partial<PassportValue> =
    props.value && typeof props.value === "object" ? props.value : {}
  const update = (next: Partial<PassportValue>) => {
    const value = { ...current, ...next }
    const empty = !value.number && !value.expiresAt && !value.issuedAt
    props.onChange(empty ? null : (value as PassportValue))
  }
  const invalid = props.invalid ? true : undefined

  return (
    <div
      className="grid gap-2 sm:grid-cols-2"
      role="group"
      aria-labelledby={props.labelId}
      aria-label={props.labelId ? undefined : props.ariaLabel}
    >
      <Input
        id={props.id}
        autoFocus={props.autoFocus}
        aria-label={t("passport.number")}
        placeholder={t("passport.number")}
        aria-invalid={invalid}
        aria-describedby={props.describedBy}
        disabled={props.disabled}
        onBlur={props.onBlur}
        autoComplete="off"
        value={current.number ?? ""}
        onChange={(event) =>
          update({ number: event.target.value.trim().toUpperCase() })
        }
      />
      <CountryInput
        id={`${props.id}-country`}
        field={{
          key: "issuingCountry",
          label: { tr: "Veren ülke", en: "Issuing country" },
          type: "country",
        }}
        ariaLabel={t("passport.issuingCountry")}
        value={current.issuingCountry ?? null}
        onChange={(issuingCountry) =>
          update({ issuingCountry: issuingCountry ?? "" })
        }
        invalid={props.invalid}
        disabled={props.disabled}
      />
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t("passport.issuedAt")}
        <Input
          type="date"
          aria-invalid={invalid}
          disabled={props.disabled}
          value={current.issuedAt ?? ""}
          onChange={(event) => update({ issuedAt: event.target.value || null })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t("passport.expiresAt")}
        <Input
          type="date"
          aria-invalid={invalid}
          aria-describedby={props.describedBy}
          disabled={props.disabled}
          value={current.expiresAt ?? ""}
          onChange={(event) => update({ expiresAt: event.target.value })}
        />
      </label>
    </div>
  )
}
