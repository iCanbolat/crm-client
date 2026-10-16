import { useQuery } from "@tanstack/react-query"
import { WalletIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RecordSlotProps } from "@/engine/modules"
import { usePermission } from "@/features/auth"
import { CURRENCIES, formatMoney } from "@/lib/currencies"
import { formatDate } from "@/lib/format"

import type { InstallmentDto } from "../api/payments.schemas"
import {
  usePaymentMutations,
  visaEducationQueries,
} from "../api/visa-education.queries"
import { PAYMENT_METHODS, type PaymentMethod } from "../lib/constants"
import { addMonths } from "../lib/passport"
import { isInstallmentPaid, splitEvenly } from "../lib/payments"
import { Picker } from "../field-types/shared"

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Service fee instalments of an application (B8.8): plan wizard, payments
 * and overdue warnings. Deliberately simple — no invoicing.
 */
export function PaymentPlanCard({ objectDef, record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("visaEducation")
  const language = i18n.language === "en" ? "en" : "tr"
  const query = useQuery(
    visaEducationQueries.paymentPlan(objectDef.key, record.id)
  )
  const canUpdate = usePermission("update", "record", {
    ownerId: record.values.ownerId as string | undefined,
  })
  const [planning, setPlanning] = useState(false)
  const [paying, setPaying] = useState<InstallmentDto | null>(null)

  const plan = query.data?.plan
  const summary = query.data?.summary
  const money = (amount: number) =>
    formatMoney(amount, summary?.currency ?? "TRY", language)
  const date = (value: string) =>
    formatDate(`${value}T00:00:00`, language, { dateStyle: "medium" })
  const hasPayments = plan?.installments.some((item) => item.paidAmount > 0)

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <WalletIcon className="size-4" aria-hidden />
            {t("payments.title")}
          </h2>
        </CardTitle>
        {canUpdate && query.data && !hasPayments ? (
          <Button size="sm" variant="outline" onClick={() => setPlanning(true)}>
            {plan ? t("payments.replan") : t("payments.create")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("loading")}
          </p>
        ) : query.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {t("payments.error")}
          </p>
        ) : !plan ? (
          <p className="text-sm text-muted-foreground">{t("payments.empty")}</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">{t("payments.total")}</dt>
                <dd className="font-medium tabular-nums">
                  {money(summary!.total)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("payments.paid")}</dt>
                <dd className="font-medium tabular-nums">
                  {money(summary!.paid)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("payments.outstanding")}
                </dt>
                <dd className="font-medium tabular-nums">
                  {money(summary!.outstanding)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("payments.status")}
                </dt>
                <dd>
                  <Badge
                    variant={
                      summary!.status === "overdue"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {t(`payments.statuses.${summary!.status}`)}
                  </Badge>
                </dd>
              </div>
            </dl>
            <div className="relative overflow-x-auto">
              <Table containerLabel={t("payments.installments")}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("payments.installment")}</TableHead>
                    <TableHead>{t("payments.dueDate")}</TableHead>
                    <TableHead className="text-end">
                      {t("payments.amount")}
                    </TableHead>
                    <TableHead>{t("payments.state")}</TableHead>
                    {canUpdate ? (
                      <TableHead>
                        <span className="sr-only">{t("payments.actions")}</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.installments.map((item) => {
                    const paid = isInstallmentPaid(item)
                    const overdue = !paid && item.dueDate < today()
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell>{date(item.dueDate)}</TableCell>
                        <TableCell className="text-end tabular-nums">
                          {money(item.amount)}
                          {item.paidAmount > 0 && !paid ? (
                            <span className="block text-xs text-muted-foreground">
                              {t("payments.partial", {
                                amount: money(item.paidAmount),
                              })}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              paid
                                ? "secondary"
                                : overdue
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {paid
                              ? t("payments.statuses.paid")
                              : overdue
                                ? t("payments.statuses.overdue")
                                : t("payments.pending")}
                          </Badge>
                        </TableCell>
                        {canUpdate ? (
                          <TableCell className="text-end">
                            {!paid ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPaying(item)}
                              >
                                {t("payments.collect")}
                              </Button>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
      {planning ? (
        <PlanDialog
          objectKey={objectDef.key}
          recordId={record.id}
          onClose={() => setPlanning(false)}
        />
      ) : null}
      {paying ? (
        <PayDialog
          objectKey={objectDef.key}
          recordId={record.id}
          installment={paying}
          currency={summary?.currency ?? "TRY"}
          onClose={() => setPaying(null)}
        />
      ) : null}
    </Card>
  )
}

function PlanDialog({
  objectKey,
  recordId,
  onClose,
}: {
  objectKey: string
  recordId: string
  onClose: () => void
}) {
  const { t } = useTranslation(["visaEducation", "common"])
  const id = useId()
  const { save } = usePaymentMutations(objectKey, recordId)
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("TRY")
  const [count, setCount] = useState("3")
  const [firstDue, setFirstDue] = useState(() => addMonths(today(), 0))
  const fee = Number(amount)
  const valid = fee > 0 && Number(count) >= 1 && Boolean(firstDue)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    const installments = splitEvenly(
      { amount: fee, currency },
      Number(count),
      firstDue
    ).map(({ label, dueDate, amount: value }) => ({
      label,
      dueDate,
      amount: value,
    }))
    const ok = await save
      .mutateAsync({ serviceFee: { amount: fee, currency }, installments })
      .then(() => true)
      .catch(() => false)
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{t("payments.planTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Field className="flex-1">
              <FieldLabel htmlFor={`${id}-fee`}>{t("payments.fee")}</FieldLabel>
              <Input
                id={`${id}-fee`}
                type="number"
                inputMode="decimal"
                min={0}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field className="w-28">
              <FieldLabel htmlFor={`${id}-currency`}>
                {t("payments.currency")}
              </FieldLabel>
              <Picker
                id={`${id}-currency`}
                items={CURRENCIES.map((code) => ({ value: code, label: code }))}
                value={currency}
                label={t("payments.currency")}
                onChange={(value) => value && setCurrency(value)}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Field className="w-32">
              <FieldLabel htmlFor={`${id}-count`}>
                {t("payments.count")}
              </FieldLabel>
              <Input
                id={`${id}-count`}
                type="number"
                min={1}
                max={12}
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor={`${id}-first`}>
                {t("payments.firstDue")}
              </FieldLabel>
              <Input
                id={`${id}-first`}
                type="date"
                value={firstDue}
                onChange={(event) => setFirstDue(event.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("payments.monthly")}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PayDialog({
  objectKey,
  recordId,
  installment,
  currency,
  onClose,
}: {
  objectKey: string
  recordId: string
  installment: InstallmentDto
  currency: string
  onClose: () => void
}) {
  const { t } = useTranslation(["visaEducation", "common"])
  const id = useId()
  const { pay } = usePaymentMutations(objectKey, recordId)
  const remaining =
    Math.round((installment.amount - installment.paidAmount) * 100) / 100
  const [amount, setAmount] = useState(String(remaining))
  const [paidAt, setPaidAt] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>("transfer")
  const value = Number(amount)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!(value > 0)) return
    const ok = await pay
      .mutateAsync({
        installmentId: installment.id,
        input: { amount: value, paidAt, method },
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
            <DialogTitle>
              {t("payments.payTitle", { label: installment.label })}
            </DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`${id}-amount`}>
              {t("payments.amountWithCurrency", { currency })}
            </FieldLabel>
            <Input
              id={`${id}-amount`}
              type="number"
              inputMode="decimal"
              min={0}
              max={remaining}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Field className="flex-1">
              <FieldLabel htmlFor={`${id}-date`}>
                {t("payments.paidAt")}
              </FieldLabel>
              <Input
                id={`${id}-date`}
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor={`${id}-method`}>
                {t("payments.method")}
              </FieldLabel>
              <Picker
                id={`${id}-method`}
                items={PAYMENT_METHODS.map((item) => ({
                  value: item,
                  label: t(`payments.methods.${item}`),
                }))}
                value={method}
                label={t("payments.method")}
                onChange={(next) => next && setMethod(next as PaymentMethod)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={!(value > 0) || pay.isPending}>
              {t("payments.collect")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
