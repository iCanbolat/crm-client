import {
  CalendarClockIcon,
  ContainerIcon,
  PackageIcon,
  RouteIcon,
  ScrollTextIcon,
} from "lucide-react"

import type { FormBlockDef } from "@/engine/forms"

import { INCOTERM_OPTIONS, t, TRANSPORT_MODE_OPTIONS } from "./lib/constants"

/**
 * Form builder blocks of the forwarding module (B4.2). Field keys and types
 * match the lead extension (`metadata/extend.ts`), so every block field maps
 * to its freight request field automatically (`mapTo`).
 */
export const forwardingFormBlocks: FormBlockDef[] = [
  {
    id: "forwarding.route",
    label: t("Rota", "Route"),
    description: t(
      "Taşıma modu, çıkış ve varış noktası",
      "Transport mode, origin and destination"
    ),
    icon: RouteIcon,
    fields: [
      {
        key: "transportMode",
        type: "select",
        label: t("Taşıma modu", "Transport mode"),
        required: true,
        options: TRANSPORT_MODE_OPTIONS,
        mapTo: "transportMode",
      },
      {
        key: "origin",
        type: "location",
        label: t("Çıkış noktası", "Origin"),
        placeholder: t("Liman, havalimanı veya şehir", "Port, airport or city"),
        required: true,
        width: "half",
        mapTo: "origin",
      },
      {
        key: "destination",
        type: "location",
        label: t("Varış noktası", "Destination"),
        placeholder: t("Liman, havalimanı veya şehir", "Port, airport or city"),
        required: true,
        width: "half",
        mapTo: "destination",
      },
    ],
  },
  {
    id: "forwarding.cargo",
    label: t("Yük bilgisi", "Cargo details"),
    description: t(
      "Emtia, ağırlık, hacim, kap adedi ve ölçüler",
      "Commodity, weight, volume, packages and dimensions"
    ),
    icon: PackageIcon,
    fields: [
      {
        key: "commodity",
        type: "text",
        label: t("Emtia", "Commodity"),
        placeholder: t("ör. Tekstil ürünleri", "e.g. Textile goods"),
        mapTo: "commodity",
      },
      {
        key: "grossWeight",
        type: "weight",
        label: t("Brüt ağırlık", "Gross weight"),
        validation: { min: 0 },
        width: "half",
        mapTo: "grossWeight",
      },
      {
        key: "volume",
        type: "volume",
        label: t("Hacim", "Volume"),
        validation: { min: 0 },
        width: "half",
        mapTo: "volume",
      },
      {
        key: "packageCount",
        type: "number",
        label: t("Kap adedi", "Packages"),
        validation: { min: 0 },
        width: "half",
        mapTo: "packageCount",
      },
      {
        key: "dimensions",
        type: "dimensions",
        label: t("Ölçüler", "Dimensions"),
        mapTo: "dimensions",
      },
    ],
  },
  {
    id: "forwarding.containers",
    label: t("Konteyner seçici", "Container picker"),
    description: t(
      "Konteyner tipi ve adedi (FCL)",
      "Container type and count (FCL)"
    ),
    icon: ContainerIcon,
    fields: [
      {
        key: "containers",
        type: "container",
        label: t("Konteyner ihtiyacı", "Containers"),
        mapTo: "containers",
      },
    ],
  },
  {
    id: "forwarding.incoterm",
    label: t("Incoterm", "Incoterm"),
    description: t(
      "Teslim şekli (Incoterms 2020)",
      "Delivery terms (Incoterms 2020)"
    ),
    icon: ScrollTextIcon,
    fields: [
      {
        key: "incoterm",
        type: "select",
        label: t("Teslim şekli (Incoterm)", "Incoterm"),
        options: INCOTERM_OPTIONS,
        mapTo: "incoterm",
      },
    ],
  },
  {
    id: "forwarding.readyDate",
    label: t("Hazır olma tarihi", "Ready date"),
    description: t("Yükün hazır olacağı tarih", "When the cargo is ready"),
    icon: CalendarClockIcon,
    fields: [
      {
        key: "readyDate",
        type: "date",
        label: t("Yük hazır olma tarihi", "Cargo ready date"),
        mapTo: "readyDate",
      },
    ],
  },
]
