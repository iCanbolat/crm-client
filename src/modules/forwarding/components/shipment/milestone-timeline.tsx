import { useQuery } from "@tanstack/react-query"
import {
  CheckIcon,
  CircleDashedIcon,
  FlagIcon,
  SkipForwardIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/common/error-state"
import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { fromLocalInputValue, toLocalInputValue } from "@/engine/field-types"
import type { RecordSlotProps } from "@/engine/modules"
import { usePermission } from "@/features/auth"
import { isApiError } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import {
  shipmentQueries,
  useRecordMilestone,
} from "../../api/shipments.queries"
import type { MilestoneList } from "../../api/shipments.schemas"
import {
  MILESTONE_LABELS,
  MILESTONES,
  OPTIONAL_MILESTONES,
  type Milestone,
} from "../../lib/constants"

/**
 * Milestone timeline of a shipment (`shipment.detail.main`, B3.5): the
 * fixed order from booking to delivery; only the next step can be recorded.
 */
export function MilestoneTimeline({ record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("forwarding")
  const language = i18n.language === "en" ? "en" : "tr"
  const query = useQuery(shipmentQueries.milestones(record.id))
  const canUpdate = usePermission("update", "record", {
    ownerId: record.values.ownerId as string | undefined,
  })
  const [recording, setRecording] = useState(false)

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <h2 id="milestones-title">{t("shipment.milestones")}</h2>
        </CardTitle>
        {canUpdate && query.data?.next.length ? (
          <Button size="sm" onClick={() => setRecording(true)}>
            <FlagIcon data-icon="inline-start" />
            {t("shipment.recordNext")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <LoadingSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <Steps list={query.data} language={language} />
        )}
      </CardContent>
      {query.data ? (
        <RecordMilestoneDialog
          key={query.data.data.length}
          open={recording}
          onOpenChange={setRecording}
          shipmentId={record.id}
          next={query.data.next}
        />
      ) : null}
    </Card>
  )
}

function Steps({
  list,
  language,
}: {
  list: MilestoneList
  language: "tr" | "en"
}) {
  const { t, i18n } = useTranslation("forwarding")
  const done = new Map(list.data.map((event) => [event.milestone, event]))
  const lastIndex = Math.max(
    -1,
    ...list.data.map((event) => MILESTONES.indexOf(event.milestone))
  )

  return (
    <ol aria-labelledby="milestones-title" className="flex flex-col">
      {MILESTONES.map((milestone, index) => {
        const event = done.get(milestone)
        const skipped =
          !event && index < lastIndex && OPTIONAL_MILESTONES.includes(milestone)
        const state = event ? "done" : skipped ? "skipped" : "pending"
        const Icon = event
          ? CheckIcon
          : skipped
            ? SkipForwardIcon
            : CircleDashedIcon
        return (
          <li
            key={milestone}
            className="relative flex gap-3 pb-4 last:pb-0"
            aria-current={index === lastIndex ? "step" : undefined}
          >
            {index < MILESTONES.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 left-3.5 h-[calc(100%-1.5rem)] w-px",
                  event ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                event
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col">
              <span
                className={cn("font-medium", !event && "text-muted-foreground")}
              >
                {resolveI18nText(MILESTONE_LABELS[milestone], language)}
                <span className="sr-only"> — {t(`shipment.${state}`)}</span>
              </span>
              {event ? (
                <span className="text-xs text-muted-foreground">
                  {formatDate(event.at, i18n.language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {event.createdByName
                    ? ` · ${t("shipment.by", { name: event.createdByName })}`
                    : ""}
                </span>
              ) : skipped ? (
                <span className="text-xs text-muted-foreground">
                  {t("shipment.skipped")}
                </span>
              ) : null}
              {event?.note ? (
                <p className="mt-1 text-sm">{event.note}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

interface RecordMilestoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipmentId: string
  next: Milestone[]
}

function RecordMilestoneDialog({
  open,
  onOpenChange,
  shipmentId,
  next,
}: RecordMilestoneDialogProps) {
  const { t, i18n } = useTranslation(["forwarding", "common"])
  const language = i18n.language === "en" ? "en" : "tr"
  const id = useId()
  const mutation = useRecordMilestone(shipmentId)
  const [milestone, setMilestone] = useState<Milestone | null>(
    // Prefer the next mandatory step; transshipment is the exception.
    next.find((item) => !OPTIONAL_MILESTONES.includes(item)) ?? next[0] ?? null
  )
  const [at, setAt] = useState(() =>
    toLocalInputValue(new Date().toISOString())
  )
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const items = next.map((item) => ({
    value: item,
    label: resolveI18nText(MILESTONE_LABELS[item], language),
  }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const iso = fromLocalInputValue(at)
    if (!milestone || !iso) return
    try {
      await mutation.mutateAsync({
        milestone,
        at: iso,
        note: note || undefined,
      })
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error)) setErrors(error.fieldErrors ?? {})
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("shipment.recordTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("shipment.recordNext")}
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={errors.milestone ? true : undefined}>
            <FieldLabel htmlFor={`${id}-milestone`}>
              {t("shipment.milestone")}
            </FieldLabel>
            <Select
              items={items}
              value={milestone}
              onValueChange={(value) =>
                setMilestone((value as Milestone) ?? null)
              }
            >
              <SelectTrigger id={`${id}-milestone`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{errors.milestone?.[0]}</FieldError>
          </Field>
          <Field data-invalid={errors.at ? true : undefined}>
            <FieldLabel htmlFor={`${id}-at`}>{t("shipment.at")}</FieldLabel>
            <Input
              id={`${id}-at`}
              type="datetime-local"
              value={at}
              max={toLocalInputValue(new Date().toISOString())}
              aria-invalid={errors.at ? true : undefined}
              aria-describedby={errors.at ? `${id}-at-error` : undefined}
              onChange={(event) => setAt(event.target.value)}
            />
            <FieldError id={`${id}-at-error`}>{errors.at?.[0]}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-note`}>{t("shipment.note")}</FieldLabel>
            <Textarea
              id={`${id}-note`}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !milestone}>
              {t("shipment.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
