import { Link } from "@tanstack/react-router"
import { FilePenLineIcon, PrinterIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MoneyValue } from "@/engine/field-types"
import type { RecordSlotProps } from "@/engine/modules"
import { formatMoney } from "@/lib/currencies"
import { cn } from "@/lib/utils"

import { MIN_MARGIN_PERCENT } from "../../lib/constants"

const money = (value: unknown): MoneyValue | null =>
  value && typeof value === "object" && "amount" in value
    ? (value as MoneyValue)
    : null

/** `quote.detail.main` slot: the builder is where a quote is edited. */
export function QuoteSummaryCard({ record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("forwarding")
  const { values } = record
  const sell = money(values.totalSell)
  const margin =
    typeof values.marginPercent === "number" ? values.marginPercent : null
  const version =
    typeof values.version === "number" ? values.version : undefined

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{t("quote.summary")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.selectedCarrier")}
            </dt>
            <dd className="font-medium">{String(values.carrier ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.totalSell")}
            </dt>
            <dd className="font-medium tabular-nums">
              {sell
                ? formatMoney(sell.amount, sell.currency, i18n.language)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("quote.margin")}
            </dt>
            <dd
              className={cn(
                "font-medium tabular-nums",
                margin !== null &&
                  margin < MIN_MARGIN_PERCENT &&
                  "text-destructive"
              )}
            >
              {margin !== null
                ? `%${margin.toLocaleString(i18n.language)}`
                : "—"}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/quotes/$quoteId"
            params={{ quoteId: record.id }}
            search={{}}
            className={buttonVariants()}
          >
            <FilePenLineIcon data-icon="inline-start" />
            {t("quote.openBuilder")}
          </Link>
          <Link
            to="/quotes/$quoteId/print"
            params={{ quoteId: record.id }}
            search={{ version }}
            className={buttonVariants({ variant: "outline" })}
          >
            <PrinterIcon data-icon="inline-start" />
            {t("quote.print")}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
