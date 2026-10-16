import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, MailCheckIcon } from "lucide-react"
import { useEffect, useState } from "react"
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

import {
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from "../api/auth.mutations"
import {
  VERIFICATION_CODE_LENGTH,
  verifyEmailInputSchema,
  type VerifyEmailInput,
} from "../api/auth.schemas"

const RESEND_COOLDOWN_SECONDS = 60

interface VerifyEmailFormProps {
  email: string
  onVerified: () => void | Promise<void>
  onSignOut: () => void
}

/** 6-digit code sent to a self sign-up's address (Faz 10). */
export function VerifyEmailForm({
  email,
  onVerified,
  onSignOut,
}: VerifyEmailFormProps) {
  const { t } = useTranslation("auth")
  const verify = useVerifyEmailMutation()
  const resend = useResendVerificationMutation()
  // The first code was sent with the sign-up.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const form = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailInputSchema),
    defaultValues: { code: "" },
  })
  const { errors } = form.formState

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await verify.mutateAsync(values)
      await onVerified()
    } catch (error) {
      if (applyServerFieldErrors(error, form.setError)) return
      form.setError("code", { type: "server", message: getErrorMessage(error) })
    }
  })

  async function onResend() {
    try {
      await resend.mutateAsync()
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      const details = isApiError(error)
        ? (error.details as { retryAfter?: unknown } | undefined)
        : undefined
      const retryAfter =
        typeof details?.retryAfter === "number"
          ? details.retryAfter
          : RESEND_COOLDOWN_SECONDS
      setCooldown(retryAfter)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailCheckIcon className="size-5" aria-hidden />
        </div>
        <CardTitle>
          <h1 className="font-heading text-xl">{t("verify.title")}</h1>
        </CardTitle>
        <CardDescription>{t("verify.description", { email })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            <Field data-invalid={errors.code ? true : undefined}>
              <FieldLabel htmlFor="verify-code">{t("verify.code")}</FieldLabel>
              <Input
                id="verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={VERIFICATION_CODE_LENGTH}
                className="text-center font-mono text-lg tracking-[0.5em]"
                aria-invalid={errors.code ? true : undefined}
                aria-describedby={errors.code ? "verify-code-error" : undefined}
                {...form.register("code")}
              />
              <FieldError
                id="verify-code-error"
                errors={[
                  errors.code?.type === "server"
                    ? errors.code
                    : errors.code
                      ? { message: t("verify.codeFormat") }
                      : undefined,
                ]}
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
              {t("verify.submit")}
            </Button>
            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <Button
                type="button"
                variant="link"
                disabled={cooldown > 0 || resend.isPending}
                onClick={() => void onResend()}
              >
                {cooldown > 0
                  ? t("verify.resendIn", { seconds: cooldown })
                  : t("verify.resend")}
              </Button>
              <Button type="button" variant="link" onClick={onSignOut}>
                {t("verify.otherAccount")}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
