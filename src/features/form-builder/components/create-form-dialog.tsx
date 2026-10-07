import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "@tanstack/react-router"
import { useId } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

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
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { applyServerFieldErrors } from "@/lib/forms"

import { useCreateForm } from "../api/forms.mutations"
import { createFormInputSchema, formSlugSchema } from "../api/forms.schemas"
import { slugify } from "../lib/slug"

/** An emptied link name falls back to one derived from the form name. */
const dialogSchema = createFormInputSchema.extend({
  slug: z.union([formSlugSchema, z.literal("")]),
})
type DialogValues = z.infer<typeof dialogSchema>

interface CreateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Name → link name (editable) → editor of the new form (B4.2). */
export function CreateFormDialog({
  open,
  onOpenChange,
}: CreateFormDialogProps) {
  const { t } = useTranslation(["forms", "common"])
  const id = useId()
  const navigate = useNavigate()
  const mutation = useCreateForm()
  const form = useForm<DialogValues>({
    resolver: zodResolver(dialogSchema),
    defaultValues: { name: "", slug: "" },
  })
  const { errors, dirtyFields } = form.formState
  const slug = useWatch({ control: form.control, name: "slug" })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await mutation.mutateAsync({
        name: values.name,
        slug: values.slug || undefined,
      })
      onOpenChange(false)
      form.reset()
      await navigate({
        to: "/forms/$formId/edit",
        params: { formId: created.id },
      })
    } catch (error) {
      applyServerFieldErrors(error, form.setError)
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
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>
        <form id={id} noValidate onSubmit={onSubmit}>
          <FieldGroup>
            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor={`${id}-name`}>{t("create.name")}</FieldLabel>
              <Input
                id={`${id}-name`}
                autoFocus
                placeholder={t("create.namePlaceholder")}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? `${id}-name-error` : undefined}
                {...form.register("name", {
                  onChange: (event: { target: { value: string } }) => {
                    if (!dirtyFields.slug) {
                      form.setValue("slug", slugify(event.target.value))
                    }
                  },
                })}
              />
              <FieldError id={`${id}-name-error`} errors={[errors.name]} />
            </Field>
            <Field data-invalid={errors.slug ? true : undefined}>
              <FieldLabel htmlFor={`${id}-slug`}>{t("create.slug")}</FieldLabel>
              <Input
                id={`${id}-slug`}
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby={`${id}-slug-help${errors.slug ? ` ${id}-slug-error` : ""}`}
                {...form.register("slug", {
                  setValueAs: (value: string) => value.trim(),
                })}
              />
              <FieldDescription id={`${id}-slug-help`}>
                {t("create.slugHelp", { slug: slug || "…" })}
              </FieldDescription>
              <FieldError id={`${id}-slug-error`} errors={[errors.slug]} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button type="submit" form={id} disabled={mutation.isPending}>
            {t("create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
