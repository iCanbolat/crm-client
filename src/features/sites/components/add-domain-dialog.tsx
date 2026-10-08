import { zodResolver } from "@hookform/resolvers/zod"
import { useId } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { applyServerFieldErrors } from "@/lib/forms"

import { useCreateDomain } from "../api/sites.mutations"
import {
  createDomainInputSchema,
  type CreateDomainInput,
  type Domain,
} from "../api/sites.schemas"

/** Hostname → the new domain row shows its DNS records (B5.3). */
export function AddDomainDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (domain: Domain) => void
}) {
  const { t } = useTranslation(["sites", "common"])
  const id = useId()
  const mutation = useCreateDomain()
  const form = useForm<CreateDomainInput>({
    resolver: zodResolver(createDomainInputSchema),
    defaultValues: { hostname: "" },
  })
  const error = form.formState.errors.hostname

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const domain = await mutation.mutateAsync(values)
      onOpenChange(false)
      form.reset()
      onAdded(domain)
    } catch (caught) {
      applyServerFieldErrors(caught, form.setError)
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("domains.addTitle")}</DialogTitle>
            <DialogDescription>{t("domains.addDescription")}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={id}>{t("domains.hostname")}</FieldLabel>
            <Input
              id={id}
              autoFocus
              spellCheck={false}
              autoCapitalize="none"
              placeholder={t("domains.hostnamePlaceholder")}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
              {...form.register("hostname")}
            />
            <FieldDescription id={`${id}-help`}>
              {t("domains.hostnameHelp")}
            </FieldDescription>
            <FieldError id={`${id}-error`} errors={[error]} />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t("domains.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
