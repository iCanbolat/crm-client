import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, UserPlusIcon } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { applyServerFieldErrors } from "@/lib/forms"

import { useCreateInvite } from "../api/workspace.mutations"
import {
  INVITABLE_ROLES,
  inviteInputSchema,
  type InviteInput,
} from "../api/workspace.schemas"
import { FormSelect } from "./form-select"

export function InviteMemberDialog() {
  const { t } = useTranslation(["workspace", "common"])
  const [open, setOpen] = useState(false)
  const mutation = useCreateInvite()
  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteInputSchema),
    defaultValues: { email: "", role: "agent" },
  })
  const emailError = form.formState.errors.email
  const roleItems = INVITABLE_ROLES.map((role) => ({
    value: role,
    label: t(`workspace:roles.${role}`),
  }))

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values)
      form.reset()
      setOpen(false)
    } catch (error) {
      applyServerFieldErrors(error, form.setError)
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon data-icon="inline-start" />
        {t("members.invite")}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{t("members.inviteTitle")}</DialogTitle>
            <DialogDescription>
              {t("members.inviteDescription")}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-5">
            <Field data-invalid={emailError ? true : undefined}>
              <FieldLabel htmlFor="invite-email">
                {t("members.email")}
              </FieldLabel>
              <Input
                id="invite-email"
                type="email"
                placeholder={t("team.emailPlaceholder")}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "invite-email-error" : undefined}
                {...form.register("email")}
              />
              <FieldError id="invite-email-error" errors={[emailError]} />
            </Field>
            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <FormSelect
                  id="invite-role"
                  label={t("members.role")}
                  items={roleItems}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error}
                />
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {t("members.sendInvite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
