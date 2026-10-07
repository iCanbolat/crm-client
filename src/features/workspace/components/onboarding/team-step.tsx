import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import {
  INVITABLE_ROLES,
  MAX_INVITES,
  teamInvitesSchema,
  type TeamInvites,
} from "../../api/workspace.schemas"
import { FormSelect } from "../form-select"
import { FormRootError, StepActions } from "./step-actions"
import { useStepSubmit } from "./use-step-submit"

interface TeamStepProps {
  defaultValues: TeamInvites
  onSubmit: (values: TeamInvites) => Promise<void>
  onBack: () => void
}

export function TeamStep({ defaultValues, onSubmit, onBack }: TeamStepProps) {
  const { t } = useTranslation(["workspace", "common"])
  const form = useForm<TeamInvites>({
    resolver: zodResolver(teamInvitesSchema),
    defaultValues,
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invites",
  })
  const { errors } = form.formState
  const submit = useStepSubmit(form, onSubmit)
  const roleItems = INVITABLE_ROLES.map((role) => ({
    value: role,
    label: t(`workspace:roles.${role}`),
  }))

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup className="gap-5">
        <FormRootError message={errors.root?.server?.message} />

        {fields.length === 0 ? (
          <p className="rounded-3xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t("team.empty")}
          </p>
        ) : (
          <ul aria-label={t("team.listLabel")} className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const emailError = errors.invites?.[index]?.email
              const emailId = `invite-${index}-email`

              return (
                <li
                  key={field.id}
                  className="grid gap-3 rounded-3xl border p-3 sm:grid-cols-[1fr_11rem_auto] sm:items-start"
                >
                  <Field data-invalid={emailError ? true : undefined}>
                    <FieldLabel htmlFor={emailId}>
                      {t("team.email", { index: index + 1 })}
                    </FieldLabel>
                    <Input
                      id={emailId}
                      type="email"
                      placeholder={t("team.emailPlaceholder")}
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={
                        emailError ? `${emailId}-error` : undefined
                      }
                      {...form.register(`invites.${index}.email`)}
                    />
                    <FieldError id={`${emailId}-error`} errors={[emailError]} />
                  </Field>
                  <Controller
                    control={form.control}
                    name={`invites.${index}.role`}
                    render={({ field: roleField, fieldState }) => (
                      <FormSelect
                        id={`invite-${index}-role`}
                        label={t("team.role", { index: index + 1 })}
                        items={roleItems}
                        value={roleField.value}
                        onChange={roleField.onChange}
                        error={fieldState.error}
                      />
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="sm:mt-7"
                    aria-label={t("team.remove", { index: index + 1 })}
                    onClick={() => remove(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={fields.length >= MAX_INVITES}
          onClick={() => append({ email: "", role: "agent" })}
        >
          <PlusIcon data-icon="inline-start" />
          {t("team.add")}
        </Button>

        <StepActions
          onBack={onBack}
          isSubmitting={form.formState.isSubmitting}
          submitLabel={fields.length === 0 ? t("team.skip") : undefined}
        />
      </FieldGroup>
    </form>
  )
}
