import { useQuery } from "@tanstack/react-query"
import { PlusIcon, Trash2Icon } from "lucide-react"
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CURRENCIES, formatMoney } from "@/lib/currencies"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import { referenceQueries } from "../../api/reference.queries"
import type { QuoteInput } from "../../api/quotes.schemas"
import {
  CHARGE_CODES,
  CHARGE_LABELS,
  UNIT_BASES,
  UNIT_BASIS_LABELS,
  type CarrierKind,
  type ChargeCode,
  type UnitBasis,
} from "../../lib/constants"
import { calcLine, calcLineQuantity } from "../../lib/quote"
import { cargoMeasures, newLine } from "../../lib/quote-form"

const carrierKind = (mode: QuoteInput["transportMode"]): CarrierKind =>
  mode === "AIR" || mode === "COURIER"
    ? "air"
    : mode.startsWith("ROAD") || mode === "RAIL"
      ? "road"
      : "sea"

const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0

interface QuoteOptionEditorProps {
  index: number
  control: Control<QuoteInput>
  register: UseFormRegister<QuoteInput>
  setValue: UseFormSetValue<QuoteInput>
  errors: FieldErrors<QuoteInput>
  disabled: boolean
}

/** Carrier, transit time and charge lines of one option (B3.4). */
export function QuoteOptionEditor({
  index,
  control,
  register,
  setValue,
  errors,
  disabled,
}: QuoteOptionEditorProps) {
  const { t, i18n } = useTranslation("forwarding")
  const language = i18n.language === "en" ? "en" : "tr"
  const prefix = `options.${index}` as const
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${prefix}.lines`,
    keyName: "key",
  })
  const mode = useWatch({ control, name: "transportMode" })
  const cargo = useWatch({ control, name: "cargo" })
  const currency = useWatch({ control, name: "currency" })
  const lines = useWatch({ control, name: `${prefix}.lines` }) ?? []
  const carriers = useQuery(referenceQueries.carriers(carrierKind(mode)))
  const carrier = useWatch({ control, name: `${prefix}.carrier` })
  const carrierItems = [
    ...(carriers.data ?? []).map((item) => ({
      value: item.name,
      label: item.name,
    })),
  ]
  if (carrier && !carrierItems.some((item) => item.value === carrier)) {
    carrierItems.unshift({ value: carrier, label: carrier })
  }
  const optionErrors = errors.options?.[index]
  const measures = cargoMeasures({ transportMode: mode, cargo: cargo ?? {} })

  const chargeItems = CHARGE_CODES.map((code) => ({
    value: code,
    label: resolveI18nText(CHARGE_LABELS[code], language),
  }))
  const basisItems = UNIT_BASES.map((basis) => ({
    value: basis,
    label: resolveI18nText(UNIT_BASIS_LABELS[basis], language),
  }))
  const currencyItems = CURRENCIES.map((code) => ({ value: code, label: code }))
  const id = `option-${index}`

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={optionErrors?.carrier ? true : undefined}>
          <FieldLabel htmlFor={`${id}-carrier`}>
            {t("quote.carrier")}
          </FieldLabel>
          <Controller
            control={control}
            name={`${prefix}.carrier`}
            render={({ field }) => (
              <Select
                items={carrierItems}
                value={field.value || null}
                onValueChange={(value) => field.onChange(value ?? "")}
                disabled={disabled}
              >
                <SelectTrigger
                  id={`${id}-carrier`}
                  className="w-full"
                  aria-invalid={optionErrors?.carrier ? true : undefined}
                >
                  <SelectValue placeholder={t("quote.carrierPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {carrierItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {optionErrors?.carrier ? (
            <p className="text-sm text-destructive">
              {t("quote.validation.carrier")}
            </p>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-transit`}>
            {t("quote.transitDays")}
          </FieldLabel>
          <Input
            id={`${id}-transit`}
            type="number"
            min={0}
            inputMode="numeric"
            disabled={disabled}
            {...register(`${prefix}.transitDays`, {
              setValueAs: (value: string) =>
                value === "" || value === null ? null : Number(value),
            })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium" id={`${id}-lines`}>
          {t("quote.lines")}
        </h3>
        <div className="relative -mx-1 overflow-x-auto px-1">
          <table
            className="w-full min-w-[68rem] border-separate border-spacing-y-1 text-sm"
            aria-labelledby={`${id}-lines`}
          >
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-48 font-medium">{t("quote.code")}</th>
                <th className="min-w-40 font-medium">
                  {t("quote.description")}
                </th>
                <th className="w-40 font-medium">{t("quote.basis")}</th>
                <th className="w-24 font-medium">{t("quote.quantity")}</th>
                <th className="w-28 font-medium">{t("quote.buyPrice")}</th>
                <th className="w-28 font-medium">{t("quote.sellPrice")}</th>
                <th className="w-24 font-medium">{t("quote.lineCurrency")}</th>
                <th className="w-32 text-right font-medium">
                  {t("quote.lineSell")}
                </th>
                <th className="w-28 text-right font-medium">
                  {t("quote.lineProfit")}
                </th>
                <th className="w-10">
                  <span className="sr-only">
                    {t("quote.removeLine", { name: "" })}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((row, lineIndex) => {
                const line = lines[lineIndex]
                const name = `${prefix}.lines.${lineIndex}` as const
                const lineErrors = optionErrors?.lines?.[lineIndex]
                const totals = calcLine({
                  quantity: finite(line?.quantity),
                  buyPrice: finite(line?.buyPrice),
                  sellPrice: finite(line?.sellPrice),
                })
                const code = (line?.code ?? row.code) as ChargeCode
                const rowLabel = `${resolveI18nText(CHARGE_LABELS[code], language)} (${lineIndex + 1})`
                const lineCurrency = line?.currency ?? currency
                return (
                  <tr key={row.key} aria-label={rowLabel}>
                    <td className="pr-2">
                      <Controller
                        control={control}
                        name={`${name}.code`}
                        render={({ field }) => (
                          <Select
                            items={chargeItems}
                            value={field.value}
                            onValueChange={(value) =>
                              value && field.onChange(value)
                            }
                            disabled={disabled}
                          >
                            <SelectTrigger
                              className="w-full"
                              aria-label={`${t("quote.code")} ${lineIndex + 1}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {chargeItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </td>
                    <td className="pr-2">
                      <Input
                        aria-label={`${t("quote.description")} ${lineIndex + 1}`}
                        disabled={disabled}
                        {...register(`${name}.description`)}
                      />
                    </td>
                    <td className="pr-2">
                      <Controller
                        control={control}
                        name={`${name}.basis`}
                        render={({ field }) => (
                          <Select
                            items={basisItems}
                            value={field.value}
                            onValueChange={(value) => {
                              if (!value) return
                              field.onChange(value)
                              // A new basis means a new quantity.
                              setValue(
                                `${name}.quantity`,
                                calcLineQuantity(value as UnitBasis, measures),
                                { shouldDirty: true }
                              )
                            }}
                            disabled={disabled}
                          >
                            <SelectTrigger
                              className="w-full"
                              aria-label={`${t("quote.basis")} ${lineIndex + 1}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {basisItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </td>
                    {(["quantity", "buyPrice", "sellPrice"] as const).map(
                      (key) => (
                        <td key={key} className="pr-2">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            inputMode="decimal"
                            aria-label={`${t(`quote.${key}`)} ${lineIndex + 1}`}
                            aria-invalid={lineErrors?.[key] ? true : undefined}
                            disabled={disabled}
                            className="tabular-nums"
                            {...register(`${name}.${key}`, {
                              valueAsNumber: true,
                            })}
                          />
                        </td>
                      )
                    )}
                    <td className="pr-2">
                      <Controller
                        control={control}
                        name={`${name}.currency`}
                        render={({ field }) => (
                          <Select
                            items={currencyItems}
                            value={field.value}
                            onValueChange={(value) =>
                              value && field.onChange(value)
                            }
                            disabled={disabled}
                          >
                            <SelectTrigger
                              className="w-full"
                              aria-label={`${t("quote.lineCurrency")} ${lineIndex + 1}`}
                            >
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
                    </td>
                    <td className="text-right tabular-nums">
                      {formatMoney(totals.sell, lineCurrency, i18n.language)}
                    </td>
                    <td
                      className={cn(
                        "text-right tabular-nums",
                        totals.profit < 0 && "text-destructive"
                      )}
                    >
                      {formatMoney(totals.profit, lineCurrency, i18n.language)}
                    </td>
                    <td className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled || fields.length === 1}
                        aria-label={t("quote.removeLine", { name: rowLabel })}
                        onClick={() => remove(lineIndex)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {optionErrors?.lines?.root || optionErrors?.lines?.message ? (
          <p className="text-sm text-destructive">
            {t("quote.validation.lines")}
          </p>
        ) : null}
        {!disabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              append(newLine("OTHER", "shipment", currency, measures))
            }
          >
            <PlusIcon data-icon="inline-start" />
            {t("quote.addLine")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
