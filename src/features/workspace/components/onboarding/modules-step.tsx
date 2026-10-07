import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { getModules, type ModuleId } from "@/engine/modules"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import {
  moduleSelectionSchema,
  type ModuleSelection,
} from "../../api/workspace.schemas"
import { FormRootError, StepActions } from "./step-actions"
import { useStepSubmit } from "./use-step-submit"

interface ModulesStepProps {
  defaultValues: ModuleSelection
  onSubmit: (values: ModuleSelection) => Promise<void>
  onBack: () => void
}

export function ModulesStep({
  defaultValues,
  onSubmit,
  onBack,
}: ModulesStepProps) {
  const { t } = useTranslation("workspace")
  const language = getCurrentLanguage()
  const form = useForm<ModuleSelection>({
    resolver: zodResolver(moduleSelectionSchema),
    defaultValues,
  })
  const { errors } = form.formState
  const submit = useStepSubmit(form, onSubmit)

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup className="gap-5">
        <FormRootError message={errors.root?.server?.message} />
        <Controller
          control={form.control}
          name="modules"
          render={({ field, fieldState }) => {
            const toggle = (id: ModuleId, checked: boolean) =>
              field.onChange(
                checked
                  ? [...field.value, id]
                  : field.value.filter((value) => value !== id)
              )

            return (
              <fieldset
                className="flex flex-col gap-3"
                aria-describedby={
                  fieldState.error ? "modules-error" : undefined
                }
              >
                <legend className="sr-only">{t("modules.legend")}</legend>
                {getModules().map((manifest) => {
                  const comingSoon = manifest.status !== "active"
                  const checked = field.value.includes(manifest.id)
                  const titleId = `module-${manifest.id}-title`
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
                              {t("modules.comingSoon")}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {resolveI18nText(manifest.description, language)}
                        </span>
                      </div>
                      <Checkbox
                        aria-labelledby={titleId}
                        checked={checked}
                        disabled={comingSoon}
                        onCheckedChange={(next) =>
                          toggle(manifest.id, next === true)
                        }
                      />
                    </label>
                  )
                })}
                <FieldError
                  id="modules-error"
                  errors={[
                    fieldState.error
                      ? { message: t("modules.required") }
                      : undefined,
                  ]}
                />
              </fieldset>
            )
          }}
        />
        <StepActions
          onBack={onBack}
          isSubmitting={form.formState.isSubmitting}
        />
      </FieldGroup>
    </form>
  )
}
