import { CopyIcon, Trash2Icon, XIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  getAnswerType,
  getFormFieldCategory,
  PREFILL_KINDS,
  toEngineFieldDef,
  type FormField,
  type PrefillKind,
} from "@/engine/forms"
import { FIELD_KEY_PATTERN } from "@/engine/metadata"
import { isWideField } from "@/features/form-renderer"
import {
  fromOptionDrafts,
  OptionsEditor,
  toOptionDrafts,
  type OptionDraft,
} from "@/features/settings"

import { useBuilder, useSelectedField } from "../../lib/builder-store"
import { takenKeys } from "../../lib/form-ops"
import { I18nTextInput } from "../i18n-text-input"
import { isPaletteType, useFieldKindLabel } from "./field-kinds"
import { StepSettings } from "./step-settings"
import { useStepTitle } from "./step-tabs"

/** Types whose engine input shows a placeholder. */
const PLACEHOLDER_TYPES = new Set([
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "select",
  "location",
  "port",
  "airport",
  "weight",
  "volume",
  "hsCode",
])
/** Min/max limit the length of text answers… */
const LENGTH_TYPES = new Set(["text", "textarea"])
/** …and the value of numeric ones. */
const RANGE_TYPES = new Set(["number", "weight", "volume"])
const OPTION_TYPES = new Set(["select", "radio", "checkboxes"])
const NO_DEFAULT_TYPES = new Set(["file", "consent", "hidden"])

function isValidPattern(pattern: string) {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

function NumberProperty({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(event) => {
          const next =
            event.target.value === "" ? undefined : Number(event.target.value)
          onChange(
            next === undefined || Number.isFinite(next) ? next : undefined
          )
        }}
      />
    </Field>
  )
}

function OptionsProperty({ field }: { field: FormField }) {
  const { t } = useTranslation("forms")
  const id = useId()
  const updateField = useBuilder((state) => state.updateField)
  // Drafts keep row ids stable while typing; undo resets them.
  const [source, setSource] = useState(field.options)
  const [drafts, setDrafts] = useState<OptionDraft[]>(() =>
    toOptionDrafts(field.options)
  )
  if (source !== field.options) {
    setSource(field.options)
    setDrafts(toOptionDrafts(field.options))
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("builder.properties.options")}</FieldLabel>
      <OptionsEditor
        id={id}
        options={drafts}
        onChange={(next) => {
          const options = fromOptionDrafts(next)
          setDrafts(next)
          setSource(options)
          updateField(field.id, { options }, "options")
        }}
      />
    </Field>
  )
}

function KeyProperty({ field }: { field: FormField }) {
  const { t } = useTranslation("forms")
  const id = useId()
  const content = useBuilder((state) => state.content)
  const updateField = useBuilder((state) => state.updateField)
  const [draft, setDraft] = useState(field.key)
  const [source, setSource] = useState(field.key)
  if (source !== field.key) {
    setSource(field.key)
    setDraft(field.key)
  }
  const error = !FIELD_KEY_PATTERN.test(draft)
    ? t("builder.properties.keyInvalid")
    : draft !== field.key && takenKeys(content, field.id).has(draft)
      ? t("builder.properties.keyTaken")
      : null

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{t("builder.properties.key")}</FieldLabel>
      <Input
        id={id}
        value={draft}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        onChange={(event) => {
          const next = event.target.value.trim()
          setDraft(next)
          if (
            FIELD_KEY_PATTERN.test(next) &&
            !takenKeys(content, field.id).has(next)
          ) {
            setSource(next)
            updateField(field.id, { key: next }, "key")
          }
        }}
        onBlur={() => setDraft(field.key)}
      />
      <FieldDescription id={`${id}-help`}>
        {t("builder.properties.keyHelp")}
      </FieldDescription>
      {error ? (
        <FieldError id={`${id}-error`} errors={[{ message: error }]} />
      ) : null}
    </Field>
  )
}

function PrefillProperty({ field }: { field: FormField }) {
  const { t } = useTranslation("forms")
  const id = useId()
  const updateField = useBuilder((state) => state.updateField)
  const prefill = field.prefill ?? { kind: "static" as const, value: "" }
  const items = PREFILL_KINDS.map((kind) => ({
    value: kind,
    label: t(`builder.properties.prefill.${kind}`),
  }))

  return (
    <>
      <Field>
        <FieldLabel htmlFor={id}>
          {t("builder.properties.prefill.label")}
        </FieldLabel>
        <Select
          items={items}
          value={prefill.kind}
          onValueChange={(kind) =>
            updateField(field.id, { prefill: { kind: kind as PrefillKind } })
          }
        >
          <SelectTrigger id={id} className="w-full">
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
      </Field>
      {prefill.kind === "static" ? (
        <Field>
          <FieldLabel htmlFor={`${id}-value`}>
            {t("builder.properties.prefill.value")}
          </FieldLabel>
          <Input
            id={`${id}-value`}
            value={prefill.value ?? ""}
            onChange={(event) =>
              updateField(
                field.id,
                { prefill: { ...prefill, value: event.target.value } },
                "prefill"
              )
            }
          />
        </Field>
      ) : null}
      {prefill.kind === "query" ? (
        <Field>
          <FieldLabel htmlFor={`${id}-param`}>
            {t("builder.properties.prefill.param")}
          </FieldLabel>
          <Input
            id={`${id}-param`}
            value={prefill.param ?? ""}
            placeholder="utm_source"
            spellCheck={false}
            onChange={(event) =>
              updateField(
                field.id,
                { prefill: { ...prefill, param: event.target.value.trim() } },
                "prefill"
              )
            }
          />
        </Field>
      ) : null}
    </>
  )
}

function DefaultValueProperty({ field }: { field: FormField }) {
  const { t } = useTranslation("forms")
  const id = useId()
  const updateField = useBuilder((state) => state.updateField)
  const definition = getAnswerType(field)
  return (
    <Field>
      <FieldLabel htmlFor={id} id={`${id}-label`}>
        {t("builder.properties.defaultValue")}
      </FieldLabel>
      <definition.Input
        id={id}
        labelId={`${id}-label`}
        field={toEngineFieldDef(field, { required: false })}
        value={field.defaultValue ?? null}
        onChange={(value) =>
          updateField(
            field.id,
            { defaultValue: value === null ? undefined : value },
            "defaultValue"
          )
        }
      />
    </Field>
  )
}

function FieldProperties({ field }: { field: FormField }) {
  const { t } = useTranslation("forms")
  const kindLabel = useFieldKindLabel()
  const stepTitle = useStepTitle()
  const steps = useBuilder((state) => state.content.steps)
  const languages = useBuilder((state) => state.content.settings.languages)
  const select = useBuilder((state) => state.select)
  const updateField = useBuilder((state) => state.updateField)
  const moveField = useBuilder((state) => state.moveField)
  const duplicateField = useBuilder((state) => state.duplicateField)
  const removeField = useBuilder((state) => state.removeField)
  const category = getFormFieldCategory(field.type)
  const id = useId()
  const patternId = useId()
  const stepId = useId()
  const pattern = field.validation?.pattern ?? ""
  const patternError = pattern && !isValidPattern(pattern)

  const setValidation = (
    patch: Partial<NonNullable<FormField["validation"]>>
  ) => {
    const next = { ...field.validation, ...patch }
    const clean = Object.fromEntries(
      Object.entries(next).filter(
        ([, value]) => value !== undefined && value !== ""
      )
    )
    updateField(
      field.id,
      { validation: Object.keys(clean).length ? clean : undefined },
      `validation.${Object.keys(patch)[0]}`
    )
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h2 id={`${id}-title`} className="font-medium">
            {t("builder.properties.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{kindLabel(field)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("builder.properties.close")}
          onClick={() => select(null)}
        >
          <XIcon />
        </Button>
      </div>

      <FieldGroup className="gap-5">
        <I18nTextInput
          label={t(
            field.type === "consent"
              ? "builder.properties.consentText"
              : "builder.properties.label"
          )}
          value={field.label}
          languages={languages}
          multiline={field.type === "consent"}
          onChange={(label) => updateField(field.id, { label }, "label")}
        />

        {field.type === "heading" ||
        field.type === "paragraph" ||
        field.type === "consent" ? (
          <I18nTextInput
            label={t(`builder.properties.content.${field.type}`)}
            value={field.content}
            languages={languages}
            multiline
            onChange={(content) =>
              updateField(field.id, { content }, "content")
            }
          />
        ) : null}

        {field.type === "consent" ? (
          <Field>
            <FieldLabel htmlFor={`${id}-consent`}>
              {t("builder.properties.consentUrl")}
            </FieldLabel>
            <Input
              id={`${id}-consent`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={field.consentUrl ?? ""}
              onChange={(event) =>
                updateField(
                  field.id,
                  { consentUrl: event.target.value.trim() || undefined },
                  "consentUrl"
                )
              }
            />
          </Field>
        ) : null}

        {PLACEHOLDER_TYPES.has(field.type) ? (
          <I18nTextInput
            label={t("builder.properties.placeholder")}
            value={field.placeholder}
            languages={[]}
            onChange={(placeholder) =>
              updateField(field.id, { placeholder }, "placeholder")
            }
          />
        ) : null}

        {category === "input" ? (
          <I18nTextInput
            label={t("builder.properties.helpText")}
            value={field.helpText}
            languages={[]}
            onChange={(helpText) =>
              updateField(field.id, { helpText }, "helpText")
            }
          />
        ) : null}

        {category === "input" ? (
          <Field orientation="horizontal">
            <Switch
              id={`${id}-required`}
              checked={!!field.required}
              onCheckedChange={(checked) =>
                updateField(field.id, { required: checked })
              }
            />
            <FieldLabel htmlFor={`${id}-required`}>
              {t("builder.properties.required")}
            </FieldLabel>
          </Field>
        ) : null}

        {OPTION_TYPES.has(field.type) && isPaletteType(field.type) ? (
          <OptionsProperty field={field} />
        ) : null}

        {LENGTH_TYPES.has(field.type) || RANGE_TYPES.has(field.type) ? (
          <div className="grid grid-cols-2 gap-3">
            <NumberProperty
              label={t(
                LENGTH_TYPES.has(field.type)
                  ? "builder.properties.minLength"
                  : "builder.properties.min"
              )}
              value={field.validation?.min}
              onChange={(min) => setValidation({ min })}
            />
            <NumberProperty
              label={t(
                LENGTH_TYPES.has(field.type)
                  ? "builder.properties.maxLength"
                  : "builder.properties.max"
              )}
              value={field.validation?.max}
              onChange={(max) => setValidation({ max })}
            />
          </div>
        ) : null}

        {LENGTH_TYPES.has(field.type) ? (
          <Field data-invalid={patternError ? true : undefined}>
            <FieldLabel htmlFor={patternId}>
              {t("builder.properties.pattern")}
            </FieldLabel>
            <Input
              id={patternId}
              value={pattern}
              spellCheck={false}
              placeholder="^[A-Z]{5}$"
              aria-invalid={patternError ? true : undefined}
              aria-describedby={`${patternId}-help${patternError ? ` ${patternId}-error` : ""}`}
              onChange={(event) =>
                setValidation({ pattern: event.target.value || undefined })
              }
            />
            <FieldDescription id={`${patternId}-help`}>
              {t("builder.properties.patternHelp")}
            </FieldDescription>
            {patternError ? (
              <FieldError
                id={`${patternId}-error`}
                errors={[{ message: t("builder.properties.patternInvalid") }]}
              />
            ) : null}
          </Field>
        ) : null}

        {category === "input" &&
        isPaletteType(field.type) &&
        !NO_DEFAULT_TYPES.has(field.type) ? (
          <DefaultValueProperty field={field} />
        ) : null}

        {category === "hidden" ? <PrefillProperty field={field} /> : null}

        {!isWideField({ ...field, width: "half" }) ? (
          <Field>
            <FieldLabel id={`${id}-width`}>
              {t("builder.properties.width")}
            </FieldLabel>
            <ToggleGroup
              variant="outline"
              spacing={0}
              aria-labelledby={`${id}-width`}
              value={[field.width]}
              onValueChange={(value) => {
                const width = value[0] as FormField["width"] | undefined
                if (width) updateField(field.id, { width })
              }}
            >
              <ToggleGroupItem value="full" className="px-3">
                {t("builder.properties.widthFull")}
              </ToggleGroupItem>
              <ToggleGroupItem value="half" className="px-3">
                {t("builder.properties.widthHalf")}
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        ) : null}

        {category !== "layout" ? <KeyProperty field={field} /> : null}

        {steps.length > 1 ? (
          <Field>
            <FieldLabel htmlFor={stepId}>
              {t("builder.properties.step")}
            </FieldLabel>
            <Select
              items={steps.map((step) => ({
                value: step.id,
                label: stepTitle(step),
              }))}
              value={field.stepId}
              onValueChange={(next) => {
                if (typeof next === "string" && next !== field.stepId) {
                  moveField(field.id, {
                    stepId: next,
                    index: Number.MAX_SAFE_INTEGER,
                  })
                }
              }}
            >
              <SelectTrigger id={stepId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {steps.map((step) => (
                  <SelectItem key={step.id} value={step.id}>
                    {stepTitle(step)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <FieldSeparator />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => duplicateField(field.id)}
          >
            <CopyIcon data-icon="inline-start" />
            {t("builder.properties.duplicate")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => removeField(field.id)}
          >
            <Trash2Icon data-icon="inline-start" />
            {t("builder.properties.remove")}
          </Button>
        </div>
      </FieldGroup>
    </section>
  )
}

/** Settings of the selected field, or of the active step (B4.3). */
export function PropertiesPanel() {
  const field = useSelectedField()
  return field ? (
    <FieldProperties key={field.id} field={field} />
  ) : (
    <StepSettings />
  )
}
