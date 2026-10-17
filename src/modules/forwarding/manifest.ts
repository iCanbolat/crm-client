import {
  ContainerIcon,
  HandshakeIcon,
  ReceiptIcon,
  ShipIcon,
} from "lucide-react"

import { lazy } from "react"

import type { ModuleManifest } from "@/engine/modules"

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
import { forwardingReports } from "./reports"
import {
  companyExtension,
  dealExtension,
  leadExtension,
} from "./metadata/extend"
import { quoteObject, shipmentObject } from "./metadata/objects"

/** Company list filtered to the overseas agent network (B3.6). */
type WidgetName = keyof typeof import("./components/dashboard/widgets")

/** Widgets (and recharts) load with the dashboard, not the app shell (B7.4). */
const widget = (name: WidgetName) =>
  lazy(() =>
    import("./components/dashboard/widgets").then((module) => ({
      default: module[name],
    }))
  )

type StatName = keyof typeof import("./components/dashboard/stats")

/** KPI cards stay out of the recharts chunk: the strip renders first. */
const stat = (name: StatName) =>
  lazy(() =>
    import("./components/dashboard/stats").then((module) => ({
      default: module[name],
    }))
  )

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
  reports: forwardingReports,
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
  dashboardStats: [
    { id: "forwarding.openRequests", component: stat("OpenRequestsStat") },
    { id: "forwarding.winRate", component: stat("WinRateStat") },
    { id: "forwarding.revenue", component: stat("RevenueStat") },
    { id: "forwarding.delayed", component: stat("DelayedShipmentsStat") },
  ],
  dashboardWidgets: [
    // Trend first, full width; operations and sales lists pair up below.
    { id: "forwarding.revenue", size: 4, component: widget("RevenueWidget") },
    {
      id: "forwarding.shipments",
      size: 2,
      component: widget("ShipmentStatusWidget"),
    },
    {
      id: "forwarding.delayed",
      size: 2,
      component: widget("DelayedShipmentsWidget"),
    },
    { id: "forwarding.lanes", size: 2, component: widget("TopLanesWidget") },
    {
      id: "forwarding.reps",
      size: 2,
      component: widget("RepPerformanceWidget"),
    },
  ],
  roleLabels: {
    manager: {
      label: { tr: "Satış müdürü", en: "Sales manager" },
      description: {
        tr: "Tüm talepleri, teklifleri ve sevkiyatları yönetir.",
        en: "Manages every enquiry, quote and shipment.",
      },
    },
    agent: {
      label: { tr: "Satış temsilcisi", en: "Sales rep" },
      description: {
        tr: "Talepleri karşılar, teklif hazırlar ve kendi kayıtlarını düzenler.",
        en: "Handles enquiries, prepares quotes and edits their own records.",
      },
    },
  },
  // B2B freight sales (Faz 10): companies are customers and partners.
  coreObjects: {
    lead: {
      label: { tr: "Navlun talebi", en: "Freight enquiry" },
      pluralLabel: { tr: "Navlun talepleri", en: "Freight enquiries" },
    },
  },
  navGroups: [
    {
      id: "forwarding.sales",
      label: { tr: "Satış", en: "Sales" },
      items: [
        { id: "forwarding.leads", objectKey: "lead" },
        { id: "forwarding.companies", objectKey: "company" },
        { id: "forwarding.contacts", objectKey: "contact" },
        { id: "forwarding.deals", objectKey: "deal" },
        {
          id: "forwarding.quotes",
          objectKey: "quote",
          label: { tr: "Teklifler", en: "Quotes" },
          icon: ReceiptIcon,
        },
      ],
    },
    {
      id: "forwarding.operations",
      label: { tr: "Operasyon", en: "Operations" },
      items: [
        {
          id: "forwarding.shipments",
          objectKey: "shipment",
          label: { tr: "Sevkiyatlar", en: "Shipments" },
          icon: ContainerIcon,
        },
        {
          id: "forwarding.partners",
          objectKey: "company",
          label: { tr: "Acente ağı", en: "Agent network" },
          icon: HandshakeIcon,
          search: { filters: AGENT_NETWORK_FILTERS },
        },
      ],
    },
  ],
}
