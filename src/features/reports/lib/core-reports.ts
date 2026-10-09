import { InboxIcon } from "lucide-react"

import type { ReportDef } from "@/engine/reports"

const t = (tr: string, en: string) => ({ tr, en })

/** Reports every workspace has; sector modules add theirs (B7.1). */
export const CORE_REPORTS: ReportDef[] = [
  {
    key: "leadSources",
    label: t("Lead kaynak performansı", "Lead source performance"),
    description: t(
      "Kaynağa göre gelen lead'ler, dönüşenler ve dönüşüm oranı.",
      "Leads per source, how many converted and the conversion rate."
    ),
    icon: InboxIcon,
    columns: [
      { key: "source", label: t("Kaynak", "Source"), kind: "text" },
      { key: "leads", label: t("Lead", "Leads"), kind: "number" },
      { key: "converted", label: t("Dönüşen", "Converted"), kind: "number" },
      { key: "lost", label: t("Kaybedilen", "Lost"), kind: "number" },
      {
        key: "conversionRate",
        label: t("Dönüşüm oranı", "Conversion rate"),
        kind: "percent",
      },
    ],
    chart: { kind: "bar", labelKey: "source", valueKey: "leads" },
  },
]
