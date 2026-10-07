import { Loader2Icon } from "lucide-react"
import { useId, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getFieldType } from "@/engine/field-types"
import { useSession } from "@/features/auth"
import { applyServerFieldErrors } from "@/lib/forms"

import { useCreateTask } from "../api/activities.mutations"
import {
  TASK_PRIORITIES,
  TASK_TITLE_MAX,
  taskInputSchema,
  type TaskPriority,
} from "../api/activities.schemas"
import { toDay } from "../lib/tasks"

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Record the task is about (record page). */
  related?: { objectKey: string; recordId: string; label: string }
}

const UserInput = getFieldType("user").Input

/** Creates a task (title, due date, priority, assignee). */
export function TaskDialog({ open, onOpenChange, related }: TaskDialogProps) {
  const { t } = useTranslation(["activities", "common"])
  const id = useId()
  const { user } = useSession()
  const mutation = useCreateTask()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState(() => toDay())
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [assigneeId, setAssigneeId] = useState<string | null>(user.id)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function reset() {
    setTitle("")
    setDescription("")
    setDueDate(toDay())
    setPriority("medium")
    setAssigneeId(user.id)
    setErrors({})
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = taskInputSchema.safeParse({
      title,
      description: description.trim() || null,
      dueDate,
      priority,
      assigneeId: assigneeId ?? "",
      related: related
        ? { objectKey: related.objectKey, recordId: related.recordId }
        : null,
    })
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ])
        )
      )
      return
    }
    try {
      await mutation.mutateAsync(parsed.data)
      reset()
      onOpenChange(false)
    } catch (error) {
      applyServerFieldErrors(error, (field, { message }) =>
        setErrors((current) => ({ ...current, [field]: message ?? "" }))
      )
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <FieldError id={`${id}-${key}-error`}>{errors[key]}</FieldError>
    ) : null
  const invalid = (key: string) =>
    errors[key]
      ? { "aria-invalid": true, "aria-describedby": `${id}-${key}-error` }
      : {}

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle>{t("tasks.newTitle")}</DialogTitle>
            <DialogDescription>
              {related
                ? t("tasks.newDescriptionFor", { label: related.label })
                : t("tasks.newDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field data-invalid={errors.title ? true : undefined}>
              <FieldLabel htmlFor={`${id}-title`}>
                {t("tasks.fields.title")}
              </FieldLabel>
              <Input
                id={`${id}-title`}
                value={title}
                maxLength={TASK_TITLE_MAX}
                autoComplete="off"
                onChange={(event) => setTitle(event.target.value)}
                {...invalid("title")}
              />
              {fieldError("title")}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.dueDate ? true : undefined}>
                <FieldLabel htmlFor={`${id}-due`}>
                  {t("tasks.fields.dueDate")}
                </FieldLabel>
                <Input
                  id={`${id}-due`}
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  {...invalid("dueDate")}
                />
                {fieldError("dueDate")}
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-priority`}>
                  {t("tasks.fields.priority")}
                </FieldLabel>
                <Select
                  items={TASK_PRIORITIES.map((value) => ({
                    value,
                    label: t(`priorities.${value}`),
                  }))}
                  value={priority}
                  onValueChange={(value) => {
                    if (TASK_PRIORITIES.includes(value as TaskPriority)) {
                      setPriority(value as TaskPriority)
                    }
                  }}
                >
                  <SelectTrigger id={`${id}-priority`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`priorities.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field data-invalid={errors.assigneeId ? true : undefined}>
              <FieldLabel
                htmlFor={`${id}-assignee`}
                id={`${id}-assignee-label`}
              >
                {t("tasks.fields.assignee")}
              </FieldLabel>
              <UserInput
                id={`${id}-assignee`}
                labelId={`${id}-assignee-label`}
                field={{
                  key: "assigneeId",
                  type: "user",
                  required: true,
                  label: { tr: "", en: "" },
                }}
                value={assigneeId}
                onChange={setAssigneeId}
                invalid={!!errors.assigneeId}
                describedBy={
                  errors.assigneeId ? `${id}-assigneeId-error` : undefined
                }
              />
              {fieldError("assigneeId")}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-description`}>
                {t("tasks.fields.description")}
              </FieldLabel>
              <Textarea
                id={`${id}-description`}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {t("tasks.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
