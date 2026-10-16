import { HeartPulseIcon, StethoscopeIcon } from "lucide-react"

import type { ModuleManifest } from "@/engine/modules"

export const healthTourismModule: ModuleManifest = {
  id: "health-tourism",
  status: "coming-soon",
  label: { tr: "Sağlık Turizmi", en: "Health Tourism" },
  description: {
    tr: "Hasta talepleri, tedavi planları, paket teklifler ve seyahat organizasyonu.",
    en: "Patient requests, treatment plans, package quotes and travel logistics.",
  },
  icon: HeartPulseIcon,
  navGroups: [
    {
      id: "health-tourism.patients",
      label: { tr: "Hasta yönetimi", en: "Patients" },
      items: [
        {
          id: "health-tourism.treatments",
          objectKey: "treatment",
          label: { tr: "Tedavi talepleri", en: "Treatment requests" },
          icon: StethoscopeIcon,
        },
      ],
    },
  ],
}
