import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheckIcon } from "lucide-react"
import { useId, useState } from "react"
import { useForm, type Path } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { applyServerFieldErrors } from "@/lib/forms"

import {
  useConnectChannel,
  useVerifyChannel,
} from "../../api/messaging.mutations"
import {
  APP_SECRET_PATTERN,
  type ConnectChannelInput,
  type PhoneNumberInfo,
  type WhatsappConnection,
} from "../../api/messaging.schemas"

interface FormValues {
  wabaId: string
  phoneNumberId: string
  accessToken: string
  appSecret: string
}

const ID_PATTERN = /^\d{6,20}$/

function useFormSchema(requireToken: boolean) {
  const { t } = useTranslation("messaging")
  const id = z.string().trim().regex(ID_PATTERN, t("connection.idInvalid"))
  return z.object({
    wabaId: id,
    phoneNumberId: id,
    accessToken: z
      .string()
      .trim()
      .refine(
        (value) =>
          requireToken ? value.length >= 20 : !value || value.length >= 20,
        t("connection.tokenInvalid")
      ),
    appSecret: z
      .string()
      .trim()
      .refine(
        (value) => !value || APP_SECRET_PATTERN.test(value),
        t("connection.secretInvalid")
      ),
  })
}

/** Empty secrets mean "keep the stored one". */
const toInput = (values: FormValues): ConnectChannelInput => ({
  wabaId: values.wabaId.trim(),
  phoneNumberId: values.phoneNumberId.trim(),
  ...(values.accessToken.trim()
    ? { accessToken: values.accessToken.trim() }
    : {}),
  ...(values.appSecret.trim() ? { appSecret: values.appSecret.trim() } : {}),
})

interface ConnectionFormProps {
  connection: WhatsappConnection | null
  onDone?: () => void
  onCancel?: () => void
}

/** Manual credentials of the tenant's own Meta app (B6.1). */
export function ConnectionForm({
  connection,
  onDone,
  onCancel,
}: ConnectionFormProps) {
  const { t } = useTranslation("messaging")
  const id = useId()
  const schema = useFormSchema(!connection)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      wabaId: connection?.wabaId ?? "",
      phoneNumberId: connection?.phoneNumberId ?? "",
      accessToken: "",
      appSecret: "",
    },
  })
  const verify = useVerifyChannel()
  const connect = useConnectChannel()
  const [tested, setTested] = useState<PhoneNumberInfo | null>(null)

  const test = form.handleSubmit(async (values) => {
    setTested(null)
    try {
      setTested(await verify.mutateAsync(toInput(values)))
    } catch (error) {
      applyServerFieldErrors(error, form.setError)
    }
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await connect.mutateAsync(toInput(values))
      onDone?.()
    } catch (error) {
      applyServerFieldErrors(error, form.setError)
    }
  })

  const field = (
    name: Path<FormValues>,
    label: string,
    {
      help,
      type = "text",
      autoComplete = "off",
    }: { help?: string; type?: "text" | "password"; autoComplete?: string } = {}
  ) => {
    const fieldId = `${id}-${name}`
    const { error } = form.getFieldState(name, form.formState)
    const describedBy =
      [help ? `${fieldId}-help` : null, error ? `${fieldId}-error` : null]
        .filter(Boolean)
        .join(" ") || undefined
    return (
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
        <Input
          id={fieldId}
          type={type}
          spellCheck={false}
          autoComplete={autoComplete}
          inputMode={
            type === "text" && name !== "appSecret" ? "numeric" : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...form.register(name, { onChange: () => setTested(null) })}
        />
        {help ? (
          <FieldDescription id={`${fieldId}-help`}>{help}</FieldDescription>
        ) : null}
        <FieldError id={`${fieldId}-error`} errors={[error]} />
      </Field>
    )
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <FieldGroup className="grid gap-5 md:grid-cols-2">
        {field("wabaId", t("connection.wabaId"))}
        {field("phoneNumberId", t("connection.phoneNumberId"))}
        {field("accessToken", t("connection.accessToken"), {
          type: "password",
          autoComplete: "new-password",
          help: connection
            ? t("connection.accessTokenKeep", { last4: connection.tokenLast4 })
            : t("connection.accessTokenHelp"),
        })}
        {field("appSecret", t("connection.appSecret"), {
          type: "password",
          autoComplete: "new-password",
          help: t("connection.appSecretHelp"),
        })}
      </FieldGroup>

      {tested ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        >
          <CircleCheckIcon aria-hidden className="size-4 shrink-0" />
          {t("connection.testOk", {
            name: tested.verifiedName,
            number: tested.displayPhoneNumber,
          })}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("connection.cancel")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => void test()}
          disabled={verify.isPending}
        >
          {verify.isPending ? t("connection.testing") : t("connection.test")}
        </Button>
        <Button type="submit" disabled={connect.isPending}>
          {connection ? t("connection.save") : t("connection.connect")}
        </Button>
      </div>
    </form>
  )
}
