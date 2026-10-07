import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { applyServerFieldErrors } from "@/lib/forms"

import { useCreateExample } from "../api/example.mutations"
import {
  createExampleInputSchema,
  type CreateExampleInput,
} from "../api/example.schemas"

const NAME_ERROR_ID = "example-name-error"

export function CreateExampleForm() {
  const { t } = useTranslation("example")
  const createMutation = useCreateExample()
  const form = useForm<CreateExampleInput>({
    resolver: zodResolver(createExampleInputSchema),
    defaultValues: { name: "" },
  })
  const nameError = form.formState.errors.name

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync(values)
      form.reset()
    } catch (error) {
      applyServerFieldErrors(error, form.setError)
    }
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="example-name" className="sr-only">
          {t("form.nameLabel")}
        </Label>
        <Input
          id="example-name"
          placeholder={t("form.namePlaceholder")}
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? NAME_ERROR_ID : undefined}
          {...form.register("name")}
        />
        {nameError ? (
          <p id={NAME_ERROR_ID} className="px-3 text-xs text-destructive">
            {nameError.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={createMutation.isPending}>
        <PlusIcon data-icon="inline-start" />
        {t("form.submit")}
      </Button>
    </form>
  )
}
