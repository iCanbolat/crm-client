import { GraduationCapIcon, PlaneIcon } from "lucide-react"

import type { ModuleManifest } from "@/engine/modules"

export const visaEducationModule: ModuleManifest = {
  id: "visa-education",
  status: "coming-soon",
  label: { tr: "Vize & Eğitim Danışmanlığı", en: "Visa & Education" },
  description: {
    tr: "Başvuranlar, başvuru süreçleri, belge kontrol listeleri ve randevular.",
    en: "Applicants, application pipelines, document checklists and appointments.",
  },
  icon: GraduationCapIcon,
  navigation: [
    {
      id: "visa-education.applications",
      label: { tr: "Başvurular", en: "Applications" },
      icon: PlaneIcon,
      to: "/o/$objectKey",
      params: { objectKey: "application" },
    },
  ],
}
