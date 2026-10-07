import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, Loader2Icon, MailCheckIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, buttonVariants } from "@/components/ui/button"
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
import { applyServerFieldErrors } from "@/lib/forms"

import { useForgotPasswordMutation } from "../api/auth.mutations"
import {
  forgotPasswordInputSchema,
  type ForgotPasswordInput,
} from "../api/auth.schemas"

export function ForgotPasswordForm() {
  const { t } = useTranslation("auth")
  const mutation = useForgotPasswordMutation()
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordInputSchema),
    defaultValues: { email: "" },
  })
  const emailError = form.formState.errors.email

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      applyServerFieldErrors(error, form.setError)
    }
  })

  const backLink = (
    <Link
      to="/login"
      className={buttonVariants({ variant: "ghost", className: "w-full" })}
    >
      <ArrowLeftIcon data-icon="inline-start" />
      {t("forgot.backToLogin")}
    </Link>
  )

  if (mutation.isSuccess) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheckIcon className="size-6" aria-hidden />
          </div>
          <CardTitle>
            <h1 className="font-heading text-xl">{t("forgot.sentTitle")}</h1>
          </CardTitle>
          <CardDescription role="status">
            {t("forgot.sentDescription", { email: mutation.variables.email })}
          </CardDescription>
        </CardHeader>
        <CardContent>{backLink}</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="font-heading text-xl">{t("forgot.title")}</h1>
        </CardTitle>
        <CardDescription>{t("forgot.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            <Field data-invalid={emailError ? true : undefined}>
              <FieldLabel htmlFor="forgot-email">
                {t("fields.email")}
              </FieldLabel>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder={t("fields.emailPlaceholder")}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "forgot-email-error" : undefined}
                {...form.register("email")}
              />
              <FieldError id="forgot-email-error" errors={[emailError]} />
            </Field>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {t("forgot.submit")}
            </Button>
            {backLink}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
