import { TriangleAlertIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supportedLanguages, type Language } from "@/lib/i18n"
import type { I18nText } from "@/lib/i18n-text"

interface I18nTextInputProps {
  label: string
  value: I18nText | undefined
  onChange: (value: I18nText) => void
  /** Languages the form is offered in: a missing one is flagged (B4.3). */
  languages?: readonly Language[]
  multiline?: boolean
  placeholder?: string
}

/** TR / EN inputs of one inline-translated text. */
export function I18nTextInput({
  label,
  value,
  onChange,
  languages = supportedLanguages,
  multiline = false,
  placeholder,
}: I18nTextInputProps) {
  const { t } = useTranslation("forms")
  const id = useId()
  const text = value ?? { tr: "", en: "" }
  const Control = multiline ? Textarea : Input
  const filled = supportedLanguages.some((language) => text[language].trim())

  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label" className="mb-0">
        {label}
      </FieldLegend>
      {supportedLanguages.map((language) => {
        const missing =
          filled && languages.includes(language) && !text[language].trim()
        const inputId = `${id}-${language}`
        return (
          <div key={language} className="flex flex-col gap-1">
            <Label
              htmlFor={inputId}
              className="text-xs font-normal text-muted-foreground"
            >
              {t(`languages.${language}`)}
            </Label>
            <Control
              id={inputId}
              lang={language}
              aria-label={`${label} (${t(`languages.${language}`)})`}
              value={text[language]}
              placeholder={placeholder}
              aria-describedby={missing ? `${inputId}-missing` : undefined}
              onChange={(event) =>
                onChange({ ...text, [language]: event.target.value })
              }
              {...(multiline ? { rows: 3 } : {})}
            />
            {missing ? (
              <p
                id={`${inputId}-missing`}
                className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
              >
                <TriangleAlertIcon className="size-3.5" aria-hidden />
                {t("builder.properties.missingTranslation")}
              </p>
            ) : null}
          </div>
        )
      })}
    </FieldSet>
  )
}
