import { CheckCircle2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { getModule } from "@/engine/modules"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import type { CompleteOnboardingInput } from "../../api/workspace.schemas"
import {
  formatTimezone,
  getCountryName,
  getCurrencyName,
} from "../../lib/reference"
import { FormRootError, StepActions } from "./step-actions"

interface ReviewStepProps {
  values: CompleteOnboardingInput
  isSubmitting: boolean
  error?: string
  onSubmit: () => void
  onBack: () => void
}

export function ReviewStep({
  values,
  isSubmitting,
  error,
  onSubmit,
  onBack,
}: ReviewStepProps) {
  const { t } = useTranslation(["workspace", "common"])
  const language = getCurrentLanguage()
  const { company, modules, invites } = values

  const rows = [
    { label: t("company.name"), value: company.name },
    {
      label: t("company.country"),
      value: getCountryName(company.country, language),
    },
    {
      label: t("company.currency"),
      value: getCurrencyName(company.currency, language),
    },
    { label: t("company.timezone"), value: formatTimezone(company.timezone) },
    {
      label: t("company.language"),
      value: t(`common:language.${company.language}`),
    },
    {
      label: t("review.modules"),
      value: modules
        .map((id) => {
          const manifest = getModule(id)
          return manifest ? resolveI18nText(manifest.label, language) : id
        })
        .join(", "),
    },
    {
      label: t("review.invites"),
      value: invites.length
        ? t("review.inviteCount", { count: invites.length })
        : t("review.noInvites"),
    },
  ]

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <FormRootError message={error} />
      <div className="flex items-center gap-3 rounded-3xl bg-primary/5 p-4 text-sm">
        <CheckCircle2Icon
          className="size-5 shrink-0 text-primary"
          aria-hidden
        />
        {t("review.ready")}
      </div>
      <dl className="divide-y rounded-3xl border">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4"
          >
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-medium sm:text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
      <StepActions
        onBack={onBack}
        isSubmitting={isSubmitting}
        submitLabel={t("review.submit")}
      />
    </form>
  )
}
