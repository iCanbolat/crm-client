import { FilterIcon, RouteIcon, UsersIcon } from "lucide-react"

import type { ReportDef } from "@/engine/reports"

import { t } from "./lib/constants"

/** Forwarding reports (B7.1); the mock API computes them in USD. */
export const forwardingReports: ReportDef[] = [
  {
    key: "quoteFunnel",
    label: t("Teklif dönüşüm hunisi", "Quote conversion funnel"),
    description: t(
      "Hazırlanan tekliflerden gönderilen ve kabul edilenlere geçiş.",
      "From quotes prepared to quotes sent and accepted."
    ),
    icon: FilterIcon,
    columns: [
      { key: "stage", label: t("Aşama", "Stage"), kind: "text" },
      { key: "count", label: t("Teklif", "Quotes"), kind: "number" },
      {
        key: "ofCreated",
        label: t("Hazırlananlara oranı", "Of prepared"),
        kind: "percent",
      },
      {
        key: "stepRate",
        label: t("Önceki adımdan geçiş", "From previous step"),
        kind: "percent",
      },
    ],
    chart: { kind: "funnel", labelKey: "stage", valueKey: "count" },
  },
  {
    key: "laneProfit",
    label: t("Hat bazlı ciro ve marj", "Revenue and margin by lane"),
    description: t(
      "Taşıma modu ve rotaya göre teklifler, kabul edilen ciro, maliyet ve marj.",
      "Quotes, accepted revenue, cost and margin per mode and route."
    ),
    icon: RouteIcon,
    columns: [
      { key: "lane", label: t("Hat", "Lane"), kind: "text" },
      { key: "mode", label: t("Taşıma modu", "Mode"), kind: "text" },
      { key: "quotes", label: t("Teklif", "Quotes"), kind: "number" },
      { key: "accepted", label: t("Kabul", "Accepted"), kind: "number" },
      { key: "revenue", label: t("Ciro", "Revenue"), kind: "currency" },
      { key: "cost", label: t("Maliyet", "Cost"), kind: "currency" },
      { key: "margin", label: t("Marj", "Margin"), kind: "currency" },
      { key: "marginPercent", label: t("Marj %", "Margin %"), kind: "percent" },
    ],
    chart: { kind: "bar", labelKey: "lane", valueKey: "revenue" },
  },
  {
    key: "repPerformance",
    label: t("Temsilci performansı", "Sales rep performance"),
    description: t(
      "Temsilci başına lead, teklif, kazanma oranı ve ciro.",
      "Leads, quotes, win rate and revenue per sales rep."
    ),
    icon: UsersIcon,
    columns: [
      { key: "name", label: t("Temsilci", "Sales rep"), kind: "text" },
      { key: "leads", label: t("Lead", "Leads"), kind: "number" },
      { key: "quotes", label: t("Teklif", "Quotes"), kind: "number" },
      { key: "accepted", label: t("Kabul", "Accepted"), kind: "number" },
      {
        key: "winRate",
        label: t("Kazanma oranı", "Win rate"),
        kind: "percent",
      },
      { key: "revenue", label: t("Ciro", "Revenue"), kind: "currency" },
    ],
    chart: { kind: "bar", labelKey: "name", valueKey: "revenue" },
  },
]
