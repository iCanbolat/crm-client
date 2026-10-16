import type { Carrier } from "../../api/reference.schemas"

/** Ocean lines (SCAC), airlines (IATA) and road hauliers of the sample. */
export const CARRIERS: Carrier[] = [
  { code: "MSCU", name: "MSC", kind: "sea" },
  { code: "MAEU", name: "Maersk", kind: "sea" },
  { code: "CMDU", name: "CMA CGM", kind: "sea" },
  { code: "HLCU", name: "Hapag-Lloyd", kind: "sea" },
  { code: "COSU", name: "COSCO Shipping", kind: "sea" },
  { code: "ONEY", name: "Ocean Network Express", kind: "sea" },
  { code: "EGLV", name: "Evergreen", kind: "sea" },
  { code: "YMLU", name: "Yang Ming", kind: "sea" },
  { code: "ZIMU", name: "ZIM", kind: "sea" },
  { code: "ARKU", name: "Arkas Line", kind: "sea" },
  { code: "TK", name: "Turkish Cargo", kind: "air" },
  { code: "LH", name: "Lufthansa Cargo", kind: "air" },
  { code: "EK", name: "Emirates SkyCargo", kind: "air" },
  { code: "QR", name: "Qatar Airways Cargo", kind: "air" },
  { code: "CV", name: "Cargolux", kind: "air" },
  { code: "AF", name: "Air France KLM Cargo", kind: "air" },
  { code: "CX", name: "Cathay Cargo", kind: "air" },
  { code: "DHL", name: "DHL Aviation", kind: "air" },
  { code: "MRSY", name: "Mars Logistics", kind: "road" },
  { code: "EKOL", name: "Ekol Lojistik", kind: "road" },
  { code: "NETL", name: "Netlog Lojistik", kind: "road" },
  { code: "HORO", name: "Horoz Lojistik", kind: "road" },
  { code: "OMSA", name: "Omsan Lojistik", kind: "road" },
  { code: "DSVR", name: "DSV Road", kind: "road" },
  { code: "GRBR", name: "Girteka", kind: "road" },
]

export { FX_RATES } from "@/mocks/db/fx-rates"
