import type { OptionColor, SelectOption } from "@/engine/metadata"
import type { I18nText } from "@/lib/i18n-text"

/**
 * Forwarding vocabulary shared by metadata (select options), calculations,
 * UI and the mock backend. Labels are inline translations like metadata.
 */

export const t = (tr: string, en: string): I18nText => ({ tr, en })

export const option = (
  value: string,
  label: I18nText,
  color?: OptionColor
): SelectOption => ({ value, label, ...(color ? { color } : {}) })

/* ---------------------------------------------------------- transport mode */

export const TRANSPORT_MODES = [
  "SEA_FCL",
  "SEA_LCL",
  "AIR",
  "ROAD_FTL",
  "ROAD_LTL",
  "RAIL",
  "MULTIMODAL",
  "COURIER",
] as const
export type TransportMode = (typeof TRANSPORT_MODES)[number]

export const TRANSPORT_MODE_LABELS: Record<TransportMode, I18nText> = {
  SEA_FCL: t("Deniz — FCL (komple)", "Sea — FCL"),
  SEA_LCL: t("Deniz — LCL (parsiyel)", "Sea — LCL"),
  AIR: t("Hava", "Air"),
  ROAD_FTL: t("Kara — FTL (komple)", "Road — FTL"),
  ROAD_LTL: t("Kara — LTL (parsiyel)", "Road — LTL"),
  RAIL: t("Demiryolu", "Rail"),
  MULTIMODAL: t("Multimodal", "Multimodal"),
  COURIER: t("Kurye / ekspres", "Courier / express"),
}

const MODE_COLORS: Record<TransportMode, OptionColor> = {
  SEA_FCL: "blue",
  SEA_LCL: "teal",
  AIR: "violet",
  ROAD_FTL: "amber",
  ROAD_LTL: "amber",
  RAIL: "gray",
  MULTIMODAL: "green",
  COURIER: "red",
}

export const TRANSPORT_MODE_OPTIONS = TRANSPORT_MODES.map((mode) =>
  option(mode, TRANSPORT_MODE_LABELS[mode], MODE_COLORS[mode])
)

export function isTransportMode(value: unknown): value is TransportMode {
  return TRANSPORT_MODES.includes(value as TransportMode)
}

/** Modes priced by measured cargo (dimensions) rather than equipment. */
export const PIECE_MODES: readonly TransportMode[] = [
  "AIR",
  "SEA_LCL",
  "ROAD_LTL",
  "COURIER",
]

/* --------------------------------------------------------------- containers */

export interface ContainerTypeDef {
  code: string
  label: I18nText
  teu: number
  reefer?: boolean
}

export const CONTAINER_TYPES: ContainerTypeDef[] = [
  { code: "20DC", label: t("20' Standart", "20' Dry"), teu: 1 },
  { code: "40DC", label: t("40' Standart", "40' Dry"), teu: 2 },
  { code: "40HC", label: t("40' High Cube", "40' High Cube"), teu: 2 },
  { code: "45HC", label: t("45' High Cube", "45' High Cube"), teu: 2.25 },
  { code: "20RF", label: t("20' Reefer", "20' Reefer"), teu: 1, reefer: true },
  { code: "40RF", label: t("40' Reefer", "40' Reefer"), teu: 2, reefer: true },
  { code: "40OT", label: t("40' Open Top", "40' Open Top"), teu: 2 },
  { code: "40FR", label: t("40' Flat Rack", "40' Flat Rack"), teu: 2 },
]

export const CONTAINER_CODES = CONTAINER_TYPES.map((item) => item.code)

/* ---------------------------------------------------------------- incoterms */

export const INCOTERMS = [
  { code: "EXW", label: t("İşyerinde teslim", "Ex Works"), anyMode: true },
  { code: "FCA", label: t("Taşıyıcıya teslim", "Free Carrier"), anyMode: true },
  {
    code: "CPT",
    label: t("Taşıma ücreti ödenmiş", "Carriage Paid To"),
    anyMode: true,
  },
  {
    code: "CIP",
    label: t("Taşıma ve sigorta ödenmiş", "Carriage and Insurance Paid To"),
    anyMode: true,
  },
  {
    code: "DAP",
    label: t("Belirlenen yerde teslim", "Delivered at Place"),
    anyMode: true,
  },
  {
    code: "DPU",
    label: t("Boşaltılmış olarak teslim", "Delivered at Place Unloaded"),
    anyMode: true,
  },
  {
    code: "DDP",
    label: t("Gümrük vergisi ödenmiş", "Delivered Duty Paid"),
    anyMode: true,
  },
  {
    code: "FAS",
    label: t("Gemi doğrultusunda teslim", "Free Alongside Ship"),
    anyMode: false,
  },
  { code: "FOB", label: t("Gemide teslim", "Free on Board"), anyMode: false },
  {
    code: "CFR",
    label: t("Masraflar ve navlun", "Cost and Freight"),
    anyMode: false,
  },
  {
    code: "CIF",
    label: t("Masraflar, sigorta ve navlun", "Cost, Insurance and Freight"),
    anyMode: false,
  },
] as const

export const INCOTERM_OPTIONS = INCOTERMS.map((item) =>
  option(
    item.code,
    t(`${item.code} — ${item.label.tr}`, `${item.code} — ${item.label.en}`)
  )
)

/* ------------------------------------------------------------------- hazmat */

export const IMO_CLASSES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
] as const

/* ------------------------------------------------------------------- quotes */

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, I18nText> = {
  draft: t("Taslak", "Draft"),
  sent: t("Gönderildi", "Sent"),
  accepted: t("Kabul edildi", "Accepted"),
  rejected: t("Reddedildi", "Rejected"),
  expired: t("Süresi doldu", "Expired"),
}

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, OptionColor> = {
  draft: "gray",
  sent: "blue",
  accepted: "green",
  rejected: "red",
  expired: "amber",
}

export const CHARGE_CODES = [
  "OFR",
  "AFR",
  "RFR",
  "BAF",
  "CAF",
  "THC_O",
  "THC_D",
  "ISPS",
  "DOC",
  "CUSTOMS",
  "PRE_CARRIAGE",
  "ON_CARRIAGE",
  "INSURANCE",
  "OTHER",
] as const
export type ChargeCode = (typeof CHARGE_CODES)[number]

export const CHARGE_LABELS: Record<ChargeCode, I18nText> = {
  OFR: t("Deniz navlunu (OFR)", "Ocean freight (OFR)"),
  AFR: t("Hava navlunu (AFR)", "Air freight (AFR)"),
  RFR: t("Kara navlunu", "Road freight"),
  BAF: t("Yakıt ek ücreti (BAF)", "Bunker adjustment (BAF)"),
  CAF: t("Kur ek ücreti (CAF)", "Currency adjustment (CAF)"),
  THC_O: t("Çıkış liman elleçleme (THC)", "Origin terminal handling (THC)"),
  THC_D: t(
    "Varış liman elleçleme (THC)",
    "Destination terminal handling (THC)"
  ),
  ISPS: t("ISPS", "ISPS"),
  DOC: t("Belge ücreti", "Documentation fee"),
  CUSTOMS: t("Gümrükleme", "Customs clearance"),
  PRE_CARRIAGE: t("Ön taşıma", "Pre-carriage"),
  ON_CARRIAGE: t("Son taşıma (teslimat)", "On-carriage (delivery)"),
  INSURANCE: t("Sigorta", "Insurance"),
  OTHER: t("Diğer", "Other"),
}

export const UNIT_BASES = ["container", "kg", "cbm", "wm", "shipment"] as const
export type UnitBasis = (typeof UNIT_BASES)[number]

export const UNIT_BASIS_LABELS: Record<UnitBasis, I18nText> = {
  container: t("Konteyner başı", "Per container"),
  kg: t("Kg başı (ücretli ağırlık)", "Per kg (chargeable)"),
  cbm: t("m³ başı", "Per m³"),
  wm: t("W/M başı", "Per W/M"),
  shipment: t("Sevkiyat başı", "Per shipment"),
}

/** Margin under this percentage needs attention (no workspace setting yet). */
export const MIN_MARGIN_PERCENT = 8

/* --------------------------------------------------------------- shipments */

export const MILESTONES = [
  "BOOKED",
  "CARGO_READY",
  "PICKED_UP",
  "DEPARTED",
  "TRANSSHIPMENT",
  "ARRIVED",
  "CUSTOMS_CLEARED",
  "DELIVERED",
] as const
export type Milestone = (typeof MILESTONES)[number]

/** Milestones a shipment may skip (direct services have no transshipment). */
export const OPTIONAL_MILESTONES: readonly Milestone[] = ["TRANSSHIPMENT"]

export const MILESTONE_LABELS: Record<Milestone, I18nText> = {
  BOOKED: t("Rezervasyon yapıldı", "Booked"),
  CARGO_READY: t("Yük hazır", "Cargo ready"),
  PICKED_UP: t("Yük alındı", "Picked up"),
  DEPARTED: t("Yola çıktı (ATD)", "Departed (ATD)"),
  TRANSSHIPMENT: t("Aktarma", "Transshipment"),
  ARRIVED: t("Vardı (ATA)", "Arrived (ATA)"),
  CUSTOMS_CLEARED: t("Gümrükten çekildi", "Customs cleared"),
  DELIVERED: t("Teslim edildi", "Delivered"),
}

const MILESTONE_COLORS: Record<Milestone, OptionColor> = {
  BOOKED: "gray",
  CARGO_READY: "blue",
  PICKED_UP: "blue",
  DEPARTED: "violet",
  TRANSSHIPMENT: "violet",
  ARRIVED: "teal",
  CUSTOMS_CLEARED: "amber",
  DELIVERED: "green",
}

export const MILESTONE_OPTIONS = MILESTONES.map((key) =>
  option(key, MILESTONE_LABELS[key], MILESTONE_COLORS[key])
)

export const DOCUMENT_CATEGORIES = [
  "bl",
  "awb",
  "cmr",
  "invoice",
  "packing_list",
  "certificate",
  "other",
] as const
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, I18nText> = {
  bl: t("Konşimento (B/L)", "Bill of lading (B/L)"),
  awb: t("Hava yolu senedi (AWB)", "Air waybill (AWB)"),
  cmr: t("CMR", "CMR"),
  invoice: t("Ticari fatura", "Commercial invoice"),
  packing_list: t("Çeki listesi", "Packing list"),
  certificate: t("Menşe / sertifika", "Origin / certificate"),
  other: t("Diğer", "Other"),
}

/* ---------------------------------------------------------------- partners */

export const COMPANY_TYPES = [
  "customer",
  "overseas_agent",
  "carrier",
  "customs_broker",
  "trucker",
] as const

export const COMPANY_TYPE_OPTIONS = [
  option("customer", t("Müşteri", "Customer"), "blue"),
  option("overseas_agent", t("Yurtdışı acente", "Overseas agent"), "violet"),
  option("carrier", t("Taşıyıcı", "Carrier"), "teal"),
  option("customs_broker", t("Gümrük müşaviri", "Customs broker"), "amber"),
  option("trucker", t("Nakliyeci", "Trucker"), "gray"),
]

export const SERVICE_OPTIONS = [
  option("sea", t("Deniz", "Sea"), "blue"),
  option("air", t("Hava", "Air"), "violet"),
  option("road", t("Kara", "Road"), "amber"),
  option("rail", t("Demiryolu", "Rail"), "gray"),
  option("customs", t("Gümrük", "Customs"), "teal"),
  option("warehouse", t("Depolama", "Warehousing"), "green"),
]

export const CARRIER_KINDS = ["sea", "air", "road"] as const
export type CarrierKind = (typeof CARRIER_KINDS)[number]
