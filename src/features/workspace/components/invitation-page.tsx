import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, useRouter } from "@tanstack/react-router"
import { CircleAlertIcon, Loader2Icon, LinkIcon } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { Button, buttonVariants } from "@/components/ui/button"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getModule, getRoleLabel } from "@/engine/modules"
import {
  authKeys,
  ensureSession,
  setActiveWorkspaceId,
  setSessionTokens,
  signOut,
  switchWorkspace,
  type Me,
} from "@/features/auth"
import { getErrorMessage, isApiError } from "@/lib/api"
import { applyServerFieldErrors } from "@/lib/forms"
import i18n, { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { acceptInvite, signUpWithInvite } from "../api/workspace.api"
import { workspaceQueries } from "../api/workspace.queries"
import {
  inviteSignUpInputSchema,
  type Invitation,
} from "../api/workspace.schemas"
import { WorkspaceAvatar } from "./workspace-avatar"

interface InvitationPageProps {
  token: string
  /** Signed-in user, if any. */
  me: Me | null
}

/**
 * Invitation link (`/invite/:token`, Faz 10): joins the workspace with the
 * invited role — by signing up (the link proves the address, so no extra
 * verification and no onboarding) or with the matching existing account.
 */
export function InvitationPage({ token, me }: InvitationPageProps) {
  const { t } = useTranslation("workspace")
  const { data: invitation } = useSuspenseQuery(
    workspaceQueries.invitation(token)
  )
  const language = getCurrentLanguage()
  const sector = invitation.vertical ? getModule(invitation.vertical) : null
  const roleName = (() => {
    const custom = getRoleLabel(invitation.vertical, invitation.role)
    return custom
      ? resolveI18nText(custom.label, language)
      : t(`roles.${invitation.role}`)
  })()

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <WorkspaceAvatar
          name={invitation.workspaceName}
          logoUrl={invitation.workspaceLogoUrl}
          className="size-12 rounded-2xl"
        />
        <CardTitle>
          <h1 className="font-heading text-xl">
            {t("invitation.title", { workspace: invitation.workspaceName })}
          </h1>
        </CardTitle>
        <CardDescription>
          {t("invitation.description", {
            inviter: invitation.inviterName,
            workspace: invitation.workspaceName,
            role: roleName,
          })}
        </CardDescription>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {sector ? (
            <>
              <dt className="text-muted-foreground">
                {t("invitation.sector")}
              </dt>
              <dd className="font-medium">
                {resolveI18nText(sector.label, language)}
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">{t("invitation.email")}</dt>
          <dd className="truncate font-medium">{invitation.email}</dd>
        </dl>
      </CardHeader>
      <CardContent>
        {!me ? (
          <InviteSignUp token={token} invitation={invitation} />
        ) : me.user.email === invitation.email ? (
          <AcceptInvite token={token} invitation={invitation} />
        ) : (
          <WrongAccount token={token} invitation={invitation} me={me} />
        )}
      </CardContent>
    </Card>
  )
}

interface StepProps {
  token: string
  invitation: Invitation
}

function useEnterWorkspace() {
  const router = useRouter()
  return async (workspaceName: string) => {
    toast.success(
      i18n.t("workspace:invitation.accepted", { workspace: workspaceName })
    )
    await router.navigate({ to: "/dashboard" })
    await router.invalidate()
  }
}

function AcceptInvite({ token, invitation }: StepProps) {
  const { t } = useTranslation("workspace")
  const queryClient = useQueryClient()
  const enter = useEnterWorkspace()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setPending(true)
    setError(null)
    try {
      const { workspaceId } = await acceptInvite(token)
      // The cached identity lacks the new membership: drop it, then switch.
      queryClient.removeQueries({ queryKey: authKeys.me() })
      switchWorkspace(queryClient, workspaceId)
      await enter(invitation.workspaceName)
    } catch (caught) {
      setError(getErrorMessage(caught))
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormAlert message={error} /> : null}
      <Button onClick={() => void accept()} disabled={pending}>
        {pending ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : null}
        {t("invitation.accept")}
      </Button>
    </div>
  )
}

function WrongAccount({ token, invitation, me }: StepProps & { me: Me }) {
  const { t } = useTranslation("workspace")
  const queryClient = useQueryClient()
  const router = useRouter()

  async function switchAccount() {
    await signOut()
    queryClient.clear()
    await router.navigate({
      to: "/login",
      search: { redirect: `/invite/${token}` },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <FormAlert
        title={t("invitation.mismatchTitle")}
        message={t("invitation.mismatchDescription", {
          current: me.user.email,
          email: invitation.email,
        })}
      />
      <Button variant="outline" onClick={() => void switchAccount()}>
        {t("invitation.switchAccount")}
      </Button>
    </div>
  )
}

const signUpFormSchema = inviteSignUpInputSchema
  .extend({ passwordConfirm: z.string(), acceptTerms: z.boolean() })
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
type SignUpFormValues = z.infer<typeof signUpFormSchema>

function InviteSignUp({ token, invitation }: StepProps) {
  const { t } = useTranslation(["workspace", "auth"])
  const queryClient = useQueryClient()
  const enter = useEnterWorkspace()
  const [accountExists, setAccountExists] = useState(false)
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      name: "",
      password: "",
      passwordConfirm: "",
      acceptTerms: false,
    },
  })
  const { errors } = form.formState
  const loginLink = (
    <Link
      to="/login"
      search={{ redirect: `/invite/${token}` }}
      className="font-medium text-foreground underline-offset-4 hover:underline"
    >
      {t("invitation.signIn")}
    </Link>
  )

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { workspaceId, ...tokens } = await signUpWithInvite(token, {
        name: values.name,
        password: values.password,
        acceptTerms: true,
      })
      queryClient.clear()
      setSessionTokens(tokens)
      setActiveWorkspaceId(workspaceId)
      await ensureSession(queryClient)
      await enter(invitation.workspaceName)
    } catch (error) {
      if (isApiError(error) && error.code === "EMAIL_TAKEN") {
        setAccountExists(true)
        return
      }
      if (applyServerFieldErrors(error, form.setError)) return
      form.setError("root.server", {
        type: "server",
        message: getErrorMessage(error),
      })
    }
  })

  if (accountExists) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert message={t("invitation.accountExists")} />
        <Link
          to="/login"
          search={{ redirect: `/invite/${token}` }}
          className={buttonVariants()}
        >
          {t("invitation.signIn")}
        </Link>
      </div>
    )
  }

  const field = (
    name: "name" | "password" | "passwordConfirm",
    type = "text",
    autoComplete?: string
  ) => {
    const error = errors[name]
    const id = `invite-${name}`
    return (
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>
          {t(`auth:register.fields.${name}`)}
        </FieldLabel>
        <Input
          id={id}
          type={type}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...form.register(name)}
        />
        <FieldError id={`${id}-error`} errors={[error]} />
      </Field>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-5">
        <h2 className="font-medium">{t("invitation.signUpTitle")}</h2>
        {errors.root?.server?.message ? (
          <FormAlert message={errors.root.server.message} />
        ) : null}
        {field("name", "text", "name")}
        {field("password", "password", "new-password")}
        {field("passwordConfirm", "password", "new-password")}
        <Controller
          control={form.control}
          name="acceptTerms"
          render={({ field: terms, fieldState }) => (
            <Field
              orientation="horizontal"
              data-invalid={fieldState.error ? true : undefined}
            >
              <Checkbox
                id="invite-terms"
                checked={terms.value}
                onCheckedChange={(checked) => terms.onChange(checked === true)}
                aria-invalid={fieldState.error ? true : undefined}
                aria-describedby={
                  fieldState.error ? "invite-terms-error" : undefined
                }
              />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="invite-terms" className="font-normal">
                  {t("auth:register.acceptTerms")}
                </FieldLabel>
                <FieldError
                  id="invite-terms-error"
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
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : null}
          {t("invitation.signUpSubmit")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("invitation.haveAccount")} {loginLink}
        </p>
      </FieldGroup>
    </form>
  )
}

function FormAlert({ title, message }: { title?: string; message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex flex-col gap-0.5">
        {title ? <span className="font-medium">{title}</span> : null}
        {message}
      </span>
    </div>
  )
}

/** Unknown, revoked, used or expired link. */
export function InvitationInvalid() {
  const { t } = useTranslation("workspace")
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-muted">
          <LinkIcon className="size-5" aria-hidden />
        </div>
        <CardTitle>
          <h1 className="font-heading text-xl">
            {t("invitation.invalidTitle")}
          </h1>
        </CardTitle>
        <CardDescription>{t("invitation.invalidDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link to="/login" className={buttonVariants({ variant: "outline" })}>
          {t("invitation.toLogin")}
        </Link>
      </CardContent>
    </Card>
  )
}
