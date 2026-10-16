import type {
  MessageTemplateDef,
  MessageTriggerDef,
  TemplateVariable,
} from "@/engine/messaging"

import { t } from "./lib/constants"

/*
 * WhatsApp utility templates of the visa & education module (B8.9):
 * transactional updates about the applicant's own file. A refusal is never
 * spelled out in a message — the consultant shares the decision personally.
 * Bump the `_vN` suffix whenever a text changes.
 */

const recipient: TemplateVariable = {
  source: { kind: "recipient", field: "firstName" },
  example: t("Ayşe", "Sarah"),
}
const field = (key: string, tr: string, en: string = tr): TemplateVariable => ({
  source: { kind: "field", field: key },
  example: t(tr, en),
})
const event = (key: string, tr: string, en: string = tr): TemplateVariable => ({
  source: { kind: "event", field: key },
  example: t(tr, en),
})
const visaNo = field("applicationNumber", "VSA-2026-0042")
const enrollmentNo = field("enrollmentNumber", "ENR-2026-0042")

const FOOTER = t("Yanıtlayarak bize ulaşabilirsiniz.", "Reply to reach us.")

function template(
  def: Omit<MessageTemplateDef, "category" | "content"> & {
    header: { tr: string; en: string }
    body: { tr: string; en: string }
  }
): MessageTemplateDef {
  const { header, body, ...rest } = def
  return {
    ...rest,
    category: "utility",
    content: {
      tr: { header: header.tr, body: body.tr, footer: FOOTER.tr },
      en: { header: header.en, body: body.en, footer: FOOTER.en },
    },
  }
}

function paymentDue(
  id: string,
  name: string,
  objectKey: string,
  number: TemplateVariable
) {
  return template({
    id,
    name,
    objectKey,
    label: t("Taksit hatırlatması", "Instalment reminder"),
    header: t("Ödeme hatırlatması", "Payment reminder"),
    body: t(
      "Merhaba {{1}}, {{2}} dosyanıza ait {{3}} tutarındaki taksitin son ödeme tarihi {{4}}. Ödemenizi yaptıysanız bu mesajı dikkate almayınız.",
      "Hello {{1}}, the instalment of {{3}} for your file {{2}} is due on {{4}}. Please ignore this message if you have already paid."
    ),
    variables: [
      recipient,
      number,
      event("amount", "15.000 ₺", "₺15,000"),
      event("dueDate", "20.11.2026", "11/20/2026"),
    ],
  })
}

export const visaEducationMessageTemplates: MessageTemplateDef[] = [
  template({
    id: "visa-education.inquiryReceived",
    name: "ved_inquiry_received_v1",
    objectKey: "lead",
    label: t("Danışmanlık talebi alındı", "Enquiry received"),
    header: t("Talebiniz alındı", "Enquiry received"),
    body: t(
      "Merhaba {{1}}, {{2}} olarak danışmanlık talebinizi aldık. Danışmanımız 24 saat içinde sizinle iletişime geçecek.",
      "Hello {{1}}, {{2}} has received your enquiry. A consultant will contact you within 24 hours."
    ),
    variables: [
      recipient,
      {
        source: { kind: "workspace", field: "name" },
        example: t("Atlas Yurtdışı Eğitim", "Atlas Study Abroad"),
      },
    ],
  }),
  template({
    id: "visa-education.documentsRequested",
    name: "ved_documents_requested_v1",
    objectKey: "visaApplication",
    label: t("Vize dosyası: eksik belgeler", "Visa file: missing documents"),
    header: t("Eksik belgeler", "Missing documents"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı vize dosyanız için {{3}} belge eksik. Belgelerinizi bu numaraya yanıt olarak iletebilirsiniz.",
      "Hello {{1}}, {{3}} documents are still missing for your visa file {{2}}. You can send them by replying to this number."
    ),
    variables: [recipient, visaNo, event("count", "3")],
  }),
  template({
    id: "visa-education.schoolDocumentsRequested",
    name: "ved_school_documents_requested_v1",
    objectKey: "enrollment",
    label: t(
      "Okul başvurusu: eksik belgeler",
      "School application: missing documents"
    ),
    header: t("Eksik belgeler", "Missing documents"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı okul başvurunuz için {{3}} belge eksik. Belgelerinizi bu numaraya yanıt olarak iletebilirsiniz.",
      "Hello {{1}}, {{3}} documents are still missing for your school application {{2}}. You can send them by replying to this number."
    ),
    variables: [recipient, enrollmentNo, event("count", "2")],
  }),
  template({
    id: "visa-education.appointmentScheduled",
    name: "ved_appointment_scheduled_v1",
    objectKey: "appointment",
    label: t("Vize randevusu oluşturuldu", "Visa appointment booked"),
    header: t("Randevunuz oluşturuldu", "Appointment booked"),
    body: t(
      "Merhaba {{1}}, vize randevunuz {{2}} tarihinde {{3}} için oluşturuldu. Randevuya pasaportunuz ve belgelerinizin asıllarıyla gidiniz.",
      "Hello {{1}}, your visa appointment is booked for {{2}} at {{3}}. Please bring your passport and original documents."
    ),
    variables: [
      recipient,
      field("scheduledAt", "12.11.2026 09:30", "11/12/2026 9:30 AM"),
      field("title", "VFS Global · İstanbul"),
    ],
  }),
  template({
    id: "visa-education.appointmentReminder",
    name: "ved_appointment_reminder_v1",
    objectKey: "appointment",
    label: t("Randevu hatırlatması", "Appointment reminder"),
    header: t("Randevu hatırlatması", "Appointment reminder"),
    body: t(
      "Merhaba {{1}}, {{2}} tarihindeki {{3}} randevunuzu hatırlatırız. Belgelerinizi kontrol etmeyi unutmayın.",
      "Hello {{1}}, this is a reminder of your appointment at {{3}} on {{2}}. Please check your documents."
    ),
    variables: [
      recipient,
      field("scheduledAt", "12.11.2026 09:30", "11/12/2026 9:30 AM"),
      field("title", "VFS Global · İstanbul"),
    ],
  }),
  template({
    id: "visa-education.visaSubmitted",
    name: "ved_visa_submitted_v1",
    objectKey: "visaApplication",
    label: t("Vize başvurusu teslim edildi", "Visa application submitted"),
    header: t("Başvurunuz teslim edildi", "Application submitted"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı vize başvurunuz {{3}} için teslim edildi. Sonuç geldiğinde size haber vereceğiz.",
      "Hello {{1}}, your visa application {{2}} for {{3}} has been submitted. We will let you know once there is a decision."
    ),
    variables: [
      recipient,
      visaNo,
      field("destinationCountry", "Fransa", "France"),
    ],
  }),
  template({
    id: "visa-education.schoolApplicationSubmitted",
    name: "ved_school_application_submitted_v1",
    objectKey: "enrollment",
    label: t("Okul başvurusu yapıldı", "School application sent"),
    header: t("Başvurunuz iletildi", "Application sent"),
    body: t(
      "Merhaba {{1}}, {{2}} programına başvurunuz okula iletildi. Gelişmeleri bu numaradan paylaşacağız.",
      "Hello {{1}}, your application to {{2}} has been sent to the school. We will share updates on this number."
    ),
    variables: [recipient, field("programId", "MSc Data Science")],
  }),
  template({
    id: "visa-education.offerReceived",
    name: "ved_offer_received_v1",
    objectKey: "enrollment",
    label: t("Okuldan kabul geldi", "Offer received"),
    header: t("Kabul aldınız", "You have an offer"),
    body: t(
      "Merhaba {{1}}, tebrikler! {{2}} programından kabul aldınız. Sonraki adımlar için danışmanınız sizi arayacak.",
      "Hello {{1}}, congratulations! You have received an offer from {{2}}. Your consultant will call you about the next steps."
    ),
    variables: [recipient, field("programId", "MSc Data Science")],
  }),
  template({
    id: "visa-education.visaApproved",
    name: "ved_visa_approved_v1",
    objectKey: "visaApplication",
    label: t("Vize onaylandı", "Visa approved"),
    header: t("Vizeniz onaylandı", "Your visa is approved"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı vize başvurunuz onaylandı. Pasaportunuzu teslim almak için danışmanınız sizinle iletişime geçecek.",
      "Hello {{1}}, your visa application {{2}} has been approved. Your consultant will contact you about collecting your passport."
    ),
    variables: [recipient, visaNo],
  }),
  template({
    id: "visa-education.visaDecisionReady",
    name: "ved_visa_decision_ready_v1",
    objectKey: "visaApplication",
    label: t(
      "Vize sonucu geldi (sonuç yazılmaz)",
      "Visa decision ready (no outcome)"
    ),
    header: t("Başvurunuz sonuçlandı", "Decision available"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı vize başvurunuz sonuçlandı. Danışmanınız sonucu sizinle bizzat paylaşacak.",
      "Hello {{1}}, there is a decision on your visa application {{2}}. Your consultant will share it with you personally."
    ),
    variables: [recipient, visaNo],
  }),
  paymentDue(
    "visa-education.enrollmentPaymentDue",
    "ved_payment_due_v1",
    "enrollment",
    enrollmentNo
  ),
  paymentDue(
    "visa-education.visaPaymentDue",
    "ved_visa_payment_due_v1",
    "visaApplication",
    visaNo
  ),
]

export const visaEducationMessageTriggers: MessageTriggerDef[] = [
  {
    id: "visa-education.webFormLead",
    event: "lead.created",
    match: { source: "webForm" },
    templateId: "visa-education.inquiryReceived",
    label: t(
      "Web formundan danışmanlık talebi geldiğinde",
      "When an enquiry arrives from a web form"
    ),
  },
  {
    id: "visa-education.documentsRequested",
    event: "checklist.requested",
    match: { object: "visaApplication" },
    templateId: "visa-education.documentsRequested",
    label: t(
      "Vize dosyası için eksik belge istendiğinde",
      "When visa documents are requested"
    ),
  },
  {
    id: "visa-education.schoolDocumentsRequested",
    event: "checklist.requested",
    match: { object: "enrollment" },
    templateId: "visa-education.schoolDocumentsRequested",
    label: t(
      "Okul başvurusu için eksik belge istendiğinde",
      "When school documents are requested"
    ),
  },
  {
    id: "visa-education.appointmentScheduled",
    event: "appointment.created",
    templateId: "visa-education.appointmentScheduled",
    label: t(
      "Vize randevusu oluşturulduğunda",
      "When a visa appointment is booked"
    ),
  },
  {
    id: "visa-education.appointmentReminder",
    event: "appointment.reminder",
    templateId: "visa-education.appointmentReminder",
    label: t("Randevudan 2 gün önce", "Two days before an appointment"),
  },
  {
    id: "visa-education.visaSubmitted",
    event: "visa.stage",
    match: { stage: "submitted" },
    templateId: "visa-education.visaSubmitted",
    label: t(
      "Vize başvurusu teslim edildiğinde",
      "When a visa application is submitted"
    ),
  },
  {
    id: "visa-education.visaApproved",
    event: "visa.stage",
    match: { stage: "approved" },
    templateId: "visa-education.visaApproved",
    label: t("Vize onaylandığında", "When a visa is approved"),
  },
  {
    id: "visa-education.visaRefused",
    event: "visa.stage",
    match: { stage: "refused" },
    templateId: "visa-education.visaDecisionReady",
    label: t(
      'Vize reddedildiğinde (yalnız "sonuç geldi")',
      'When a visa is refused ("decision available" only)'
    ),
  },
  {
    id: "visa-education.schoolApplied",
    event: "enrollment.stage",
    match: { stage: "applied" },
    templateId: "visa-education.schoolApplicationSubmitted",
    label: t(
      "Okula başvuru yapıldığında",
      "When the school application is sent"
    ),
  },
  {
    id: "visa-education.conditionalOffer",
    event: "enrollment.stage",
    match: { stage: "conditional_offer" },
    templateId: "visa-education.offerReceived",
    label: t("Şartlı kabul geldiğinde", "When a conditional offer arrives"),
  },
  {
    id: "visa-education.unconditionalOffer",
    event: "enrollment.stage",
    match: { stage: "unconditional_offer" },
    templateId: "visa-education.offerReceived",
    label: t("Kesin kabul geldiğinde", "When an unconditional offer arrives"),
  },
  {
    id: "visa-education.enrollmentPaymentDue",
    event: "installment.due",
    match: { object: "enrollment" },
    templateId: "visa-education.enrollmentPaymentDue",
    label: t(
      "Okul dosyası taksitinden 3 gün önce",
      "Three days before a school-file instalment"
    ),
  },
  {
    id: "visa-education.visaPaymentDue",
    event: "installment.due",
    match: { object: "visaApplication" },
    templateId: "visa-education.visaPaymentDue",
    label: t(
      "Vize dosyası taksitinden 3 gün önce",
      "Three days before a visa-file instalment"
    ),
  },
]
