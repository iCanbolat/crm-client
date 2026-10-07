import { Loader2Icon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fromLocalInputValue, toLocalInputValue } from "@/engine/field-types"
import { applyServerFieldErrors } from "@/lib/forms"

import { useCreateActivity } from "../api/activities.mutations"
import {
  ACTIVITY_TYPES,
  activityInputSchema,
  DIRECTIONS,
  type ActivityType,
} from "../api/activities.schemas"
import { ACTIVITY_ICONS } from "./activity-icons"

interface ActivityComposerProps {
  objectKey: string
  recordId: string
}

interface Draft {
  type: ActivityType
  subject: string
  body: string
  occurredAt: string
  durationMinutes: string
  direction: (typeof DIRECTIONS)[number]
}

const emptyDraft = (type: ActivityType): Draft => ({
  type,
  subject: "",
  body: "",
  occurredAt: toLocalInputValue(new Date().toISOString()),
  durationMinutes: "",
  direction: "outbound",
})

/** Logs a note, call, email or meeting on the record timeline (B2.6). */
export function ActivityComposer({
  objectKey,
  recordId,
}: ActivityComposerProps) {
  const { t } = useTranslation(["activities", "common"])
  const id = useId()
  const mutation = useCreateActivity(objectKey, recordId)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft("note"))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isNote = draft.type === "note"
  const hasDuration = draft.type === "call" || draft.type === "meeting"
  const hasDirection = draft.type === "call" || draft.type === "email"

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setErrors({})
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = activityInputSchema.safeParse({
      type: draft.type,
      subject: isNote ? null : draft.subject.trim() || null,
      body: draft.body,
      occurredAt: fromLocalInputValue(draft.occurredAt) ?? undefined,
      durationMinutes:
        hasDuration && draft.durationMinutes !== ""
          ? Number(draft.durationMinutes)
          : null,
      direction: hasDirection ? draft.direction : null,
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
      document.getElementById(`${id}-body`)?.focus()
      return
    }
    try {
      await mutation.mutateAsync(parsed.data)
      setDraft(emptyDraft(draft.type))
    } catch (error) {
      applyServerFieldErrors(error, (field, { message }) =>
        setErrors((current) => ({ ...current, [field]: message ?? "" }))
      )
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={t("composer.label")}
      className="flex flex-col gap-4 rounded-3xl border p-4"
    >
      <ToggleGroup
        variant="outline"
        size="sm"
        aria-label={t("composer.type")}
        value={[draft.type]}
        onValueChange={(value) => {
          const next = value[0] as ActivityType | undefined
          if (next) update({ type: next })
        }}
        className="flex-wrap"
      >
        {ACTIVITY_TYPES.map((type) => {
          const Icon = ACTIVITY_ICONS[type]
          return (
            <ToggleGroupItem key={type} value={type}>
              <Icon data-icon="inline-start" aria-hidden />
              {t(`types.${type}`)}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      {isNote ? null : (
        <Field>
          <FieldLabel htmlFor={`${id}-subject`}>
            {t("composer.subject")}
          </FieldLabel>
          <Input
            id={`${id}-subject`}
            value={draft.subject}
            maxLength={160}
            onChange={(event) => update({ subject: event.target.value })}
          />
        </Field>
      )}

      <Field data-invalid={errors.body ? true : undefined}>
        <FieldLabel htmlFor={`${id}-body`}>
          {isNote ? t("composer.note") : t("composer.details")}
        </FieldLabel>
        <Textarea
          id={`${id}-body`}
          rows={3}
          value={draft.body}
          placeholder={t(`composer.placeholder.${draft.type}`)}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? `${id}-body-error` : undefined}
          onChange={(event) => update({ body: event.target.value })}
        />
        <FieldError id={`${id}-body-error`}>{errors.body}</FieldError>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={`${id}-when`}>
            {t("composer.occurredAt")}
          </FieldLabel>
          <Input
            id={`${id}-when`}
            type="datetime-local"
            value={draft.occurredAt}
            onChange={(event) => update({ occurredAt: event.target.value })}
          />
        </Field>
        {hasDuration ? (
          <Field>
            <FieldLabel htmlFor={`${id}-duration`}>
              {t("composer.duration")}
            </FieldLabel>
            <Input
              id={`${id}-duration`}
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.durationMinutes}
              onChange={(event) =>
                update({ durationMinutes: event.target.value })
              }
            />
          </Field>
        ) : null}
        {hasDirection ? (
          <Field>
            <FieldLabel htmlFor={`${id}-direction`}>
              {t("composer.direction")}
            </FieldLabel>
            <Select
              items={DIRECTIONS.map((value) => ({
                value,
                label: t(`directions.${value}`),
              }))}
              value={draft.direction}
              onValueChange={(value) => {
                if (value === "outbound" || value === "inbound") {
                  update({ direction: value })
                }
              }}
            >
              <SelectTrigger id={`${id}-direction`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`directions.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : null}
          {t(`composer.submit.${draft.type}`)}
        </Button>
      </div>
    </form>
  )
}
