import { WORKSPACE_IDS, SEED_USERS } from "@/mocks/db/seed"
import { MOCK_REFERENCE_DATE } from "@/mocks/db/faker"

import { createStarterContent } from "../lib/defaults"
import type { FormRow, FormSeed, FormVersionRow } from "./types"

const daysAgo = (days: number) =>
  new Date(MOCK_REFERENCE_DATE.getTime() - days * 86_400_000).toISOString()

export function seedVersion(
  form: FormRow,
  version: number,
  content: unknown,
  publishedDaysAgo: number,
  publishedBy: string = form.ownerId
): FormVersionRow {
  return {
    id: `${form.id}_v${version}`,
    workspaceId: form.workspaceId,
    formId: form.id,
    version,
    content: structuredClone(content),
    publishedAt: daysAgo(publishedDaysAgo),
    publishedBy,
  }
}

/** Contact form, agent application (draft) and a webinar form saved in schema v1. */
export function seedForms(): FormSeed {
  const contact = createStarterContent()
  const contactForm: FormRow = {
    id: "form_contact",
    workspaceId: WORKSPACE_IDS.acme,
    name: "İletişim Formu",
    slug: "iletisim",
    status: "published",
    publishedVersion: 1,
    draft: contact,
    ownerId: SEED_USERS.admin.id,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(118),
    views: 1240,
    submissions: 86,
  }

  const agent = createStarterContent()
  agent.fields = agent.fields.filter((field) => field.key !== "message")
  agent.fields.splice(4, 0, {
    id: "fld_services",
    key: "services",
    type: "checkboxes",
    stepId: "step1",
    label: { tr: "Verdiğiniz hizmetler", en: "Services you provide" },
    width: "full",
    options: [
      { value: "sea", label: { tr: "Deniz yolu", en: "Sea freight" } },
      { value: "air", label: { tr: "Hava yolu", en: "Air freight" } },
      { value: "road", label: { tr: "Kara yolu", en: "Road freight" } },
      { value: "customs", label: { tr: "Gümrükleme", en: "Customs" } },
    ],
  })
  const agentForm: FormRow = {
    id: "form_agent",
    workspaceId: WORKSPACE_IDS.acme,
    name: "Acente Başvuru Formu",
    slug: "acente-basvuru",
    status: "draft",
    publishedVersion: null,
    draft: agent,
    ownerId: SEED_USERS.manager.id,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(2),
    views: 0,
    submissions: 0,
  }

  // Saved before the step/logic model existed (schema v1, TC-4.1-03).
  const webinar = {
    fields: [
      { key: "adSoyad", type: "text", label: "Ad soyad", required: true },
      { key: "eposta", type: "email", label: "E-posta", required: true },
      { key: "firma", type: "text", label: "Firma" },
      {
        key: "oturum",
        type: "radio",
        label: "Katılmak istediğiniz oturum",
        options: ["Gümrük mevzuatı", "Hava kargo trendleri"],
      },
    ],
    submitLabel: "Kayıt ol",
    successMessage: "Kaydınız alındı, bağlantı e-postayla gönderilecek.",
    theme: { color: "#7c3aed" },
  }
  const webinarForm: FormRow = {
    id: "form_webinar",
    workspaceId: WORKSPACE_IDS.acme,
    name: "Webinar Kaydı",
    slug: "webinar-kaydi",
    status: "published",
    publishedVersion: 1,
    draft: webinar,
    ownerId: SEED_USERS.owner.id,
    createdAt: daysAgo(300),
    updatedAt: daysAgo(300),
    views: 610,
    submissions: 50,
  }

  return {
    forms: [contactForm, agentForm, webinarForm],
    versions: [
      seedVersion(contactForm, 1, contact, 118),
      seedVersion(webinarForm, 1, webinar, 300),
    ],
  }
}
