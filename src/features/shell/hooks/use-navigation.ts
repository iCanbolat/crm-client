import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { useSession } from "@/features/auth"
import { metadataQueries } from "@/features/records"
import { useActiveModules } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"

import { buildNavigation } from "../lib/navigation"

export function useNavigation() {
  const { t } = useTranslation("shell")
  const modules = useActiveModules()
  const { subject } = useSession()
  // Loaded by the `_app` route before the shell renders.
  const objects = useQuery(metadataQueries.objects()).data?.data

  return buildNavigation({
    modules,
    objects,
    subject,
    language: getCurrentLanguage(),
    translate: (key) => t(key),
  })
}
