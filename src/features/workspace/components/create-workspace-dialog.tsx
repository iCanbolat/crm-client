import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { Loader2Icon } from "lucide-react"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { switchWorkspace } from "@/features/auth"
import { applyServerFieldErrors } from "@/lib/forms"

import { useCreateWorkspace } from "../api/workspace.mutations"
import {
  createWorkspaceInputSchema,
  type CreateWorkspaceInput,
} from "../api/workspace.schemas"

interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Another workspace — e.g. for another sector, since a workspace's sector is
 * locked (Faz 10). The new one opens with its onboarding.
 */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: CreateWorkspaceDialogProps) {
  const { t } = useTranslation("workspace")
  const queryClient = useQueryClient()
  const router = useRouter()
  const mutation = useCreateWorkspace()
  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceInputSchema),
    defaultValues: { name: "" },
  })
  const error = form.formState.errors.name

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const workspace = await mutation.mutateAsync(values)
      onOpenChange(false)
      form.reset()
      switchWorkspace(queryClient, workspace.id)
      await router.navigate({ to: "/onboarding" })
      await router.invalidate()
    } catch (caught) {
      applyServerFieldErrors(caught, form.setError)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{t("switcher.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("switcher.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="new-workspace-name">
              {t("company.name")}
            </FieldLabel>
            <Input
              id="new-workspace-name"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "new-workspace-name-error" : undefined}
              {...form.register("name")}
            />
            <FieldError id="new-workspace-name-error" errors={[error]} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {t("switcher.createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
