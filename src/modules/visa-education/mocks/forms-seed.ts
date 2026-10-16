import type { FormBlockDef, FormContent, FormField } from "@/engine/forms"
import { createStarterContent } from "@/features/form-builder"
import { seedVersion } from "@/features/form-builder/mocks/seed"
import type { FormRow, FormSeed } from "@/features/form-builder/mocks/types"
import { MOCK_REFERENCE_DATE } from "@/mocks/db/faker"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"

import { visaEducationFormBlocks } from "../form-blocks"
import { t } from "../lib/constants"

const daysAgo = (days: number) =>
  new Date(MOCK_REFERENCE_DATE.getTime() - days * 86_400_000).toISOString()

const block = (id: string) =>
  visaEducationFormBlocks.find((item) => item.id === `visa.${id}`)!

export const ATLAS_FORM_IDS = {
  study: "form_atlas_study",
  visa: "form_atlas_visa",
} as const

function place(content: FormContent, def: FormBlockDef, stepId: string) {
  for (const { mapTo, width, ...field } of def.fields) {
    if (content.fields.some((item) => item.key === field.key)) continue
    const placed: FormField = {
      ...structuredClone(field),
      id: `fld_${field.key}`,
      stepId,
      width: width ?? "full",
      blockId: def.id,
    }
    content.fields.push(placed)
    if (mapTo) content.mapping.fields[placed.id] = mapTo
  }
}

/** Contact step + a hidden service type that routes the enquiry. */
function baseContent(serviceType: "education" | "visa") {
  const content = createStarterContent()
  content.steps = [
    { id: "step1", title: t("İletişim bilgileri", "Contact details") },
    {
      id: "step2",
      title:
        serviceType === "education"
          ? t("Eğitim hedefleriniz", "Your study plans")
          : t("Seyahat bilgileri", "Travel details"),
    },
  ]
  const consent = content.fields.find((field) => field.type === "consent")!
  content.fields = content.fields.filter(
    (field) =>
      field.type !== "consent" &&
      field.key !== "message" &&
      field.key !== "companyName"
  )
  delete content.mapping.fields.fld_message
  delete content.mapping.fields.fld_companyName
  content.fields.push({
    id: "fld_serviceType",
    key: "serviceType",
    type: "hidden",
    stepId: "step1",
    label: t("Hizmet", "Service"),
    width: "full",
    prefill: { kind: "static", value: serviceType },
  })
  content.mapping.fields.fld_serviceType = "serviceType"
  return { content, consent }
}

function studyContent(): FormContent {
  const { content, consent } = baseContent("education")
  place(content, block("targetStudy"), "step2")
  place(content, block("language"), "step2")
  place(content, block("education"), "step2")
  content.fields.push({ ...consent, stepId: "step2" })
  content.settings.successMessage = t(
    "Teşekkürler! Eğitim danışmanımız 24 saat içinde sizi arayacak.",
    "Thank you! An education counsellor will call you within 24 hours."
  )
  content.settings.submitLabel = t("Ön başvuruyu gönder", "Send my enquiry")
  content.settings.notifyEmails = ["egitim@atlas.test"]
  content.theme.primaryColor = "#1d4ed8"
  return content
}

function visaContent(): FormContent {
  const { content, consent } = baseContent("visa")
  place(content, block("visaRequest"), "step2")
  place(content, block("passport"), "step2")
  content.fields.push({ ...consent, stepId: "step2" })
  content.settings.successMessage = t(
    "Teşekkürler! Vize danışmanımız en kısa sürede size ulaşacak.",
    "Thank you! A visa consultant will contact you shortly."
  )
  content.settings.submitLabel = t(
    "Danışmanlık talep et",
    "Request a consultation"
  )
  content.settings.notifyEmails = ["vize@atlas.test"]
  content.theme.primaryColor = "#1d4ed8"
  return content
}

/** Published forms of Atlas Yurtdışı Eğitim (Faz 8). */
export function seedVisaEducationForms(): FormSeed {
  const study: FormRow = {
    id: ATLAS_FORM_IDS.study,
    workspaceId: WORKSPACE_IDS.atlas,
    name: "Yurtdışı Eğitim Ön Başvuru",
    slug: "yurtdisi-egitim-on-basvuru",
    status: "published",
    publishedVersion: 1,
    draft: studyContent(),
    ownerId: SEED_USERS.atlasOwner.id,
    createdAt: daysAgo(160),
    updatedAt: daysAgo(160),
    views: 1240,
  }
  const visa: FormRow = {
    id: ATLAS_FORM_IDS.visa,
    workspaceId: WORKSPACE_IDS.atlas,
    name: "Vize Danışmanlık Talebi",
    slug: "vize-danismanlik",
    status: "published",
    publishedVersion: 1,
    draft: visaContent(),
    ownerId: SEED_USERS.atlasOwner.id,
    createdAt: daysAgo(150),
    updatedAt: daysAgo(150),
    views: 610,
  }
  return {
    forms: [study, visa],
    versions: [
      seedVersion(study, 1, studyContent(), 160),
      seedVersion(visa, 1, visaContent(), 150),
    ],
  }
}
