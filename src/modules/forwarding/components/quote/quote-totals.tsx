import { TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney } from "@/lib/currencies"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

import { MIN_MARGIN_PERCENT } from "../../lib/constants"
import { isMarginLow, type QuoteTotals } from "../../lib/quote"

interface QuoteTotalsPanelProps {
  totals: QuoteTotals | null
  ratesDate?: string
}

/** Totals of the offered option: per currency and converted, with margin. */
export function QuoteTotalsPanel({ totals, ratesDate }: QuoteTotalsPanelProps) {
  const { t, i18n } = useTranslation("forwarding")
  // Nothing priced yet: no margin to judge.
  const low = !!totals && totals.sell > 0 && isMarginLow(totals.margin)
  const language = i18n.language
  const money = (amount: number, currency: string) =>
    formatMoney(amount, currency, language)

  return (
    <Card size="sm" aria-labelledby="quote-totals-title">
      <CardHeader>
        <CardTitle>
          <h2 id="quote-totals-title">{t("quote.totals")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {totals ? (
          <>
            {totals.byCurrency.length > 1 ? (
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {t("quote.byCurrency")}
                </h3>
                <ul className="flex flex-col gap-1">
                  {totals.byCurrency.map((item) => (
                    <li
                      key={item.currency}
                      className="flex justify-between gap-2 tabular-nums"
                    >
                      <span>{item.currency}</span>
                      <span>{money(item.sell, item.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <dl className="flex flex-col gap-2">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("quote.totalBuy")}</dt>
                <dd className="tabular-nums">
                  {money(totals.buy, totals.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 text-base font-semibold">
                <dt>{t("quote.totalSell")}</dt>
                <dd className="tabular-nums" data-testid="quote-total-sell">
                  {money(totals.sell, totals.currency)}
                </dd>
              </div>
              <div
                className={cn(
                  "flex justify-between gap-2",
                  low && "text-destructive"
                )}
              >
                <dt>{t("quote.margin")}</dt>
                <dd className="tabular-nums" data-testid="quote-margin">
                  {t("quote.marginValue", {
                    amount: money(totals.margin.amount, totals.currency),
                    percent: totals.margin.percent.toLocaleString(language),
                  })}
                </dd>
              </div>
            </dl>
            {low ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                <TriangleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                {t("quote.lowMargin", { threshold: MIN_MARGIN_PERCENT })}
              </p>
            ) : null}
            {ratesDate &&
            totals.byCurrency.some(
              (item) => item.currency !== totals.currency
            ) ? (
              <p className="text-xs text-muted-foreground">
                {t("quote.convertedNote", {
                  currency: totals.currency,
                  date: formatDate(ratesDate, language),
                })}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
