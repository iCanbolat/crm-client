import { zodResolver } from "@hookform/resolvers/zod"
import { LockIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getModules } from "@/engine/modules"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import {
  verticalSelectionSchema,
  type VerticalSelection,
} from "../../api/workspace.schemas"
import { FormRootError, StepActions } from "./step-actions"
import { useStepSubmit } from "./use-step-submit"

interface VerticalStepProps {
  defaultValues: Partial<VerticalSelection>
  onSubmit: (values: VerticalSelection) => Promise<void>
}

/** Single choice: the sector the whole workspace is built around. */
export function VerticalStep({ defaultValues, onSubmit }: VerticalStepProps) {
  const { t } = useTranslation("workspace")
  const language = getCurrentLanguage()
  const form = useForm<VerticalSelection>({
    resolver: zodResolver(verticalSelectionSchema),
    defaultValues: defaultValues as VerticalSelection,
  })
  const { errors } = form.formState
  const submit = useStepSubmit(form, onSubmit)

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup className="gap-5">
        <FormRootError message={errors.root?.server?.message} />
        <Controller
          control={form.control}
          name="vertical"
          render={({ field, fieldState }) => (
            <fieldset
              className="flex flex-col gap-3"
              aria-describedby={fieldState.error ? "vertical-error" : undefined}
            >
              <legend className="sr-only">{t("vertical.legend")}</legend>
              <RadioGroup
                value={field.value ?? null}
                onValueChange={(value) => field.onChange(value)}
                aria-label={t("vertical.legend")}
              >
                {getModules().map((manifest) => {
                  const comingSoon = manifest.status !== "active"
                  const checked = field.value === manifest.id
                  const titleId = `vertical-${manifest.id}-title`
                  const Icon = manifest.icon

                  return (
                    <label
                      key={manifest.id}
                      data-disabled={comingSoon ? true : undefined}
                      className={cn(
                        "flex items-start gap-4 rounded-3xl border p-4 transition-colors",
                        comingSoon
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:bg-muted/50",
                        checked && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                        <Icon className="size-5" aria-hidden />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span id={titleId} className="font-medium">
                            {resolveI18nText(manifest.label, language)}
                          </span>
                          {comingSoon ? (
                            <Badge variant="outline">
                              {t("vertical.comingSoon")}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {resolveI18nText(manifest.description, language)}
                        </span>
                      </div>
                      <RadioGroupItem
                        value={manifest.id}
                        aria-labelledby={titleId}
                        disabled={comingSoon}
                      />
                    </label>
                  )
                })}
              </RadioGroup>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <LockIcon className="size-3.5 shrink-0" aria-hidden />
                {t("vertical.lockedHint")}
              </p>
              <FieldError
                id="vertical-error"
                errors={[
                  fieldState.error
                    ? { message: t("vertical.required") }
                    : undefined,
                ]}
              />
            </fieldset>
          )}
        />
        <StepActions isSubmitting={form.formState.isSubmitting} />
      </FieldGroup>
    </form>
  )
}
