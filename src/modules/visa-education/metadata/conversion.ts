import type { RecordValues } from "@/engine/metadata"
import type { LeadConversionDef } from "@/engine/modules"

import { t } from "../lib/constants"

const serviceIn = (...values: string[]) => [
  { field: "serviceType", op: "in" as const, value: values },
]

const firstOf = (value: unknown) =>
  Array.isArray(value) && typeof value[0] === "string" ? value[0] : null

/**
 * B2C conversion (B8.4): an enquiry becomes an applicant (contact without a
 * company) plus a school and/or visa application, preselected by service.
 */
export const visaEducationConversion: LeadConversionDef = {
  companyOptional: true,
  contactValues: { personRoles: ["applicant"] },
  targets: [
    {
      objectKey: "enrollment",
      label: t("Okul başvurusu aç", "Open a school application"),
      defaultWhen: serviceIn("education", "both"),
      values: (lead: RecordValues) => ({ intake: lead.desiredIntake ?? null }),
    },
    {
      objectKey: "visaApplication",
      label: t("Vize başvurusu aç", "Open a visa application"),
      defaultWhen: serviceIn("visa", "both"),
      values: (lead: RecordValues) => ({
        destinationCountry: firstOf(lead.targetCountries),
        visaCategory:
          lead.visaCategory ?? (lead.serviceType === "both" ? "student" : null),
      }),
    },
  ],
}
