import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  BadgeCheckIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  HandCoinsIcon,
  PlusIcon,
  StampIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getField, getOptionLabel, type ObjectDef } from "@/engine/metadata"
import type { RecordSlotProps } from "@/engine/modules"
import { usePermission } from "@/features/auth"
import {
  recordQueries,
  RecordFormSheet,
  useObjectDef,
  useUpdateRecord,
} from "@/features/records"
import { formatMoney } from "@/lib/currencies"
import { formatDate } from "@/lib/format"

import { useStartVisaApplication } from "../api/visa-education.queries"
import { toEducationHistory } from "../field-types/education-history"
import { toLanguageScores } from "../field-types/language-score"
import { toMoney } from "../lib/commission"
import {
  VISA_READY_ENROLLMENT_STAGES,
  type EnrollmentStage,
} from "../lib/constants"
import { checkEligibility } from "../lib/eligibility"
import { toIntake } from "../lib/intake"

const today = () => new Date().toISOString().slice(0, 10)

function optionLabel(
  def: ObjectDef,
  key: string,
  value: unknown,
  language: "tr" | "en"
) {
  const field = getField(def, key)
  return field ? getOptionLabel(field, value, language) : String(value ?? "")
}
const str = (value: unknown) =>
  typeof value === "string" && value ? value : null

/* ---------------------------------------------------------- eligibility */

/** Applicant vs programme requirements (`enrollment.detail.sidebar`, B8.5). */
export function EligibilityCard({ record }: RecordSlotProps) {
  const { t } = useTranslation("visaEducation")
  const applicantId = str(record.values.applicantId)
  const programId = str(record.values.programId)
  const applicant = useQuery({
    ...recordQueries.detail("contact", applicantId ?? ""),
    enabled: !!applicantId,
  })
  const program = useQuery({
    ...recordQueries.detail("program", programId ?? ""),
    enabled: !!programId,
  })

  if (!programId || !applicantId) return null
  const loading = applicant.isPending || program.isPending
  const findings =
    applicant.data && program.data
      ? checkEligibility(
          {
            languageScores: toLanguageScores(
              applicant.data.values.languageScores
            ),
            educationHistory: toEducationHistory(
              applicant.data.values.educationHistory
            ),
          },
          program.data.values,
          { today: today(), intake: toIntake(record.values.intake) }
        )
      : []

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{t("eligibility.title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("loading")}
          </p>
        ) : findings.length === 0 ? (
          <p className="flex items-center gap-2 text-sm">
            <BadgeCheckIcon className="size-4 text-primary" aria-hidden />
            {t("eligibility.ok")}
          </p>
        ) : (
          <ul
            className="flex flex-col gap-2"
            aria-label={t("eligibility.title")}
          >
            {findings.map((finding) => (
              <li key={finding.code} className="flex gap-2 text-sm">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                {t(`eligibility.codes.${finding.code}`, finding.params ?? {})}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------------- commission */

/** Expected vs received school commission (`enrollment.detail.sidebar`). */
export function CommissionCard({ objectDef, record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("visaEducation")
  const language = i18n.language === "en" ? "en" : "tr"
  const expected = toMoney(record.values.commissionExpected)
  const received = toMoney(record.values.commissionReceived)
  const status = str(record.values.commissionStatus) ?? "none"
  const canUpdate = usePermission("update", "record", {
    ownerId: record.values.ownerId as string | undefined,
  })
  const [open, setOpen] = useState(false)
  if (!expected) return null
  const statusLabel = optionLabel(
    objectDef,
    "commissionStatus",
    status,
    language
  )

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <HandCoinsIcon className="size-4" aria-hidden />
            {t("commission.title")}
          </h2>
        </CardTitle>
        <Badge variant={status === "received" ? "default" : "outline"}>
          {statusLabel}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-muted-foreground">
              {t("commission.expected")}
            </dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(expected.amount, expected.currency, language)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("commission.received")}
            </dt>
            <dd className="font-medium tabular-nums">
              {received
                ? formatMoney(received.amount, received.currency, language)
                : "—"}
            </dd>
          </div>
        </dl>
        {canUpdate &&
        status !== "received" &&
        record.values.stage === "enrolled" ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {t("commission.markReceived")}
          </Button>
        ) : null}
      </CardContent>
      {open ? (
        <CommissionDialog
          recordId={record.id}
          expected={expected}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Card>
  )
}

function CommissionDialog({
  recordId,
  expected,
  onClose,
}: {
  recordId: string
  expected: { amount: number; currency: string }
  onClose: () => void
}) {
  const { t } = useTranslation(["visaEducation", "common"])
  const id = useId()
  const update = useUpdateRecord("enrollment", {
    successMessage: t("commission.saved"),
  })
  const [amount, setAmount] = useState(String(expected.amount))
  const [date, setDate] = useState(today)
  const value = Number(amount)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!(value > 0)) return
    const ok = await update
      .mutateAsync({
        id: recordId,
        values: {
          commissionReceived: { amount: value, currency: expected.currency },
          commissionReceivedAt: date,
          // A partial payment keeps the claim open.
          commissionStatus:
            value + 0.001 >= expected.amount ? "received" : "claimed",
        },
      })
      .then(() => true)
      .catch(() => false)
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{t("commission.markReceived")}</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`${id}-amount`}>
              {t("payments.amountWithCurrency", {
                currency: expected.currency,
              })}
            </FieldLabel>
            <Input
              id={`${id}-amount`}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>
              {t("payments.paidAt")}
            </FieldLabel>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={!(value > 0) || update.isPending}>
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------------------------------- offer → student visa */

/** Offer / confirmation summary and "start student visa" (B8.5). */
export function OfferCard({ objectDef, record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("visaEducation")
  const language = i18n.language === "en" ? "en" : "tr"
  const navigate = useNavigate()
  const start = useStartVisaApplication(record.id)
  const canCreate = usePermission("create", "record")
  const stage = record.values.stage as EnrollmentStage
  const visaId = str(record.values.visaApplicationId)
  const ready = VISA_READY_ENROLLMENT_STAGES.includes(stage)
  const docType = str(record.values.confirmationDocType)

  async function startVisa() {
    const created = await start.mutateAsync().catch(() => null)
    if (created) {
      await navigate({
        to: "/o/$objectKey/$recordId",
        params: { objectKey: "visaApplication", recordId: created.id },
      })
    }
  }

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <StampIcon className="size-4" aria-hidden />
            {t("enrollment.visaTitle")}
          </h2>
        </CardTitle>
        {visaId ? (
          <Link
            to="/o/$objectKey/$recordId"
            params={{ objectKey: "visaApplication", recordId: visaId }}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            {t("enrollment.openVisa", {
              number: record.refs.visaApplicationId?.label ?? "",
            })}
          </Link>
        ) : canCreate ? (
          <Button
            size="sm"
            disabled={!ready || start.isPending}
            onClick={() => void startVisa()}
          >
            {t("enrollment.startVisa")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {visaId
          ? t("enrollment.visaLinked")
          : ready
            ? t("enrollment.visaReady", {
                document: docType
                  ? optionLabel(
                      objectDef,
                      "confirmationDocType",
                      docType,
                      language
                    )
                  : "",
              })
            : t("enrollment.visaNotReady")}
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------- appointments */

/** Consulate appointments of a visa file (`visaApplication.detail.sidebar`). */
export function AppointmentsCard({ record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("visaEducation")
  const language = i18n.language === "en" ? "en" : "tr"
  const appointmentDef = useObjectDef("appointment")
  const canCreate = usePermission("create", "record")
  const [adding, setAdding] = useState(false)
  const list = useQuery(
    recordQueries.list("appointment", {
      page: 1,
      pageSize: 10,
      sort: "scheduledAt:desc",
      filters: [{ field: "visaApplicationId", op: "eq", value: record.id }],
    })
  )
  if (!appointmentDef) return null
  const now = new Date().toISOString()

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <CalendarClockIcon className="size-4" aria-hidden />
            {t("appointments.title")}
          </h2>
        </CardTitle>
        {canCreate ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <PlusIcon aria-hidden />
            {t("appointments.add")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {list.isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("loading")}
          </p>
        ) : !list.data?.data.length ? (
          <p className="text-sm text-muted-foreground">
            {t("appointments.empty")}
          </p>
        ) : (
          <ul
            className="flex flex-col gap-2"
            aria-label={t("appointments.title")}
          >
            {list.data.data.map((item) => {
              const at = String(item.values.scheduledAt ?? "")
              const status = String(item.values.status ?? "")
              return (
                <li key={item.id} className="flex flex-col gap-0.5 text-sm">
                  <Link
                    to="/o/$objectKey/$recordId"
                    params={{ objectKey: "appointment", recordId: item.id }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {String(item.values.title ?? "")}
                  </Link>
                  <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                    {at
                      ? formatDate(at, language, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : null}
                    <Badge
                      variant={
                        status === "scheduled" && at >= now
                          ? "default"
                          : "outline"
                      }
                    >
                      {optionLabel(appointmentDef, "status", status, language)}
                    </Badge>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
      {adding ? (
        <RecordFormSheet
          objectDef={appointmentDef}
          open
          onOpenChange={(open) => !open && setAdding(false)}
          defaultValues={{
            visaApplicationId: record.id,
            status: "scheduled",
            kind: "biometrics",
          }}
          defaultRefs={{
            visaApplicationId: {
              id: record.id,
              label: String(record.values.applicationNumber ?? ""),
              objectKey: "visaApplication",
            },
          }}
          onSubmitted={() => setAdding(false)}
        />
      ) : null}
    </Card>
  )
}
