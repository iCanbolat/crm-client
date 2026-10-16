import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RecordSlotProps } from "@/engine/modules"
import { getCountryName } from "@/lib/countries"
import { resolveI18nText } from "@/lib/i18n-text"

import { toLanguageScores } from "../field-types/language-score"
import { PassportValidityBadge, toPassport } from "../field-types/passport"
import {
  SERVICE_TYPE_LABELS,
  STUDY_LEVEL_LABELS,
  type ServiceType,
  type StudyLevel,
} from "../lib/constants"
import { formatIntake, toIntake } from "../lib/intake"
import { bestScore, formatScore, isScoreExpired } from "../lib/language"
import { passportValidity } from "../lib/passport"

const today = () => new Date().toISOString().slice(0, 10)

function ageOf(dateOfBirth: unknown) {
  if (typeof dateOfBirth !== "string" || !dateOfBirth) return null
  const birth = new Date(`${dateOfBirth}T00:00:00Z`)
  const now = new Date()
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() &&
      now.getUTCDate() < birth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  )
}

/** Language score + passport rows shared by the lead and contact cards. */
function ProfileRows({
  values,
  destination,
}: {
  values: Record<string, unknown>
  destination?: string | null
}) {
  const { t } = useTranslation("visaEducation")
  const best = bestScore(toLanguageScores(values.languageScores))
  const passport = toPassport(values.passport)
  return (
    <>
      <Row label={t("profile.language")}>
        {best ? (
          <span className="inline-flex items-center gap-1.5">
            {formatScore(best.score)}
            {best.cefr ? <Badge variant="secondary">{best.cefr}</Badge> : null}
            {isScoreExpired(best.score, today()) ? (
              <Badge variant="outline">{t("profile.expired")}</Badge>
            ) : null}
          </span>
        ) : (
          "—"
        )}
      </Row>
      <Row label={t("profile.passport")}>
        <PassportValidityBadge
          validity={passportValidity(passport, {
            today: today(),
            destination: destination ?? null,
          })}
        />
      </Row>
    </>
  )
}

/** Enquiry at a glance (`lead.detail.sidebar`, B8.4). */
export function EnquirySummaryCard({ record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("visaEducation")
  const language = i18n.language === "en" ? "en" : "tr"
  const { values } = record
  const service = values.serviceType as ServiceType | undefined
  if (!service) return null
  const countries = Array.isArray(values.targetCountries)
    ? (values.targetCountries as string[])
    : []
  const intake = toIntake(values.desiredIntake)
  const level = values.studyLevel as StudyLevel | undefined

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{t("profile.enquiryTitle")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2 text-sm">
          <Row label={t("profile.service")}>
            <Badge variant="secondary">
              {resolveI18nText(SERVICE_TYPE_LABELS[service], language)}
            </Badge>
          </Row>
          {countries.length ? (
            <Row label={t("profile.countries")}>
              {countries
                .map((code) => getCountryName(code, language))
                .join(", ")}
            </Row>
          ) : null}
          {level && STUDY_LEVEL_LABELS[level] ? (
            <Row label={t("profile.level")}>
              {resolveI18nText(STUDY_LEVEL_LABELS[level], language)}
            </Row>
          ) : null}
          {intake ? (
            <Row label={t("profile.intake")}>
              {formatIntake(intake, language)}
            </Row>
          ) : null}
          <ProfileRows values={values} destination={countries[0]} />
        </dl>
      </CardContent>
    </Card>
  )
}

/** Applicant profile (`contact.detail.sidebar`, B8.4). */
export function ApplicantProfileCard({ record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("visaEducation")
  const language = i18n.language === "en" ? "en" : "tr"
  const { values } = record
  const roles = Array.isArray(values.personRoles)
    ? (values.personRoles as string[])
    : []
  if (!roles.includes("applicant")) return null
  const age = ageOf(values.dateOfBirth)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{t("profile.applicantTitle")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2 text-sm">
          {age !== null ? (
            <Row label={t("profile.age")}>{t("profile.ageValue", { age })}</Row>
          ) : null}
          {typeof values.nationality === "string" && values.nationality ? (
            <Row label={t("profile.nationality")}>
              {getCountryName(values.nationality, language)}
            </Row>
          ) : null}
          <ProfileRows values={values} />
        </dl>
      </CardContent>
    </Card>
  )
}
