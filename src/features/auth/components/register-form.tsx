import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "@tanstack/react-router"
import { CircleAlertIcon, Loader2Icon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getErrorMessage } from "@/lib/api"
import { applyServerFieldErrors } from "@/lib/forms"
import i18n from "@/lib/i18n"

import { useRegisterMutation } from "../api/auth.mutations"
import {
  PASSWORD_MIN,
  registerInputSchema,
  type RegisterInput,
} from "../api/auth.schemas"

const registerFormSchema = registerInputSchema
  .extend({
    passwordConfirm: z.string(),
    acceptTerms: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.passwordConfirm) {
      ctx.addIssue({
        code: "custom",
        path: ["passwordConfirm"],
        message: i18n.t("auth:register.passwordMismatch"),
      })
    }
    if (!values.acceptTerms) {
      ctx.addIssue({
        code: "custom",
        path: ["acceptTerms"],
        message: i18n.t("auth:register.termsRequired"),
      })
    }
  })
type RegisterFormValues = z.infer<typeof registerFormSchema>

interface RegisterFormProps {
  /** Called after the account exists (the route decides where to go). */
  onSuccess: () => void | Promise<void>
}

/** Self sign-up (Faz 10): account + a workspace waiting for its setup. */
export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { t } = useTranslation("auth")
  const mutation = useRegisterMutation()
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      companyName: "",
      password: "",
      passwordConfirm: "",
      acceptTerms: false,
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    const input: RegisterInput = {
      name: values.name,
      email: values.email,
      companyName: values.companyName,
      password: values.password,
      acceptTerms: true,
    }
    try {
      await mutation.mutateAsync(input)
      await onSuccess()
    } catch (error) {
      if (applyServerFieldErrors(error, form.setError)) return
      form.setError("root.server", {
        type: "server",
        message: getErrorMessage(error),
      })
    }
  })

  const rootError = errors.root?.server?.message
  const textField = (
    name: "name" | "email" | "companyName" | "password" | "passwordConfirm",
    options: {
      type?: string
      autoComplete?: string
      placeholder?: string
      hint?: string
    } = {}
  ) => {
    const error = errors[name]
    const id = `register-${name}`
    const describedBy = [
      options.hint ? `${id}-hint` : null,
      error ? `${id}-error` : null,
    ]
      .filter(Boolean)
      .join(" ")
    return (
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>{t(`register.fields.${name}`)}</FieldLabel>
        <Input
          id={id}
          type={options.type ?? "text"}
          autoComplete={options.autoComplete}
          placeholder={options.placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...form.register(name)}
        />
        {options.hint ? (
          <FieldDescription id={`${id}-hint`}>{options.hint}</FieldDescription>
        ) : null}
        <FieldError id={`${id}-error`} errors={[error]} />
      </Field>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="font-heading text-xl">{t("register.title")}</h1>
        </CardTitle>
        <CardDescription>{t("register.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            {rootError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                {rootError}
              </div>
            ) : null}

            {textField("name", { autoComplete: "name" })}
            {textField("email", {
              type: "email",
              autoComplete: "email",
              placeholder: t("fields.emailPlaceholder"),
            })}
            {textField("companyName", {
              autoComplete: "organization",
              hint: t("register.companyHint"),
            })}
            {textField("password", {
              type: "password",
              autoComplete: "new-password",
              hint: t("register.passwordHint", { min: PASSWORD_MIN }),
            })}
            {textField("passwordConfirm", {
              type: "password",
              autoComplete: "new-password",
            })}

            <Controller
              control={form.control}
              name="acceptTerms"
              render={({ field, fieldState }) => (
                <Field
                  orientation="horizontal"
                  data-invalid={fieldState.error ? true : undefined}
                >
                  <Checkbox
                    id="register-terms"
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                    aria-invalid={fieldState.error ? true : undefined}
                    aria-describedby={
                      fieldState.error ? "register-terms-error" : undefined
                    }
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel
                      htmlFor="register-terms"
                      className="font-normal"
                    >
                      {t("register.acceptTerms")}
                    </FieldLabel>
                    <FieldError
                      id="register-terms-error"
                      errors={[fieldState.error]}
                    />
                  </div>
                </Field>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {t("register.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("register.haveAccount")}{" "}
              <Link
                to="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {t("register.signIn")}
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
