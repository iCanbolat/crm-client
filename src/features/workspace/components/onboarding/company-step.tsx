import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getInitials } from "@/lib/format"
import { getCurrentLanguage, supportedLanguages } from "@/lib/i18n"

import {
  companyInfoSchema,
  type CompanyInfo,
} from "../../api/workspace.schemas"
import {
  COUNTRY_CODES,
  CURRENCIES,
  formatTimezone,
  getCountryName,
  getCurrencyName,
  TIMEZONES,
} from "../../lib/reference"
import { FormSelect } from "../form-select"
import { LogoField } from "./logo-field"
import { FormRootError, StepActions } from "./step-actions"
import { useStepSubmit } from "./use-step-submit"

interface CompanyStepProps {
  defaultValues: CompanyInfo
  onSubmit: (values: CompanyInfo) => Promise<void>
}

export function CompanyStep({ defaultValues, onSubmit }: CompanyStepProps) {
  const { t } = useTranslation(["workspace", "common"])
  const language = getCurrentLanguage()
  const form = useForm<CompanyInfo>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues,
  })
  const { errors } = form.formState
  const submit = useStepSubmit(form, onSubmit)
  const name = useWatch({ control: form.control, name: "name" })

  const countryItems = COUNTRY_CODES.map((code) => ({
    value: code,
    label: getCountryName(code, language),
  })).sort((a, b) => a.label.localeCompare(b.label, language))
  const currencyItems = CURRENCIES.map((code) => ({
    value: code,
    label: getCurrencyName(code, language),
  }))
  const timezoneItems = TIMEZONES.map((zone) => ({
    value: zone,
    label: formatTimezone(zone),
  }))
  const languageItems = supportedLanguages.map((lng) => ({
    value: lng,
    label: t(`common:language.${lng}`),
  }))

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup className="gap-5">
        <FormRootError message={errors.root?.server?.message} />

        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="company-name">{t("company.name")}</FieldLabel>
          <Input
            id="company-name"
            autoComplete="organization"
            placeholder={t("company.namePlaceholder")}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "company-name-error" : undefined}
            {...form.register("name")}
          />
          <FieldError id="company-name-error" errors={[errors.name]} />
        </Field>

        <Controller
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <LogoField
              value={field.value}
              onChange={field.onChange}
              fallback={getInitials(name)}
            />
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="country"
            render={({ field, fieldState }) => (
              <FormSelect
                id="company-country"
                label={t("company.country")}
                items={countryItems}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error}
              />
            )}
          />
          <Controller
            control={form.control}
            name="currency"
            render={({ field, fieldState }) => (
              <FormSelect
                id="company-currency"
                label={t("company.currency")}
                items={currencyItems}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error}
              />
            )}
          />
          <Controller
            control={form.control}
            name="timezone"
            render={({ field, fieldState }) => (
              <FormSelect
                id="company-timezone"
                label={t("company.timezone")}
                items={timezoneItems}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error}
              />
            )}
          />
          <Controller
            control={form.control}
            name="language"
            render={({ field, fieldState }) => (
              <FormSelect
                id="company-language"
                label={t("company.language")}
                items={languageItems}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error}
              />
            )}
          />
        </div>

        <StepActions isSubmitting={form.formState.isSubmitting} />
      </FieldGroup>
    </form>
  )
}
