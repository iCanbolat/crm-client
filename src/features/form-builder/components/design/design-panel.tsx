import { TriangleAlertIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
  FORM_FONTS,
  FORM_RADII,
  getThemeWarnings,
  type FormFont,
  type FormRadius,
} from "@/engine/forms"
import type { FormDevice } from "@/features/form-renderer"
import { LogoField } from "@/features/workspace"
import { isApiError } from "@/lib/api"
import { supportedLanguages, type Language } from "@/lib/i18n"

import { useUpdateForm } from "../../api/forms.mutations"
import { formSlugSchema, type Form } from "../../api/forms.schemas"
import { useBuilder } from "../../lib/builder-store"
import { I18nTextInput } from "../i18n-text-input"
import { PreviewControls } from "../preview-controls"
import { FormPreview } from "../preview-dialog"
import { ColorField } from "./color-field"
import { EmailListInput } from "./email-list-input"

/** Redirects leave for https pages only (no `javascript:` or plain http). */
export function isValidRedirectUrl(value: string) {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

function SlugField({ form }: { form: Form }) {
  const { t } = useTranslation("forms")
  const id = useId()
  const mutation = useUpdateForm(form.id)
  const [slug, setSlug] = useState(form.slug)
  const [error, setError] = useState<string | null>(null)
  const parsed = formSlugSchema.safeParse(slug)

  async function save() {
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null)
      return
    }
    try {
      await mutation.mutateAsync({ slug: parsed.data })
      setError(null)
    } catch (caught) {
      if (isApiError(caught)) setError(caught.fieldErrors?.slug?.[0] ?? null)
    }
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{t("create.slug")}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          value={slug}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          onChange={(event) => {
            setSlug(event.target.value.trim())
            setError(null)
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={slug === form.slug || mutation.isPending}
          onClick={() => void save()}
        >
          {t("design.saveSlug")}
        </Button>
      </div>
      <FieldDescription id={`${id}-help`}>
        {t("create.slugHelp", { slug: slug || "…" })}
      </FieldDescription>
      {error ? (
        <FieldError id={`${id}-error`} errors={[{ message: error }]} />
      ) : null}
    </Field>
  )
}

/** "Tema & ayarlar" tab (B4.6): theme, submission settings, live preview. */
export function DesignPanel({ form }: { form: Form }) {
  const { t } = useTranslation("forms")
  const id = useId()
  const content = useBuilder((state) => state.content)
  const updateTheme = useBuilder((state) => state.updateTheme)
  const updateSettings = useBuilder((state) => state.updateSettings)
  const { theme, settings } = content
  const [device, setDevice] = useState<FormDevice>("desktop")
  const [previewLanguage, setPreviewLanguage] = useState<Language>(
    settings.defaultLanguage
  )
  const shownLanguage = settings.languages.includes(previewLanguage)
    ? previewLanguage
    : settings.defaultLanguage
  const warnings = getThemeWarnings(theme)
  const redirectInvalid =
    !!settings.redirectUrl && !isValidRedirectUrl(settings.redirectUrl)
  const [limit, setLimit] = useState(settings.maxSubmissions?.toString() ?? "")
  const limitInvalid = limit !== "" && !/^[1-9]\d*$/.test(limit)

  function toggleLanguage(language: Language, checked: boolean) {
    const languages = supportedLanguages.filter((item) =>
      item === language ? checked : settings.languages.includes(item)
    )
    if (languages.length === 0) return
    updateSettings({
      languages,
      defaultLanguage: languages.includes(settings.defaultLanguage)
        ? settings.defaultLanguage
        : languages[0]!,
    })
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[26rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("design.theme.title")}</CardTitle>
            <CardDescription>{t("design.theme.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <LogoField
                value={theme.logoUrl}
                onChange={(logoUrl) => updateTheme({ logoUrl })}
                fallback=""
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <ColorField
                  label={t("design.theme.primary")}
                  value={theme.primaryColor}
                  onChange={(primaryColor) =>
                    updateTheme({ primaryColor }, "primaryColor")
                  }
                />
                <ColorField
                  label={t("design.theme.background")}
                  value={theme.backgroundColor}
                  onChange={(backgroundColor) =>
                    updateTheme({ backgroundColor }, "backgroundColor")
                  }
                />
                <ColorField
                  label={t("design.theme.text")}
                  value={theme.textColor}
                  onChange={(textColor) =>
                    updateTheme({ textColor }, "textColor")
                  }
                />
                <Field>
                  <FieldLabel htmlFor={`${id}-font`}>
                    {t("design.theme.font")}
                  </FieldLabel>
                  <Select
                    items={FORM_FONTS.map((font) => ({
                      value: font,
                      label: t(`design.fonts.${font}`),
                    }))}
                    value={theme.font}
                    onValueChange={(font) =>
                      updateTheme({ font: font as FormFont })
                    }
                  >
                    <SelectTrigger id={`${id}-font`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_FONTS.map((font) => (
                        <SelectItem key={font} value={font}>
                          {t(`design.fonts.${font}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel id={`${id}-radius`}>
                  {t("design.theme.radius")}
                </FieldLabel>
                <ToggleGroup
                  variant="outline"
                  spacing={0}
                  aria-labelledby={`${id}-radius`}
                  value={[theme.radius]}
                  onValueChange={(value) => {
                    const radius = value[0] as FormRadius | undefined
                    if (radius) updateTheme({ radius })
                  }}
                >
                  {FORM_RADII.map((radius) => (
                    <ToggleGroupItem
                      key={radius}
                      value={radius}
                      className="px-2.5"
                    >
                      {t(`design.radii.${radius}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              {warnings.length ? (
                <ul
                  aria-label={t("design.warnings")}
                  className="flex flex-col gap-1.5"
                >
                  {warnings.map((warning) => (
                    <li
                      key={warning.code}
                      className="flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-300"
                    >
                      <TriangleAlertIcon
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      {t(`design.contrast.${warning.code}`, {
                        ratio: warning.ratio,
                      })}
                    </li>
                  ))}
                </ul>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("design.submit.title")}</CardTitle>
            <CardDescription>{t("design.submit.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <I18nTextInput
                label={t("design.submit.button")}
                value={settings.submitLabel}
                languages={settings.languages}
                onChange={(submitLabel) =>
                  updateSettings({ submitLabel }, "submitLabel")
                }
              />
              <I18nTextInput
                label={t("design.submit.success")}
                value={settings.successMessage}
                languages={settings.languages}
                multiline
                onChange={(successMessage) =>
                  updateSettings({ successMessage }, "successMessage")
                }
              />
              <Field data-invalid={redirectInvalid || undefined}>
                <FieldLabel htmlFor={`${id}-redirect`}>
                  {t("design.submit.redirect")}
                </FieldLabel>
                <Input
                  id={`${id}-redirect`}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={settings.redirectUrl ?? ""}
                  aria-invalid={redirectInvalid || undefined}
                  aria-describedby={`${id}-redirect-help`}
                  onChange={(event) =>
                    updateSettings(
                      { redirectUrl: event.target.value.trim() || null },
                      "redirectUrl"
                    )
                  }
                />
                <FieldDescription id={`${id}-redirect-help`}>
                  {redirectInvalid
                    ? t("design.submit.redirectInvalid")
                    : t("design.submit.redirectHelp")}
                </FieldDescription>
              </Field>
              <EmailListInput
                label={t("design.emails.label")}
                description={t("design.emails.description")}
                value={settings.notifyEmails}
                onChange={(notifyEmails) => updateSettings({ notifyEmails })}
              />
              <Field data-invalid={limitInvalid || undefined}>
                <FieldLabel htmlFor={`${id}-limit`}>
                  {t("design.submit.limit")}
                </FieldLabel>
                <Input
                  id={`${id}-limit`}
                  inputMode="numeric"
                  value={limit}
                  placeholder={t("design.submit.unlimited")}
                  aria-invalid={limitInvalid || undefined}
                  aria-describedby={`${id}-limit-help`}
                  onChange={(event) => {
                    const next = event.target.value.trim()
                    setLimit(next)
                    if (next === "")
                      updateSettings({ maxSubmissions: null }, "limit")
                    else if (/^[1-9]\d*$/.test(next)) {
                      updateSettings({ maxSubmissions: Number(next) }, "limit")
                    }
                  }}
                />
                <FieldDescription id={`${id}-limit-help`}>
                  {limitInvalid
                    ? t("design.submit.limitInvalid")
                    : t("design.submit.limitHelp")}
                </FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Switch
                  id={`${id}-honeypot`}
                  checked={settings.honeypot}
                  onCheckedChange={(honeypot) => updateSettings({ honeypot })}
                />
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor={`${id}-honeypot`}>
                    {t("design.submit.honeypot")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("design.submit.honeypotHelp")}
                  </FieldDescription>
                </div>
              </Field>
              <Field orientation="horizontal">
                <Switch
                  id={`${id}-progress`}
                  checked={settings.showProgress}
                  onCheckedChange={(showProgress) =>
                    updateSettings({ showProgress })
                  }
                />
                <FieldLabel htmlFor={`${id}-progress`}>
                  {t("design.submit.progress")}
                </FieldLabel>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("design.languages.title")}</CardTitle>
            <CardDescription>
              {t("design.languages.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <FieldSet>
                <FieldLegend variant="label">
                  {t("design.languages.offered")}
                </FieldLegend>
                <div className="flex gap-4">
                  {supportedLanguages.map((language) => (
                    <Field key={language} orientation="horizontal">
                      <Checkbox
                        id={`${id}-lang-${language}`}
                        checked={settings.languages.includes(language)}
                        disabled={
                          settings.languages.length === 1 &&
                          settings.languages.includes(language)
                        }
                        onCheckedChange={(checked) =>
                          toggleLanguage(language, checked === true)
                        }
                      />
                      <FieldLabel
                        htmlFor={`${id}-lang-${language}`}
                        className="font-normal"
                      >
                        {t(`languages.${language}`)}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
              </FieldSet>
              {settings.languages.length > 1 ? (
                <Field>
                  <FieldLabel htmlFor={`${id}-default`}>
                    {t("design.languages.default")}
                  </FieldLabel>
                  <Select
                    items={settings.languages.map((language) => ({
                      value: language,
                      label: t(`languages.${language}`),
                    }))}
                    value={settings.defaultLanguage}
                    onValueChange={(value) =>
                      updateSettings({ defaultLanguage: value as Language })
                    }
                  >
                    <SelectTrigger id={`${id}-default`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.languages.map((language) => (
                        <SelectItem key={language} value={language}>
                          {t(`languages.${language}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              <SlugField form={form} />
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <section
        aria-labelledby={`${id}-preview`}
        className="flex flex-col gap-3 rounded-3xl border bg-muted/40 p-3 sm:p-4 xl:sticky xl:top-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${id}-preview`} className="font-medium">
            {t("design.preview")}
          </h2>
          <PreviewControls
            device={device}
            onDeviceChange={setDevice}
            language={shownLanguage}
            languages={settings.languages}
            onLanguageChange={setPreviewLanguage}
          />
        </div>
        <FormPreview
          content={content}
          device={device}
          language={shownLanguage}
        />
      </section>
    </div>
  )
}
