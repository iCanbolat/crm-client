import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, PrinterIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "@tanstack/react-router"

import { Button, buttonVariants } from "@/components/ui/button"
import { formatMoney } from "@/lib/currencies"
import { formatDate, formatNumber } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import type { Quote } from "../../api/quotes.schemas"
import { referenceQueries } from "../../api/reference.queries"
import {
  CHARGE_LABELS,
  INCOTERM_OPTIONS,
  TRANSPORT_MODE_LABELS,
  UNIT_BASIS_LABELS,
} from "../../lib/constants"
import { calcLine, calcQuoteTotals } from "../../lib/quote"
import { formatContainers } from "../../field-types"
import { formatLocation } from "../../field-types"
import { optionLetter } from "../../lib/quote-form"

interface QuotePrintViewProps {
  quote: Quote
  workspaceName: string
}

/**
 * Customer facing print / PDF preview (B3.4). Only selling prices: buying
 * prices and margins never leave the house. Print CSS hides the app shell.
 */
export function QuotePrintView({ quote, workspaceName }: QuotePrintViewProps) {
  const { t, i18n } = useTranslation("forwarding")
  const language = i18n.language === "en" ? "en" : "tr"
  const fx = useQuery(referenceQueries.fxRates())
  const money = (amount: number, currency: string) =>
    formatMoney(amount, currency, i18n.language)
  const incoterm = INCOTERM_OPTIONS.find(
    (item) => item.value === quote.incoterm
  )
  // The offered option first, alternatives after it.
  const ordered = [
    ...quote.options.filter((item) => item.id === quote.selectedOptionId),
    ...quote.options.filter((item) => item.id !== quote.selectedOptionId),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link
          to="/quotes/$quoteId"
          params={{ quoteId: quote.id }}
          search={{ version: quote.version }}
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("quote.back")}
        </Link>
        <Button onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" />
          {t("quote.printNow")}
        </Button>
      </div>

      <article
        aria-label={t("quote.printHeader")}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl bg-card p-8 text-sm shadow-md ring-1 ring-foreground/5 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-lg font-semibold">{workspaceName}</p>
            <h1 className="font-heading text-2xl font-semibold">
              {t("quote.printHeader")}
            </h1>
          </div>
          <div className="text-right">
            <p className="font-mono text-base">
              {quote.quoteNumber} · v{quote.version}
            </p>
            <p>{formatDate(quote.createdAt, i18n.language)}</p>
            <p>
              {t("quote.printValid", {
                date: formatDate(quote.validUntil, i18n.language),
              })}
            </p>
          </div>
        </header>

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.company")}
            </dt>
            <dd className="font-medium">
              {quote.refs.companyId?.label ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.contact")}
            </dt>
            <dd>{quote.refs.contactId?.label ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.origin")}
            </dt>
            <dd>{formatLocation(quote.origin)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.destination")}
            </dt>
            <dd>{formatLocation(quote.destination)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.transportMode")}
            </dt>
            <dd>
              {resolveI18nText(
                TRANSPORT_MODE_LABELS[quote.transportMode],
                language
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.incoterm")}
            </dt>
            <dd>
              {incoterm ? resolveI18nText(incoterm.label, language) : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">
              {t("quote.cargo")}
            </dt>
            <dd>
              {[
                quote.cargo.commodity,
                quote.cargo.containers?.length
                  ? formatContainers(quote.cargo.containers)
                  : null,
                quote.cargo.grossKg
                  ? `${formatNumber(quote.cargo.grossKg, i18n.language)} kg`
                  : null,
                quote.cargo.cbm
                  ? `${formatNumber(quote.cargo.cbm, i18n.language, { maximumFractionDigits: 3 })} m³`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </dd>
          </div>
        </dl>

        {ordered.map((option) => {
          const index = quote.options.indexOf(option)
          const totals = fx.data
            ? calcQuoteTotals(option.lines, quote.currency, fx.data.rates)
            : null
          return (
            <section
              key={option.id}
              className="flex break-inside-avoid flex-col gap-2"
            >
              <h2 className="text-base font-semibold">
                {t("quote.optionTab", {
                  letter: optionLetter(index),
                  carrier: option.carrier,
                })}
              </h2>
              {option.transitDays ? (
                <p className="text-muted-foreground">
                  {t("quote.printTransit", { days: option.transitDays })}
                </p>
              ) : null}
              <table className="w-full text-left">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 font-medium">{t("quote.code")}</th>
                    <th className="py-1 font-medium">{t("quote.basis")}</th>
                    <th className="py-1 text-right font-medium">
                      {t("quote.quantity")}
                    </th>
                    <th className="py-1 text-right font-medium">
                      {t("quote.sellPrice")}
                    </th>
                    <th className="py-1 text-right font-medium">
                      {t("quote.lineSell")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {option.lines.map((line) => (
                    <tr key={line.id} className="border-b last:border-0">
                      <td className="py-1">
                        {resolveI18nText(CHARGE_LABELS[line.code], language)}
                        {line.description ? (
                          <span className="block text-xs text-muted-foreground">
                            {line.description}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1">
                        {resolveI18nText(
                          UNIT_BASIS_LABELS[line.basis],
                          language
                        )}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {formatNumber(line.quantity, i18n.language)}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {money(line.sellPrice, line.currency)}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {money(calcLine(line).sell, line.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals ? (
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="pt-2" colSpan={4}>
                        {t("quote.printTotal")}
                      </td>
                      <td className="pt-2 text-right tabular-nums">
                        {money(totals.sell, quote.currency)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </section>
          )
        })}

        <footer className="border-t pt-4 text-xs text-muted-foreground">
          {t("quote.printFooter")}
        </footer>
      </article>
    </div>
  )
}
