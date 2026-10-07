import { ArrowRightIcon, FlameIcon, SnowflakeIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RecordSlotProps } from "@/engine/modules"
import { formatNumber } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import { calcCbm, calcChargeableWeight } from "../lib/cargo"
import { isTransportMode, TRANSPORT_MODE_LABELS } from "../lib/constants"
import {
  formatContainers,
  formatDangerousGoods,
  toContainers,
  toDangerousGoods,
  toDimensions,
  toLocation,
} from "../field-types"
import { ModeIcon } from "./mode-icon"

const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

/**
 * "Route & cargo" card of a freight request (lead / deal sidebar, B3.3):
 * the lane at a glance and the chargeable weight the carrier will bill.
 */
export function RouteCargoCard({ record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("forwarding")
  const language = i18n.language === "en" ? "en" : "tr"
  const { values } = record
  const mode = isTransportMode(values.transportMode)
    ? values.transportMode
    : null
  const origin = toLocation(values.origin)
  const destination = toLocation(values.destination)
  const dimensions = toDimensions(values.dimensions)
  const containers = toContainers(values.containers)
  const goods = toDangerousGoods(values.dangerousGoods)
  const gross = num(values.grossWeight)
  const cbm = dimensions.length ? calcCbm(dimensions) : num(values.volume)
  const chargeable =
    mode && (gross !== null || cbm !== null)
      ? calcChargeableWeight(mode, gross ?? 0, cbm ?? 0)
      : null
  const format = (value: number, digits = 2) =>
    formatNumber(value, language, { maximumFractionDigits: digits })

  if (!mode && !origin && !destination) return null

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{t("routeCard.title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          className="flex items-center gap-2"
          aria-label={t("routeCard.lane", {
            origin: origin?.name ?? "—",
            destination: destination?.name ?? "—",
          })}
          role="group"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{origin?.name ?? "—"}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {origin?.code ?? ""}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-primary">
            <ModeIcon mode={mode} className="size-4" />
            <ArrowRightIcon className="size-4" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-end text-right">
            <span className="truncate font-medium">
              {destination?.name ?? "—"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {destination?.code ?? ""}
            </span>
          </div>
        </div>
        {mode ? (
          <p className="text-muted-foreground">
            {resolveI18nText(TRANSPORT_MODE_LABELS[mode], language)}
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {containers.length ? (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("routeCard.containers")}
              </dt>
              <dd className="tabular-nums">{formatContainers(containers)}</dd>
            </div>
          ) : null}
          {gross !== null ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("routeCard.gross")}
              </dt>
              <dd className="tabular-nums">{format(gross)} kg</dd>
            </div>
          ) : null}
          {cbm !== null ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("routeCard.volume")}
              </dt>
              <dd className="tabular-nums">{format(cbm, 3)} m³</dd>
            </div>
          ) : null}
          {chargeable ? (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("routeCard.chargeable")}
              </dt>
              <dd className="font-medium tabular-nums">
                {chargeable.unit === "wm"
                  ? `${format(chargeable.value, 3)} W/M`
                  : `${format(chargeable.value)} kg`}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({t(`routeCard.basis.${chargeable.basis}`)})
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
        {goods || values.temperatureControlled === true ? (
          <div className="flex flex-wrap gap-2">
            {goods ? (
              <Badge variant="destructive">
                <FlameIcon aria-hidden />
                {formatDangerousGoods(goods)}
              </Badge>
            ) : null}
            {values.temperatureControlled === true ? (
              <Badge variant="secondary">
                <SnowflakeIcon aria-hidden />
                {t("routeCard.reefer")}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
