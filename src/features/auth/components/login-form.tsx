import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "@tanstack/react-router"
import { CircleAlertIcon, Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getErrorMessage, isApiError } from "@/lib/api"
import { applyServerFieldErrors } from "@/lib/forms"

import { useLoginMutation } from "../api/auth.mutations"
import { loginInputSchema, type LoginInput } from "../api/auth.schemas"

interface LoginFormProps {
  /** Called after a successful sign-in (the route decides where to go). */
  onSuccess: () => void | Promise<void>
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { t } = useTranslation("auth")
  const loginMutation = useLoginMutation()
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: "", password: "" },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values)
      await onSuccess()
    } catch (error) {
      if (applyServerFieldErrors(error, form.setError)) return
      const message =
        isApiError(error) && error.status === 401
          ? t("login.invalidCredentials")
          : getErrorMessage(error)
      form.setError("root.server", { type: "server", message })
    }
  })

  const rootError = errors.root?.server?.message

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="font-heading text-xl">{t("login.title")}</h1>
        </CardTitle>
        <CardDescription>{t("login.description")}</CardDescription>
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

            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="login-email">{t("fields.email")}</FieldLabel>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder={t("fields.emailPlaceholder")}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={
                  errors.email ? "login-email-error" : undefined
                }
                {...form.register("email")}
              />
              <FieldError id="login-email-error" errors={[errors.email]} />
            </Field>

            <Field data-invalid={errors.password ? true : undefined}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="login-password">
                  {t("fields.password")}
                </FieldLabel>
                <Link
                  to="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("login.forgotPassword")}
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={
                  errors.password ? "login-password-error" : undefined
                }
                {...form.register("password")}
              />
              <FieldError
                id="login-password-error"
                errors={[errors.password]}
              />
            </Field>

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
              {t("login.submit")}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
