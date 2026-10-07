import { AlarmClockIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RecordSlotProps } from "@/engine/modules"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

import { dayDiff, getDelay } from "../../lib/milestones"

const day = (value: unknown) =>
  typeof value === "string" && value ? value.slice(0, 10) : null

/** Local calendar day (`yyyy-MM-dd`). */
function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const date = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${date}`
}

/**
 * Plan vs actual (`shipment.detail.sidebar`, B3.5): ETD/ETA against ATD/ATA
 * with the deviation in days and a delay badge once the ETA has passed.
 */
export function ScheduleCard({ record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("forwarding")
  const { values } = record
  const dates = {
    etd: day(values.etd),
    eta: day(values.eta),
    atd: day(values.atd),
    ata: day(values.ata),
  }
  const delivered = values.status === "DELIVERED"
  const delay = getDelay(dates, today())
  const delayed = !delivered && delay.delayed

  const rows = [
    { key: "departure", planned: dates.etd, actual: dates.atd },
    { key: "arrival", planned: dates.eta, actual: dates.ata },
  ] as const

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <h2>{t("shipment.schedule")}</h2>
        </CardTitle>
        {delayed ? (
          <Badge variant="destructive">
            <AlarmClockIcon aria-hidden />
            {t("shipment.delayed")}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          {rows.map((row) => {
            const deviation =
              row.planned && row.actual
                ? dayDiff(row.planned, row.actual)
                : null
            return (
              <div key={row.key} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {t(`shipment.${row.key}`)}
                </dt>
                <dd className="flex flex-wrap items-baseline gap-x-2">
                  <span>
                    {row.planned ? formatDate(row.planned, i18n.language) : "—"}
                  </span>
                  <span aria-hidden>→</span>
                  <span className="font-medium">
                    {row.actual
                      ? formatDate(row.actual, i18n.language)
                      : t("shipment.notYet")}
                  </span>
                  {deviation !== null ? (
                    <span
                      className={cn(
                        "text-xs",
                        deviation > 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {deviation > 0
                        ? t("shipment.late", { count: deviation })
                        : deviation < 0
                          ? t("shipment.early", { count: -deviation })
                          : t("shipment.onTime")}
                    </span>
                  ) : null}
                </dd>
              </div>
            )
          })}
        </dl>
      </CardContent>
    </Card>
  )
}
