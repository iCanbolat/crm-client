import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Link, useBlocker, useNavigate } from "@tanstack/react-router"
import {
  CalculatorIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { useId, useRef, useState } from "react"
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ColorBadge, getFieldType } from "@/engine/field-types"
import type { FieldDef, RecordRef } from "@/engine/metadata"
import { CURRENCIES } from "@/lib/currencies"
import { resolveI18nText } from "@/lib/i18n-text"

import { useCreateQuote, useUpdateQuote } from "../../api/quotes.mutations"
import {
  quoteInputSchema,
  type Quote,
  type QuoteInput,
} from "../../api/quotes.schemas"
import { referenceQueries } from "../../api/reference.queries"
import { calcChargeableWeight } from "../../lib/cargo"
import {
  INCOTERM_OPTIONS,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  TRANSPORT_MODE_OPTIONS,
  type TransportMode,
} from "../../lib/constants"
import { calcQuoteTotals } from "../../lib/quote"
import { cargoMeasures, newOption, optionLetter } from "../../lib/quote-form"
import { QuoteOptionEditor } from "./quote-option-editor"
import { QuoteStatusActions } from "./quote-status-actions"
import { QuoteTotalsPanel } from "./quote-totals"

const CONTAINER_MODES: TransportMode[] = ["SEA_FCL", "RAIL", "MULTIMODAL"]

const field = (
  key: string,
  type: string,
  extra: Partial<FieldDef> = {}
): FieldDef => ({
  key,
  label: { tr: key, en: key },
  type,
  ...extra,
})
const COMPANY_FIELD = field("companyId", "relation", {
  required: true,
  relation: { objectKey: "company", displayField: "name" },
})
const CONTACT_FIELD = field("contactId", "relation", {
  relation: { objectKey: "contact", displayField: "name" },
})
const LOCATION_FIELD = field("location", "location", { required: true })
const CONTAINER_FIELD = field("containers", "container")

const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0
const optionalNumber = (value: string) =>
  value === "" || value === null ? null : Number(value)

interface QuoteBuilderProps {
  /** Builder values (a new draft or a loaded version). */
  initial: QuoteInput
  /** Missing for a new quote. */
  quote?: Quote
  refs?: Record<string, RecordRef | null>
}

/** Quote builder (B3.4): route, cargo, carrier options, charges, margin. */
export function QuoteBuilder({ initial, quote, refs = {} }: QuoteBuilderProps) {
  const { t, i18n } = useTranslation([
    "forwarding",
    "common",
    "records",
    "engine",
  ])
  const language = i18n.language === "en" ? "en" : "tr"
  const navigate = useNavigate()
  const id = useId()
  const editable = !quote || quote.editable
  const createMutation = useCreateQuote()
  const updateMutation = useUpdateQuote(quote?.id ?? "")
  const pending = createMutation.isPending || updateMutation.isPending
  const fxRates = useQuery(referenceQueries.fxRates())
  const leaving = useRef(false)

  const form = useForm<QuoteInput>({
    resolver: zodResolver(quoteInputSchema) as Resolver<QuoteInput>,
    defaultValues: initial,
  })
  const { control, register, setValue, formState } = form
  const options = useFieldArray({ control, name: "options", keyName: "key" })
  const [tab, setTab] = useState(initial.selectedOptionId)
  const watched = useWatch({ control })
  const selectedId = watched.selectedOptionId
  const mode = (watched.transportMode ?? "SEA_FCL") as TransportMode
  const currency = watched.currency ?? "USD"

  const selected = watched.options?.find((item) => item?.id === selectedId)
  const totals =
    selected && fxRates.data
      ? calcQuoteTotals(
          (selected.lines ?? []).map((line) => ({
            id: line?.id ?? "",
            code: line?.code ?? "OTHER",
            basis: line?.basis ?? "shipment",
            quantity: finite(line?.quantity),
            buyPrice: finite(line?.buyPrice),
            sellPrice: finite(line?.sellPrice),
            currency: line?.currency ?? currency,
          })),
          currency,
          fxRates.data.rates
        )
      : null

  const blocker = useBlocker({
    shouldBlockFn: () => formState.isDirty && !leaving.current,
    enableBeforeUnload: () => formState.isDirty && !leaving.current,
    withResolver: true,
  })

  async function save(values: QuoteInput) {
    try {
      if (quote) {
        const saved = await updateMutation.mutateAsync(values)
        form.reset(values)
        return saved
      }
      const created = await createMutation.mutateAsync(values)
      leaving.current = true
      await navigate({
        to: "/quotes/$quoteId",
        params: { quoteId: created.id },
        search: {},
        replace: true,
      })
    } catch {
      // Toasts and field errors come from the query client.
    }
  }

  function recalculate() {
    const cargo = form.getValues("cargo")
    const result = calcChargeableWeight(
      mode,
      finite(cargo.grossKg),
      finite(cargo.cbm)
    )
    setValue(
      "cargo.chargeableKg",
      result.unit === "kg" ? result.value : result.value * 1000,
      {
        shouldDirty: true,
      }
    )
  }

  const status = quote?.status ?? "draft"
  const title = quote
    ? t("quote.title", { number: quote.quoteNumber, version: quote.version })
    : t("quote.newTitle")
  const LocationInput = getFieldType("location").Input
  const RelationInput = getFieldType("relation").Input
  const ContainerInput = getFieldType("container").Input
  const modeItems = TRANSPORT_MODE_OPTIONS.map((item) => ({
    value: item.value,
    label: resolveI18nText(item.label, language),
  }))
  const incotermItems = INCOTERM_OPTIONS.map((item) => ({
    value: item.value,
    label: resolveI18nText(item.label, language),
  }))
  const currencyItems = CURRENCIES.map((code) => ({ value: code, label: code }))
  const errors = formState.errors

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {title}
            <ColorBadge color={QUOTE_STATUS_COLORS[status]}>
              {resolveI18nText(QUOTE_STATUS_LABELS[status], language)}
            </ColorBadge>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {quote && quote.versions.length > 1 ? (
              <Select
                items={quote.versions.map((item) => ({
                  value: String(item.version),
                  label: t("quote.versionItem", {
                    version: item.version,
                    status: resolveI18nText(
                      QUOTE_STATUS_LABELS[item.status],
                      language
                    ),
                  }),
                }))}
                value={String(quote.version)}
                onValueChange={(value) =>
                  void navigate({
                    to: "/quotes/$quoteId",
                    params: { quoteId: quote.id },
                    search: { version: Number(value) },
                  })
                }
              >
                <SelectTrigger
                  aria-label={t("quote.versions")}
                  className="w-44"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quote.versions.map((item) => (
                    <SelectItem key={item.version} value={String(item.version)}>
                      {t("quote.versionItem", {
                        version: item.version,
                        status: resolveI18nText(
                          QUOTE_STATUS_LABELS[item.status],
                          language
                        ),
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {editable ? (
              <Button type="submit" form={`${id}-form`} disabled={pending}>
                {pending ? (
                  <Loader2Icon
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                {t("quote.save")}
              </Button>
            ) : null}
            {quote ? (
              <QuoteStatusActions
                quote={quote}
                dirty={formState.isDirty}
                defaultEmail={null}
              />
            ) : null}
            {quote ? (
              <Link
                to="/o/$objectKey/$recordId"
                params={{ objectKey: "quote", recordId: quote.id }}
                className={buttonVariants({ variant: "ghost" })}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                {t("quote.openRecord")}
              </Link>
            ) : null}
          </div>
        }
      />

      {quote && !editable ? (
        <p role="status" className="rounded-2xl bg-muted p-3 text-sm">
          {t("quote.readOnly")}
        </p>
      ) : null}

      <form
        id={`${id}-form`}
        noValidate
        onSubmit={(event) => void form.handleSubmit(save)(event)}
        className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <Card size="sm">
            <CardHeader>
              <CardTitle>
                <h2>{t("quote.customer")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.companyId ? true : undefined}>
                <FieldLabel
                  htmlFor={`${id}-company`}
                  id={`${id}-company-label`}
                >
                  {t("quote.company")}
                </FieldLabel>
                <Controller
                  control={control}
                  name="companyId"
                  render={({ field: controller }) => (
                    <RelationInput
                      id={`${id}-company`}
                      labelId={`${id}-company-label`}
                      field={COMPANY_FIELD}
                      value={controller.value || null}
                      onChange={(value) => controller.onChange(value ?? "")}
                      refValue={refs.companyId}
                      invalid={!!errors.companyId}
                      disabled={!editable}
                    />
                  )}
                />
                <FieldError errors={[errors.companyId]} />
              </Field>
              <Field>
                <FieldLabel
                  htmlFor={`${id}-contact`}
                  id={`${id}-contact-label`}
                >
                  {t("quote.contact")}
                </FieldLabel>
                <Controller
                  control={control}
                  name="contactId"
                  render={({ field: controller }) => (
                    <RelationInput
                      id={`${id}-contact`}
                      labelId={`${id}-contact-label`}
                      field={CONTACT_FIELD}
                      value={controller.value ?? null}
                      onChange={controller.onChange}
                      refValue={refs.contactId}
                      disabled={!editable}
                    />
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-mode`}>
                  {t("quote.transportMode")}
                </FieldLabel>
                <Controller
                  control={control}
                  name="transportMode"
                  render={({ field: controller }) => (
                    <Select
                      items={modeItems}
                      value={controller.value}
                      onValueChange={(value) =>
                        value && controller.onChange(value)
                      }
                      disabled={!editable}
                    >
                      <SelectTrigger id={`${id}-mode`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modeItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-incoterm`}>
                  {t("quote.incoterm")}
                </FieldLabel>
                <Controller
                  control={control}
                  name="incoterm"
                  render={({ field: controller }) => (
                    <Select
                      items={[
                        { value: null, label: t("engine:none") },
                        ...incotermItems,
                      ]}
                      value={controller.value ?? null}
                      onValueChange={(value) =>
                        controller.onChange(value ?? null)
                      }
                      disabled={!editable}
                    >
                      <SelectTrigger id={`${id}-incoterm`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {incotermItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              {(["origin", "destination"] as const).map((key) => (
                <Field key={key} data-invalid={errors[key] ? true : undefined}>
                  <FieldLabel
                    htmlFor={`${id}-${key}`}
                    id={`${id}-${key}-label`}
                  >
                    {t(`quote.${key}`)}
                  </FieldLabel>
                  <Controller
                    control={control}
                    name={key}
                    render={({ field: controller }) => (
                      <LocationInput
                        id={`${id}-${key}`}
                        labelId={`${id}-${key}-label`}
                        field={LOCATION_FIELD}
                        value={controller.value ?? null}
                        onChange={(value) =>
                          controller.onChange(value ?? undefined)
                        }
                        invalid={!!errors[key]}
                        disabled={!editable}
                      />
                    )}
                  />
                  {errors[key] ? (
                    <FieldError>{t("engine:validation.required")}</FieldError>
                  ) : null}
                </Field>
              ))}
              <Field>
                <FieldLabel htmlFor={`${id}-currency`}>
                  {t("quote.currency")}
                </FieldLabel>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field: controller }) => (
                    <Select
                      items={currencyItems}
                      value={controller.value}
                      onValueChange={(value) =>
                        value && controller.onChange(value)
                      }
                      disabled={!editable}
                    >
                      <SelectTrigger id={`${id}-currency`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencyItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field data-invalid={errors.validUntil ? true : undefined}>
                <FieldLabel htmlFor={`${id}-valid`}>
                  {t("quote.validUntil")}
                </FieldLabel>
                <Input
                  id={`${id}-valid`}
                  type="date"
                  disabled={!editable}
                  aria-invalid={errors.validUntil ? true : undefined}
                  {...register("validUntil")}
                />
              </Field>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>
                <h2>{t("quote.cargo")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`${id}-commodity`}>
                  {t("quote.commodity")}
                </FieldLabel>
                <Input
                  id={`${id}-commodity`}
                  disabled={!editable}
                  {...register("cargo.commodity")}
                />
              </Field>
              {CONTAINER_MODES.includes(mode) ? (
                <Field className="sm:col-span-2">
                  <FieldLabel
                    htmlFor={`${id}-containers`}
                    id={`${id}-containers-label`}
                  >
                    {t("quote.containers")}
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="cargo.containers"
                    render={({ field: controller }) => (
                      <ContainerInput
                        id={`${id}-containers`}
                        labelId={`${id}-containers-label`}
                        field={CONTAINER_FIELD}
                        value={controller.value ?? null}
                        onChange={controller.onChange}
                        disabled={!editable}
                      />
                    )}
                  />
                </Field>
              ) : null}
              {(
                [
                  ["packageCount", "1"],
                  ["grossKg", "any"],
                  ["cbm", "any"],
                  ["chargeableKg", "any"],
                ] as const
              ).map(([key, step]) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`${id}-${key}`}>
                    {t(`quote.${key}`)}
                  </FieldLabel>
                  <Input
                    id={`${id}-${key}`}
                    type="number"
                    min={0}
                    step={step}
                    inputMode="decimal"
                    disabled={!editable}
                    {...register(`cargo.${key}`, {
                      setValueAs: optionalNumber,
                    })}
                  />
                </Field>
              ))}
              {editable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit sm:col-span-2"
                  onClick={recalculate}
                >
                  <CalculatorIcon data-icon="inline-start" />
                  {t("quote.recalculate")}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>
                <h2>{t("quote.options")}</h2>
              </CardTitle>
              {editable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const option = newOption(
                      mode,
                      currency,
                      cargoMeasures({
                        transportMode: mode,
                        cargo: form.getValues("cargo"),
                      })
                    )
                    options.append(option)
                    setTab(option.id)
                  }}
                >
                  <PlusIcon data-icon="inline-start" />
                  {t("quote.addOption")}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <Tabs
                value={tab}
                onValueChange={(value) => setTab(String(value))}
              >
                <TabsList className="flex-wrap">
                  {options.fields.map((option, index) => {
                    const carrier = watched.options?.[index]?.carrier
                    return (
                      <TabsTrigger key={option.key} value={option.id}>
                        {option.id === selectedId ? (
                          <StarIcon
                            className="size-3.5 fill-current"
                            aria-hidden
                          />
                        ) : null}
                        {carrier
                          ? t("quote.optionTab", {
                              letter: optionLetter(index),
                              carrier,
                            })
                          : t("quote.option", { letter: optionLetter(index) })}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
                {options.fields.map((option, index) => (
                  <TabsContent
                    key={option.key}
                    value={option.id}
                    className="pt-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {option.id === selectedId ? (
                        <Badge variant="secondary">
                          <StarIcon className="fill-current" aria-hidden />
                          {t("quote.selected")}
                        </Badge>
                      ) : editable ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setValue("selectedOptionId", option.id, {
                              shouldDirty: true,
                            })
                          }
                        >
                          <StarIcon data-icon="inline-start" />
                          {t("quote.selectOption")}
                        </Button>
                      ) : null}
                      {editable && options.fields.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const remaining = options.fields.filter(
                              (_, i) => i !== index
                            )
                            options.remove(index)
                            if (option.id === selectedId) {
                              setValue("selectedOptionId", remaining[0]!.id, {
                                shouldDirty: true,
                              })
                            }
                            setTab(remaining[0]!.id)
                          }}
                        >
                          <Trash2Icon data-icon="inline-start" />
                          {t("quote.removeOption")}
                        </Button>
                      ) : null}
                    </div>
                    <QuoteOptionEditor
                      index={index}
                      control={control}
                      register={register}
                      setValue={setValue}
                      errors={errors}
                      disabled={!editable}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <Field>
                <FieldLabel htmlFor={`${id}-notes`}>
                  {t("quote.notes")}
                </FieldLabel>
                <Textarea
                  id={`${id}-notes`}
                  rows={3}
                  disabled={!editable}
                  {...register("notes")}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <QuoteTotalsPanel totals={totals} ratesDate={fxRates.data?.date} />
        </aside>
      </form>

      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && !leaving.current) blocker.reset?.()
        }}
        title={t("records:form.unsavedTitle")}
        description={t("records:form.unsavedDescription")}
        confirmLabel={t("common:actions.discard")}
        cancelLabel={t("common:actions.keepEditing")}
        variant="destructive"
        onConfirm={() => {
          leaving.current = true
          blocker.proceed?.()
        }}
      />
    </div>
  )
}
