import { BookUserIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import {
  EmptyValue,
  type FieldTypeDefinition,
  lazyFieldInput,
} from "@/engine/field-types"
import { COUNTRY_CODES } from "@/lib/countries"
import { formatDate } from "@/lib/format"
import i18n from "@/lib/i18n"

import {
  maskPassportNumber,
  passportValidity,
  type PassportValidity,
  type PassportValue,
} from "../lib/passport"
import { DATE_PATTERN } from "./shared"

const passportMessage = {
  error: () => i18n.t("visaFields:validation.passport"),
}

const passportSchema = z
  .object({
    number: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{5,12}$/i, passportMessage)
      .transform((value) => value.toUpperCase()),
    issuingCountry: z.enum(
      COUNTRY_CODES as [string, ...string[]],
      passportMessage
    ),
    issuedAt: z.string().regex(DATE_PATTERN).nullish(),
    expiresAt: z.string().regex(DATE_PATTERN, passportMessage),
  })
  .refine((value) => !value.issuedAt || value.issuedAt < value.expiresAt, {
    error: () => i18n.t("visaFields:validation.passportDates"),
  })

export function toPassport(value: unknown): PassportValue | null {
  const parsed = passportSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const today = () => new Date().toISOString().slice(0, 10)

export const VALIDITY_VARIANT: Record<
  PassportValidity,
  "secondary" | "destructive" | "outline"
> = {
  ok: "secondary",
  expiresSoon: "outline",
  insufficient: "destructive",
  expired: "destructive",
  missing: "outline",
}

export function PassportValidityBadge({
  validity,
}: {
  validity: PassportValidity
}) {
  const { t } = useTranslation("visaFields")
  return (
    <Badge variant={VALIDITY_VARIANT[validity]}>
      {t(`passport.validity.${validity}`)}
    </Badge>
  )
}

/** Masked number + validity badge (6-month rule, no destination). */
function PassportCell({ value }: { value: unknown }) {
  const passport = toPassport(value)
  if (!passport) return <EmptyValue />
  const validity = passportValidity(passport, { today: today() })
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-sm">
        {maskPassportNumber(passport.number)}
      </span>
      {validity !== "ok" && <PassportValidityBadge validity={validity} />}
    </span>
  )
}

export const passportFieldType: FieldTypeDefinition<PassportValue> = {
  type: "passport",
  icon: BookUserIcon,
  toZod: () => passportSchema,
  isEmpty: (value) => toPassport(value) === null,
  toComparable: (value) => toPassport(value)?.expiresAt ?? null,
  format: (value, { language }) =>
    `${maskPassportNumber(value.number)} · ${i18n.t(
      "visaFields:passport.expiresOn",
      {
        lng: language,
        date: formatDate(`${value.expiresAt}T00:00:00`, language),
      }
    )}`,
  filterOperators: ["isEmpty", "isNotEmpty"],
  sortable: true,
  creatable: false,
  Cell: PassportCell,
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.PassportInput)
  ),
}
