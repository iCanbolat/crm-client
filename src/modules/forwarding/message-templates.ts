import type {
  MessageTemplateDef,
  MessageTriggerDef,
  TemplateVariable,
} from "@/engine/messaging"

import { MILESTONE_LABELS, t, type Milestone } from "./lib/constants"

/*
 * WhatsApp utility templates of the forwarding module (Faz 6). They are
 * transactional updates about a request, quote or shipment the customer
 * already has — no promotional content, so Meta keeps them in UTILITY.
 * Bump the `_vN` suffix whenever a text changes: approved templates cannot
 * be edited, a new version is submitted instead.
 */

const recipient: TemplateVariable = {
  source: { kind: "recipient", field: "firstName" },
  example: t("Ayşe", "Sarah"),
}
const shipmentNo: TemplateVariable = {
  source: { kind: "field", field: "shipmentNumber" },
  example: t("SHP-2026-0042", "SHP-2026-0042"),
}
const field = (key: string, tr: string, en: string = tr): TemplateVariable => ({
  source: { kind: "field", field: key },
  example: t(tr, en),
})

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

export const forwardingMessageTemplates: MessageTemplateDef[] = [
  template({
    id: "forwarding.requestReceived",
    name: "fwd_request_received_v1",
    objectKey: "lead",
    label: t("Navlun talebi alındı", "Freight request received"),
    header: t("Talebiniz alındı", "Request received"),
    body: t(
      "Merhaba {{1}}, navlun talebinizi {{2}} olarak aldık. Ekibimiz rotanızı inceleyip teklifinizi en kısa sürede iletecek.",
      "Hello {{1}}, {{2}} has received your freight request. Our team will review your route and send your quote shortly."
    ),
    variables: [
      recipient,
      {
        source: { kind: "workspace", field: "name" },
        example: t("Acme Lojistik", "Acme Logistics"),
      },
    ],
  }),
  template({
    id: "forwarding.quoteSent",
    name: "fwd_quote_sent_v1",
    objectKey: "quote",
    label: t("Teklif gönderildi", "Quote sent"),
    header: t("Teklifiniz hazır", "Your quote is ready"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı navlun teklifiniz e-posta adresinize gönderildi. Teklif {{3}} tarihine kadar geçerlidir.",
      "Hello {{1}}, your freight quote {{2}} has been sent to your email address. It is valid until {{3}}."
    ),
    variables: [
      recipient,
      field("quoteNumber", "Q-2026-0118"),
      field("validUntil", "15.10.2026", "Oct 15, 2026"),
    ],
  }),
  template({
    id: "forwarding.bookingConfirmed",
    name: "fwd_booking_confirmed_v1",
    objectKey: "shipment",
    label: t("Rezervasyon onayı", "Booking confirmation"),
    header: t("Rezervasyon yapıldı", "Booking confirmed"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı sevkiyatınızın rezervasyonu yapıldı. Hat: {{3}} → {{4}}, planlanan çıkış: {{5}}. Gelişmeleri bu numaradan paylaşacağız.",
      "Hello {{1}}, shipment {{2}} has been booked. Lane: {{3}} → {{4}}, planned departure: {{5}}. We will share updates on this number."
    ),
    variables: [
      recipient,
      shipmentNo,
      field("origin", "İstanbul (TRIST)", "Istanbul (TRIST)"),
      field("destination", "Hamburg (DEHAM)"),
      field("etd", "12.10.2026", "Oct 12, 2026"),
    ],
  }),
  template({
    id: "forwarding.cargoPickedUp",
    name: "fwd_cargo_picked_up_v1",
    objectKey: "shipment",
    label: t("Yük teslim alındı", "Cargo picked up"),
    header: t("Yük teslim alındı", "Cargo picked up"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı sevkiyatınızın yükü teslim alındı. Planlanan çıkış tarihi: {{3}}. Bir sonraki adımda size haber vereceğiz.",
      "Hello {{1}}, the cargo of shipment {{2}} has been picked up. Planned departure: {{3}}. We will notify you at the next step."
    ),
    variables: [
      recipient,
      shipmentNo,
      field("etd", "12.10.2026", "Oct 12, 2026"),
    ],
  }),
  template({
    id: "forwarding.shipmentDeparted",
    name: "fwd_shipment_departed_v1",
    objectKey: "shipment",
    label: t("Sevkiyat yola çıktı", "Shipment departed"),
    header: t("Sevkiyat yola çıktı", "Shipment departed"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı sevkiyatınız {{3}} tarihinde {{4}} çıkışıyla yola çıktı. Tahmini varış: {{5}}. Sorularınız için bu mesajı yanıtlayabilirsiniz.",
      "Hello {{1}}, shipment {{2}} departed from {{4}} on {{3}}. Estimated arrival: {{5}}. Reply to this message with any questions."
    ),
    variables: [
      recipient,
      shipmentNo,
      field("atd", "12.10.2026", "Oct 12, 2026"),
      field("origin", "İstanbul (TRIST)", "Istanbul (TRIST)"),
      field("eta", "26.10.2026", "Oct 26, 2026"),
    ],
  }),
  template({
    id: "forwarding.shipmentArrived",
    name: "fwd_shipment_arrived_v1",
    objectKey: "shipment",
    label: t("Sevkiyat vardı", "Shipment arrived"),
    header: t("Sevkiyat vardı", "Shipment arrived"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı sevkiyatınız {{3}} tarihinde {{4}} varış noktasına ulaştı. Gümrük ve teslimat süreci hakkında sizi bilgilendireceğiz.",
      "Hello {{1}}, shipment {{2}} arrived at {{4}} on {{3}}. We will keep you posted on customs and delivery."
    ),
    variables: [
      recipient,
      shipmentNo,
      field("ata", "26.10.2026", "Oct 26, 2026"),
      field("destination", "Hamburg (DEHAM)"),
    ],
  }),
  template({
    id: "forwarding.customsCleared",
    name: "fwd_customs_cleared_v1",
    objectKey: "shipment",
    label: t("Gümrük işlemleri tamamlandı", "Customs cleared"),
    header: t("Gümrük tamamlandı", "Customs cleared"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı sevkiyatınızın gümrük işlemleri tamamlandı. Teslimat planlaması için ekibimiz sizinle iletişime geçecek.",
      "Hello {{1}}, customs clearance of shipment {{2}} is complete. Our team will contact you to plan the delivery."
    ),
    variables: [recipient, shipmentNo],
  }),
  template({
    id: "forwarding.shipmentDelivered",
    name: "fwd_shipment_delivered_v1",
    objectKey: "shipment",
    label: t("Sevkiyat teslim edildi", "Shipment delivered"),
    header: t("Teslim edildi", "Delivered"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı sevkiyatınız teslim edildi. Teslimatla ilgili bir sorun varsa bu mesajı yanıtlayarak bize bildirebilirsiniz.",
      "Hello {{1}}, shipment {{2}} has been delivered. If anything is wrong with the delivery, reply to this message to let us know."
    ),
    variables: [recipient, shipmentNo],
  }),
  template({
    id: "forwarding.shipmentDelayed",
    name: "fwd_shipment_delayed_v1",
    objectKey: "shipment",
    label: t("Sevkiyat gecikmesi", "Shipment delay"),
    header: t("Varış tarihi değişti", "Arrival date changed"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı sevkiyatınızın tahmini varış tarihi {{3}} olarak güncellendi. Detaylı bilgi için bu mesajı yanıtlayabilirsiniz.",
      "Hello {{1}}, the estimated arrival of shipment {{2}} has been updated to {{3}}. Reply to this message for details."
    ),
    variables: [
      recipient,
      shipmentNo,
      field("eta", "29.10.2026", "Oct 29, 2026"),
    ],
  }),
  template({
    id: "forwarding.documentReady",
    name: "fwd_document_ready_v1",
    objectKey: "shipment",
    label: t("Belge hazır", "Document ready"),
    header: t("Belgeniz hazır", "Your document is ready"),
    body: t(
      "Merhaba {{1}}, {{2}} numaralı sevkiyatınızın {{3}} belgesi hazırlandı. Belgeyi e-posta ile iletmemizi isterseniz bu mesajı yanıtlayabilirsiniz.",
      "Hello {{1}}, the {{3}} of shipment {{2}} is ready. Reply to this message if you would like us to email it to you."
    ),
    variables: [
      recipient,
      shipmentNo,
      {
        source: { kind: "event", field: "document" },
        example: t("Konşimento (B/L)", "bill of lading (B/L)"),
      },
    ],
  }),
]

const MILESTONE_TEMPLATES: Partial<Record<Milestone, string>> = {
  BOOKED: "forwarding.bookingConfirmed",
  PICKED_UP: "forwarding.cargoPickedUp",
  DEPARTED: "forwarding.shipmentDeparted",
  ARRIVED: "forwarding.shipmentArrived",
  CUSTOMS_CLEARED: "forwarding.customsCleared",
  DELIVERED: "forwarding.shipmentDelivered",
}

export const forwardingMessageTriggers: MessageTriggerDef[] = [
  {
    id: "forwarding.webFormLead",
    event: "lead.created",
    match: { source: "webForm" },
    templateId: "forwarding.requestReceived",
    label: t(
      "Web formundan navlun talebi geldiğinde",
      "When a freight request arrives from a web form"
    ),
  },
  {
    id: "forwarding.quoteSent",
    event: "quote.sent",
    templateId: "forwarding.quoteSent",
    label: t("Teklif e-postayla gönderildiğinde", "When a quote is emailed"),
  },
  ...Object.entries(MILESTONE_TEMPLATES).map(
    ([milestone, templateId]): MessageTriggerDef => ({
      id: `forwarding.milestone.${milestone}`,
      event: "shipment.milestone",
      match: { milestone },
      templateId,
      label: t(
        `Sevkiyat aşaması: ${MILESTONE_LABELS[milestone as Milestone].tr}`,
        `Shipment milestone: ${MILESTONE_LABELS[milestone as Milestone].en}`
      ),
    })
  ),
  {
    id: "forwarding.etaDelayed",
    event: "shipment.delayed",
    templateId: "forwarding.shipmentDelayed",
    label: t(
      "Tahmini varış ileri bir tarihe alındığında",
      "When the estimated arrival is pushed back"
    ),
  },
  {
    id: "forwarding.documentReady",
    event: "shipment.document",
    templateId: "forwarding.documentReady",
    label: t("B/L veya AWB yüklendiğinde", "When a B/L or AWB is uploaded"),
  },
]
