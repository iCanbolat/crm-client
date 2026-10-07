import type { Condition } from "@/engine/logic"
import type { ObjectExtension } from "@/engine/modules"

import {
  COMPANY_TYPE_OPTIONS,
  INCOTERM_OPTIONS,
  option,
  PIECE_MODES,
  SERVICE_OPTIONS,
  t,
  TRANSPORT_MODE_OPTIONS,
} from "../lib/constants"

const modeIn = (modes: readonly string[]): Condition[] => [
  { field: "transportMode", op: "in", value: [...modes] },
]

/** Freight request: route and cargo on top of the core lead (B3.3). */
export const leadExtension: ObjectExtension = {
  fields: [
    {
      key: "transportMode",
      label: t("Taşıma modu", "Transport mode"),
      type: "select",
      options: TRANSPORT_MODE_OPTIONS,
    },
    { key: "origin", label: t("Çıkış", "Origin"), type: "location" },
    { key: "destination", label: t("Varış", "Destination"), type: "location" },
    { key: "commodity", label: t("Emtia", "Commodity"), type: "text" },
    { key: "hsCode", label: t("GTİP / HS kodu", "HS code"), type: "hsCode" },
    {
      key: "grossWeight",
      label: t("Brüt ağırlık", "Gross weight"),
      type: "weight",
      validation: { min: 0 },
    },
    {
      key: "volume",
      label: t("Hacim", "Volume"),
      type: "volume",
      validation: { min: 0 },
    },
    {
      key: "packageCount",
      label: t("Kap adedi", "Packages"),
      type: "number",
      validation: { min: 0 },
    },
    {
      key: "dimensions",
      label: t("Ölçüler", "Dimensions"),
      type: "dimensions",
      visibleWhen: modeIn(PIECE_MODES),
    },
    {
      key: "containers",
      label: t("Konteyner ihtiyacı", "Containers"),
      type: "container",
      required: true,
      visibleWhen: modeIn(["SEA_FCL"]),
    },
    {
      key: "isHazardous",
      label: t("Tehlikeli madde", "Dangerous goods"),
      type: "boolean",
    },
    {
      key: "dangerousGoods",
      label: t("IMO sınıfı / UN no", "IMO class / UN no"),
      type: "dangerousGoods",
      required: true,
      visibleWhen: [{ field: "isHazardous", op: "isTrue" }],
    },
    {
      key: "temperatureControlled",
      label: t("Isı kontrollü", "Temperature controlled"),
      type: "boolean",
    },
    {
      key: "readyDate",
      label: t("Yük hazır tarihi", "Cargo ready date"),
      type: "date",
    },
    {
      key: "incoterm",
      label: t("Teslim şekli (Incoterm)", "Incoterm"),
      type: "select",
      options: INCOTERM_OPTIONS,
    },
    {
      key: "insuranceRequested",
      label: t("Sigorta talebi", "Insurance requested"),
      type: "boolean",
    },
  ],
  sections: [
    {
      key: "freight",
      label: t("Rota & yük", "Route & cargo"),
      fields: [
        "transportMode",
        "origin",
        "destination",
        "incoterm",
        "readyDate",
        "commodity",
        "hsCode",
        "grossWeight",
        "volume",
        "packageCount",
        "dimensions",
        "containers",
        "isHazardous",
        "dangerousGoods",
        "temperatureControlled",
        "insuranceRequested",
      ],
    },
  ],
  columns: ["transportMode", "origin", "destination"],
  related: [{ objectKey: "quote", field: "leadId" }],
}

/** Partner network: customers, overseas agents, carriers… (B3.6). */
export const companyExtension: ObjectExtension = {
  fields: [
    {
      key: "companyTypes",
      label: t("Şirket tipi", "Company type"),
      type: "multiselect",
      options: COMPANY_TYPE_OPTIONS,
    },
    {
      key: "services",
      label: t("Hizmetler", "Services"),
      type: "multiselect",
      options: SERVICE_OPTIONS,
    },
  ],
  sections: [
    {
      key: "overview",
      label: t("Genel bilgiler", "Overview"),
      fields: ["companyTypes", "services"],
    },
  ],
  columns: ["companyTypes"],
  related: [
    { objectKey: "quote", field: "companyId" },
    { objectKey: "shipment", field: "customerId" },
  ],
}

/** Forwarding sales pipeline (B3.6). */
export const dealExtension: ObjectExtension = {
  fields: [
    {
      key: "transportMode",
      label: t("Taşıma modu", "Transport mode"),
      type: "select",
      options: TRANSPORT_MODE_OPTIONS,
    },
    { key: "origin", label: t("Çıkış", "Origin"), type: "location" },
    { key: "destination", label: t("Varış", "Destination"), type: "location" },
  ],
  fieldPatches: {
    lostReason: {
      options: [
        option("price", t("Fiyat", "Price")),
        option("transitTime", t("Transit süre", "Transit time")),
        option("capacity", t("Kapasite / yer yok", "No capacity")),
        option("service", t("Hizmet kalitesi", "Service quality")),
        option("competitor", t("Rakip tercih edildi", "Chose a competitor")),
        option("cancelled", t("Müşteri vazgeçti", "Customer cancelled")),
        option("other", t("Diğer", "Other")),
      ],
    },
  },
  pipeline: {
    field: "stage",
    amountField: "amount",
    stages: [
      {
        key: "rate_research",
        label: t("Fiyat araştırma", "Rate research"),
        kind: "open",
        color: "blue",
      },
      {
        key: "quote_sent",
        label: t("Teklif gönderildi", "Quote sent"),
        kind: "open",
        color: "violet",
      },
      {
        key: "negotiation",
        label: t("Müzakere", "Negotiation"),
        kind: "open",
        color: "amber",
      },
      {
        key: "won",
        label: t("Kazanıldı (booking)", "Won (booking)"),
        kind: "won",
        color: "green",
      },
      {
        key: "lost",
        label: t("Kaybedildi", "Lost"),
        kind: "lost",
        color: "red",
        requiredFields: ["lostReason"],
      },
    ],
  },
  sections: [
    {
      key: "overview",
      label: t("Fırsat bilgileri", "Deal details"),
      fields: ["transportMode", "origin", "destination"],
    },
  ],
  columns: ["transportMode"],
  related: [
    { objectKey: "quote", field: "dealId" },
    { objectKey: "shipment", field: "dealId" },
  ],
}

/** Deal stages of the core pipeline mapped onto the forwarding one. */
export const DEAL_STAGE_MAP: Record<string, string> = {
  qualification: "rate_research",
  proposal: "quote_sent",
  negotiation: "negotiation",
  won: "won",
  lost: "lost",
}
