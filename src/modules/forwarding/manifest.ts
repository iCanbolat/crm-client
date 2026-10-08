import {
  ContainerIcon,
  HandshakeIcon,
  ReceiptIcon,
  ShipIcon,
} from "lucide-react"

import type { ModuleManifest } from "@/engine/modules"

import {
  DelayedShipmentsWidget,
  OpenRequestsWidget,
  RepPerformanceWidget,
  RevenueWidget,
  ShipmentStatusWidget,
  TopLanesWidget,
  WinRateWidget,
} from "./components/dashboard/widgets"
import { QuoteSummaryCard } from "./components/quote/quote-summary-card"
import { RouteCargoCard } from "./components/route-cargo-card"
import { MilestoneTimeline } from "./components/shipment/milestone-timeline"
import { ScheduleCard } from "./components/shipment/schedule-card"
import { forwardingFieldTypes } from "./field-types"
import { forwardingFormBlocks } from "./form-blocks"
import {
  forwardingMessageTemplates,
  forwardingMessageTriggers,
} from "./message-templates"
import {
  companyExtension,
  dealExtension,
  leadExtension,
} from "./metadata/extend"
import { quoteObject, shipmentObject } from "./metadata/objects"

/** Company list filtered to the overseas agent network (B3.6). */
export const AGENT_NETWORK_FILTERS = [
  { field: "companyTypes", op: "in" as const, value: ["overseas_agent"] },
]

/** Forwarding (logistics) module — Faz 3. */
export const forwardingModule: ModuleManifest = {
  id: "forwarding",
  status: "active",
  label: { tr: "Forwarding (Lojistik)", en: "Forwarding (Logistics)" },
  description: {
    tr: "Navlun talepleri, teklifler, sevkiyat takibi ve acente ağı.",
    en: "Freight requests, quotes, shipment tracking and agent network.",
  },
  icon: ShipIcon,
  objects: [quoteObject(), shipmentObject()],
  extend: {
    lead: leadExtension,
    company: companyExtension,
    deal: dealExtension,
  },
  fieldTypes: forwardingFieldTypes,
  formBlocks: forwardingFormBlocks,
  messageTemplates: forwardingMessageTemplates,
  messageTriggers: forwardingMessageTriggers,
  recordSlots: {
    "lead.detail.sidebar": [
      { id: "forwarding.route", component: RouteCargoCard },
    ],
    "deal.detail.sidebar": [
      { id: "forwarding.route", component: RouteCargoCard },
    ],
    "quote.detail.main": [
      { id: "forwarding.quote", component: QuoteSummaryCard },
    ],
    "shipment.detail.main": [
      { id: "forwarding.milestones", component: MilestoneTimeline },
    ],
    "shipment.detail.sidebar": [
      { id: "forwarding.schedule", component: ScheduleCard },
    ],
  },
  dashboardWidgets: [
    { id: "forwarding.openRequests", size: 1, component: OpenRequestsWidget },
    { id: "forwarding.winRate", size: 1, component: WinRateWidget },
    { id: "forwarding.revenue", size: 2, component: RevenueWidget },
    { id: "forwarding.shipments", size: 2, component: ShipmentStatusWidget },
    { id: "forwarding.delayed", size: 2, component: DelayedShipmentsWidget },
    { id: "forwarding.lanes", size: 2, component: TopLanesWidget },
    { id: "forwarding.reps", size: 2, component: RepPerformanceWidget },
  ],
  navigation: [
    {
      id: "forwarding.quotes",
      label: { tr: "Teklifler", en: "Quotes" },
      icon: ReceiptIcon,
      to: "/o/$objectKey",
      params: { objectKey: "quote" },
    },
    {
      id: "forwarding.shipments",
      label: { tr: "Sevkiyatlar", en: "Shipments" },
      icon: ContainerIcon,
      to: "/o/$objectKey",
      params: { objectKey: "shipment" },
    },
    {
      id: "forwarding.partners",
      label: { tr: "Acente ağı", en: "Agent network" },
      icon: HandshakeIcon,
      to: "/o/$objectKey",
      params: { objectKey: "company" },
      search: { filters: AGENT_NETWORK_FILTERS },
    },
  ],
}
